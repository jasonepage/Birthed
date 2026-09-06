#!/usr/bin/env python3
"""Screen historical_events with the same content check the ingestion uses.

historical_events is Wikipedia's date article imported wholesale, so a date
page can open with a battle, a killing or a disaster. This runs every row past
the check in ingestion_agent.py and marks the ones it declines.

    python3 event_screen.py --report                  what is there, no model called
    python3 event_screen.py --date 9-6                one date, live, writes nothing
    python3 event_screen.py --date 9-6 --apply        one date, writes the flags
    python3 event_screen.py --apply                   all of it

Nothing is ever deleted. Read the two notes below before changing that.

WHY THIS MARKS AND DOES NOT DELETE
----------------------------------
import-events.ts rewrites this table. Every run upserts each date's rows by
fingerprint and then calls pruneHistoricalEvents, which deletes that date's
rows from before the run. A row deleted by hand is imported again the next time
the worker runs, so a delete does not survive and the page goes back to how it
was with nothing to show why. The flag survives, because the importer does not
touch it, and the read policy on the table hides flagged rows from the
anonymous key that both readers use.

WHY THIS FAILS OPEN WHERE THE INGESTION FAILS CLOSED
----------------------------------------------------
In ingestion_agent.py an unclear answer means do not insert, because the cost
of dropping one cheerful event is a missing row. Here the direction reverses.
A row is already published, so acting on an unclear answer means hiding history
from readers because a request timed out. So an event is hidden only on an
explicit REJECT. A failure leaves the row visible and is counted and reported,
and the run can simply be run again, because it only looks at rows it has not
screened yet.
"""

from __future__ import annotations

import argparse
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

from ingestion_agent import (
    Config,
    _call_anthropic,
    configure_logging,
    connect,
    load_config,
)

log = logging.getLogger("ingest")

TABLE = "historical_events"

#: Written into suppressed_reason so a later, different screen can be told
#: apart from this one without a migration.
SCREEN_VERSION = "content screen v1"

#: Rows read per request to Supabase. PostgREST caps a page anyway.
PAGE_SIZE = 1000


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Event:
    id: int
    month: int
    day: int
    year: int | None
    description: str

    @property
    def label(self) -> str:
        year = str(self.year) if self.year is not None else "no year"
        short = self.description if len(self.description) <= 96 else self.description[:93] + "..."
        return f"{self.month:02d}-{self.day:02d} {year:>8}  {short}"

    def as_prompt(self) -> str:
        """The same four line shape ingestion_agent sends, so the check sees
        the same kind of input it was written and tested against."""
        return (
            f"Date: {self.month:02d}-{self.day:02d}"
            + (f"-{self.year}" if self.year is not None else "")
            + "\nCategory: historical event\n"
            f"Title: {self.description[:120]}\n"
            f"Description: {self.description}"
        )


def fetch_events(client: Any, month: int | None, day: int | None,
                 limit: int | None, rescreen: bool) -> list[Event]:
    """Every row not yet screened, oldest identifier first so a rerun resumes.

    Reads through the service role, which bypasses row level security, so this
    sees rows that are already suppressed as well. Without that a rerun could
    not find its own previous work.
    """
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        query = client.table(TABLE).select("id,event_month,event_day,event_year,description")
        if month is not None:
            query = query.eq("event_month", month)
        if day is not None:
            query = query.eq("event_day", day)
        if not rescreen:
            query = query.is_("suppressed_at", "null")
        page = query.order("id").range(start, start + PAGE_SIZE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        if limit is not None and len(rows) >= limit:
            break
        start += PAGE_SIZE

    if limit is not None:
        rows = rows[:limit]

    return [
        Event(
            id=row["id"],
            month=row["event_month"],
            day=row["event_day"],
            year=row["event_year"],
            description=row["description"] or "",
        )
        for row in rows
        if row.get("description")
    ]


# ---------------------------------------------------------------------------
# Screening
# ---------------------------------------------------------------------------


@dataclass
class Screened:
    event: Event
    suppress: bool
    failed: bool = False
    answer: str = ""


def screen_one(config: Config, event: Event) -> Screened:
    """One event past the check.

    The only answer that hides a row is the single word REJECT. ACCEPT keeps
    it, and so does anything else, including a model that could not be reached.
    See the note at the top of this file for why that is the opposite of the
    ingestion.
    """
    try:
        answer = _call_anthropic(config, event.as_prompt(), cache_system=True)
    except Exception as exc:
        log.warning("  could not screen id %s: %s", event.id, exc)
        return Screened(event=event, suppress=False, failed=True, answer=str(exc))

    normalised = answer.strip().strip(".").upper()
    if normalised == "REJECT":
        return Screened(event=event, suppress=True, answer=answer)
    if normalised != "ACCEPT":
        log.warning("  id %s answered %r, leaving it visible", event.id, answer)
        return Screened(event=event, suppress=False, failed=True, answer=answer)
    return Screened(event=event, suppress=False, answer=answer)


def screen_all(config: Config, events: list[Event], workers: int) -> list[Screened]:
    """Screened in parallel, because twenty thousand sequential requests is
    four hours and the same requests twelve at a time is twenty minutes."""
    done = 0
    results: list[Screened] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(lambda e: screen_one(config, e), events):
            results.append(result)
            done += 1
            if result.suppress:
                log.info("  HIDE  %s", result.event.label)
            if done % 250 == 0:
                log.info("... %d of %d screened", done, len(events))
    return results


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


def apply_flags(client: Any, results: list[Screened], model: str, chunk: int = 200) -> tuple[int, int]:
    """Write the verdicts.

    Both outcomes are written, not just the hidden ones, because
    suppressed_at is what makes a rerun skip a row it has already paid for.
    A row that failed to screen is left alone entirely so the next run picks
    it up again.
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    hidden = [r.event.id for r in results if r.suppress]
    kept = [r.event.id for r in results if not r.suppress and not r.failed]

    def write(ids: list[int], suppressed: bool) -> None:
        for index in range(0, len(ids), chunk):
            batch = ids[index:index + chunk]
            client.table(TABLE).update({
                "suppressed": suppressed,
                "suppressed_reason": SCREEN_VERSION if suppressed else None,
                "suppressed_model": model,
                "suppressed_at": now,
            }).in_("id", batch).execute()

    write(hidden, True)
    write(kept, False)
    return len(hidden), len(kept)


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------


@dataclass
class Summary:
    total: int = 0
    hidden: int = 0
    kept: int = 0
    failed: int = 0
    samples: list[str] = field(default_factory=list)


def run(month: int | None, day: int | None, limit: int | None,
        workers: int, apply: bool, rescreen: bool) -> Summary:
    config = load_config(needs_write=True)
    client = connect(config)

    log.info("Birthed historical event screen")
    log.info("Model: %s", config.vibe_check_model)
    log.info("Mode:  %s", "APPLY, flags will be written" if apply else "preview, nothing will be written")
    log.info("-" * 74)

    events = fetch_events(client, month, day, limit, rescreen)
    log.info("%d event(s) to screen", len(events))
    if not events:
        return Summary()

    estimate = len(events) * 310 / 1_000_000
    log.info("Roughly %.1f million input tokens, before the prompt cache discount.", estimate)
    log.info("-" * 74)

    results = screen_all(config, events, workers)

    summary = Summary(
        total=len(results),
        hidden=sum(1 for r in results if r.suppress),
        kept=sum(1 for r in results if not r.suppress and not r.failed),
        failed=sum(1 for r in results if r.failed),
        samples=[r.event.label for r in results if r.suppress][:15],
    )

    log.info("-" * 74)
    if apply:
        hidden, kept = apply_flags(client, results, config.vibe_check_model)
        log.info("Wrote %d hidden and %d kept.", hidden, kept)
    else:
        log.info("Preview only. Nothing was written. Add --apply to write these flags.")

    log.info(
        "Screened %d: %d hidden, %d kept, %d could not be screened and stay visible.",
        summary.total, summary.hidden, summary.kept, summary.failed,
    )
    if summary.total:
        log.info("That is %.1f percent of what was screened.", 100 * summary.hidden / summary.total)
    return summary


def report(month: int | None, day: int | None) -> None:
    """What is in the table right now. Calls no model and costs nothing."""
    config = load_config(needs_write=True)
    client = connect(config)
    rows = client.table(TABLE).select("id,suppressed,suppressed_at").limit(100_000).execute().data or []
    total = len(rows)
    hidden = sum(1 for r in rows if r.get("suppressed"))
    screened = sum(1 for r in rows if r.get("suppressed_at"))
    log.info("historical_events: %d rows, %d screened, %d hidden, %d never screened",
             total, screened, hidden, total - screened)


def parse_date(value: str | None) -> tuple[int | None, int | None]:
    if not value:
        return None, None
    parts = value.split("-")
    if len(parts) != 2:
        raise SystemExit("--date takes month-day, for example 9-6")
    return int(parts[0]), int(parts[1])


def main() -> int:
    parser = argparse.ArgumentParser(description="Screen historical_events with the ingestion content check.")
    parser.add_argument("--date", help="One calendar date, as month-day, for example 9-6.")
    parser.add_argument("--limit", type=int, default=None, help="Screen at most this many rows.")
    parser.add_argument("--workers", type=int, default=12, help="Requests in flight at once. Default 12.")
    parser.add_argument("--apply", action="store_true", help="Write the flags. Without this nothing is written.")
    parser.add_argument("--rescreen", action="store_true", help="Include rows that were screened before.")
    parser.add_argument("--report", action="store_true", help="Count what is in the table and stop.")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    configure_logging(args.verbose)
    month, day = parse_date(args.date)

    try:
        if args.report:
            report(month, day)
            return 0
        summary = run(month, day, args.limit, args.workers, args.apply, args.rescreen)
    except KeyboardInterrupt:
        log.warning("Interrupted. Nothing partial was written unless --apply had already finished a chunk.")
        return 130

    return 1 if summary.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
