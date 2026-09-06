#!/usr/bin/env python3
"""Cultural event ingestion for Birthed.

Reads structured cultural milestone events from a source, puts every one of
them past a content check run by a Claude model, and writes only the ones that
pass into the Supabase table cultural_events.

The three stages are deliberately separate functions with no knowledge of each
other, so that any one of them can be replaced without touching the other two.
Today the source is a checked in file. Tomorrow it can be a web application
programming interface, or a scraper, and nothing downstream changes.

Run it:

    python3 ingestion_agent.py --dry-run       reads and checks, writes nothing
    python3 ingestion_agent.py                 reads, checks, writes
    python3 ingestion_agent.py --limit 3       the first three events only

Environment variables are read from ingestion/.env, or from the real
environment if that file is absent. See .env.example.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterable

import requests

if TYPE_CHECKING:  # imported for the type name only, never at runtime
    from supabase import Client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent

#: The categories the database enumerated type will accept. Anything else is a
#: row the interface has no way to draw, so it is rejected before it is sent.
VALID_CATEGORIES = ("tech", "gaming", "meme", "music", "cinema")

TABLE_NAME = "cultural_events"

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_VERSION = "2023-06-01"

#: The fast, inexpensive Claude model. Overridable with VIBE_CHECK_MODEL.
#: If you want the literal Claude 3 Haiku from 2024, that identifier is
#: "claude-3-haiku-20240307". The newer small model is both cheaper and better
#: at following a two word instruction, which is the whole job here.
DEFAULT_VIBE_CHECK_MODEL = "claude-haiku-4-5"

#: The content check. Written to make the model produce one word and nothing
#: else, because the caller treats any other answer as a rejection.
VIBE_CHECK_SYSTEM_PROMPT = """\
You are a content safety reviewer for a lighthearted birthday app. The app \
shows people the pop culture moments that happened on their birthday, so \
every event it displays has to be something a person would enjoy reading on \
their own birthday morning.

You will be given one historical event. Judge only that event.

Reply REJECT if the event involves any of the following:
- violence of any kind, including war, terrorism, assassination, or crime
- a natural disaster, an accident, or a crash
- deaths, casualties, injuries, or a person dying
- heavy political controversy, an election dispute, a scandal, or a protest
- discrimination, hate, or persecution of a group of people
- anything a reasonable person would find upsetting or sombre

Reply ACCEPT if the event is none of those things: a product launch, a game \
release, a film or album, a piece of internet culture, a technical milestone, \
or another cheerful moment.

Answer with exactly one word, either ACCEPT or REJECT. Write no explanation, \
no punctuation, and no other text.\
"""

log = logging.getLogger("ingest")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Config:
    """Everything the run needs from the environment."""

    supabase_url: str
    service_role_key: str
    anthropic_api_key: str
    vibe_check_model: str
    source_url: str | None
    source_file: Path
    request_timeout_seconds: int
    max_retries: int


def load_dotenv(path: Path) -> None:
    """Populate os.environ from a simple key equals value file.

    Written out by hand rather than adding a dependency, and it never
    overwrites a variable that is already set, so a value exported in the
    shell always wins over the file.
    """
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(
            f"Missing environment variable {name}. "
            f"Copy ingestion/.env.example to ingestion/.env and fill it in."
        )
    return value


def load_config(needs_write: bool) -> Config:
    """Read the environment.

    A dry run writes nothing and calls no model, so it asks for neither the
    service role key nor the Anthropic key. Demanding credentials before
    somebody is allowed to look at what the source returns is a good way to
    make nobody look.
    """
    load_dotenv(HERE / ".env")

    def optional(name: str) -> str:
        return os.environ.get(name, "").strip()

    return Config(
        supabase_url=(_required("SUPABASE_URL") if needs_write else optional("SUPABASE_URL")).rstrip("/"),
        service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY") if needs_write else optional("SUPABASE_SERVICE_ROLE_KEY"),
        anthropic_api_key=_required("ANTHROPIC_API_KEY") if needs_write else optional("ANTHROPIC_API_KEY"),
        vibe_check_model=optional("VIBE_CHECK_MODEL") or DEFAULT_VIBE_CHECK_MODEL,
        source_url=optional("INGEST_SOURCE_URL") or None,
        source_file=HERE / (optional("INGEST_SOURCE_FILE") or "seed_events.json"),
        request_timeout_seconds=int(optional("REQUEST_TIMEOUT_SECONDS") or "30"),
        max_retries=int(optional("MAX_RETRIES") or "4"),
    )


# ---------------------------------------------------------------------------
# The event, and reading it safely
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CulturalEvent:
    """One milestone, validated, in the shape the database column expects."""

    event_date: date
    category: str
    event_title: str
    context_string: str
    source_url: str | None = None

    @property
    def label(self) -> str:
        """A short line for the log."""
        return f"{self.event_date.isoformat()} [{self.category}] {self.event_title}"

    def as_row(self, vibe_model: str) -> dict[str, Any]:
        """The dictionary sent to Supabase. Dates go over as text, in the one
        format Postgres reads the same way in every locale."""
        return {
            "event_date": self.event_date.isoformat(),
            "category": self.category,
            "event_title": self.event_title,
            "context_string": self.context_string,
            "source_url": self.source_url,
            "vibe_model": vibe_model,
            "vibe_passed_at": datetime.now(timezone.utc).isoformat(),
        }


class InvalidEvent(ValueError):
    """A record from the source that cannot become a row."""


class PermanentApiError(RuntimeError):
    """The API refused in a way that retrying cannot fix.

    Separate from a timeout so a caller can stop the whole run on the first
    one instead of failing the same way once per row.
    """


def parse_event(raw: Any) -> CulturalEvent:
    """Turn one record from the source into a CulturalEvent, or raise.

    Everything is checked here rather than at the database, because a batch
    that fails halfway through on the ninth row has already written eight.
    """
    if not isinstance(raw, dict):
        raise InvalidEvent(f"expected an object, got {type(raw).__name__}")

    missing = [k for k in ("event_date", "category", "event_title", "context_string") if not raw.get(k)]
    if missing:
        raise InvalidEvent(f"missing or empty: {', '.join(missing)}")

    raw_date = str(raw["event_date"]).strip()
    try:
        # Parsed by hand in one fixed format rather than with a loose parser,
        # so that a malformed date is an error instead of a guess.
        parsed_date = date.fromisoformat(raw_date)
    except ValueError as exc:
        raise InvalidEvent(f"event_date is not a yyyy-mm-dd date: {raw_date!r}") from exc

    category = str(raw["category"]).strip().lower()
    if category not in VALID_CATEGORIES:
        raise InvalidEvent(
            f"category {category!r} is not one of {', '.join(VALID_CATEGORIES)}"
        )

    title = str(raw["event_title"]).strip()
    if len(title) > 200:
        raise InvalidEvent(f"event_title is {len(title)} characters, the column holds 200")

    source_url = str(raw.get("source_url") or "").strip() or None

    return CulturalEvent(
        event_date=parsed_date,
        category=category,
        event_title=title,
        context_string=str(raw["context_string"]).strip(),
        source_url=source_url,
    )


# ---------------------------------------------------------------------------
# Stage one: the source
# ---------------------------------------------------------------------------


def fetch_events(config: Config) -> list[CulturalEvent]:
    """Read the structured source and return the events that are well formed.

    Two paths, one shape. If INGEST_SOURCE_URL is set the records are fetched
    over the network with requests. If it is not, they are read from the
    checked in file. Both hand back the same list, so the rest of the pipeline
    cannot tell which one ran.
    """
    if config.source_url:
        log.info("Source: %s", config.source_url)
        response = requests.get(
            config.source_url,
            timeout=config.request_timeout_seconds,
            headers={"User-Agent": "Birthed-ingestion/0.1 (https://birthed.app)"},
        )
        response.raise_for_status()
        payload = response.json()
    else:
        log.info("Source: %s", config.source_file)
        if not config.source_file.exists():
            raise SystemExit(f"Source file not found: {config.source_file}")
        payload = json.loads(config.source_file.read_text(encoding="utf-8"))

    # Accept either a bare list or an object with an "events" key, because a
    # real application programming interface will hand back one or the other
    # and neither is worth a code change.
    records: Iterable[Any]
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and isinstance(payload.get("events"), list):
        records = payload["events"]
    else:
        raise SystemExit("Source returned neither a list nor an object with an events list")

    events: list[CulturalEvent] = []
    for index, record in enumerate(records, start=1):
        try:
            events.append(parse_event(record))
        except InvalidEvent as exc:
            log.warning("  record %d skipped, %s", index, exc)

    log.info("Read %d well formed event(s) from the source", len(events))
    return events


# ---------------------------------------------------------------------------
# Stage two: the content check
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Verdict:
    """What the model said, and what that means."""

    accepted: bool
    raw_answer: str
    model: str

    @property
    def word(self) -> str:
        return "ACCEPT" if self.accepted else "REJECT"


def _call_anthropic(config: Config, user_text: str, cache_system: bool = False) -> str:
    """One message to the Anthropic interface, with retries. Returns the text.

    Retries only on a rate limit or a server error, which are the two failures
    that go away on their own. A bad request or a bad key is raised straight
    away, because trying it four more times only wastes four more seconds.
    """
    body = {
        "model": config.vibe_check_model,
        "max_tokens": 8,
        # Zero, so that the same event gets the same verdict every run. A
        # content check that changes its mind is not a check.
        "temperature": 0,
        # The system prompt is identical on every call. Marking it cacheable
        # means it is billed at a fraction after the first call, which matters
        # when the caller is screening twenty thousand rows rather than ten.
        "system": (
            [{"type": "text", "text": VIBE_CHECK_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]
            if cache_system
            else VIBE_CHECK_SYSTEM_PROMPT
        ),
        "messages": [{"role": "user", "content": user_text}],
    }
    headers = {
        "x-api-key": config.anthropic_api_key,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
    }

    last_error: Exception | None = None
    for attempt in range(1, config.max_retries + 1):
        try:
            response = requests.post(
                ANTHROPIC_MESSAGES_URL,
                headers=headers,
                json=body,
                timeout=config.request_timeout_seconds,
            )
        except requests.RequestException as exc:
            # No reply at all: a timeout, a dropped connection, no network.
            # These do go away on their own, so they are the ones worth waiting
            # on.
            last_error = exc
            wait = 2 ** attempt
            log.warning(
                "  could not reach the model (%s), waiting %d second(s) then retrying (%d of %d)",
                exc, wait, attempt, config.max_retries,
            )
            time.sleep(wait)
            continue

        if response.status_code == 429 or response.status_code >= 500:
            wait = 2 ** attempt
            log.warning(
                "  model returned %d, waiting %d second(s) then retrying (%d of %d)",
                response.status_code, wait, attempt, config.max_retries,
            )
            time.sleep(wait)
            continue

        if response.status_code >= 400:
            # A permanent refusal: a bad key, a model name that does not exist,
            # a malformed request, an exhausted credit balance. Retrying is
            # guaranteed to fail again, and at twelve workers with four
            # retries each it fails again eight thousand times while looking
            # busy. So this raises on the first one.
            #
            # The body is included because it is the only part that says what
            # is actually wrong. An earlier version logged the status code
            # alone, which turned "your credit balance is too low" into an
            # anonymous 400 and cost an hour.
            raise PermanentApiError(
                f"The model refused the request with {response.status_code} "
                f"and this is not worth retrying. The API said: {response.text.strip()[:400]}"
            )

        payload = response.json()
        parts = payload.get("content") or []
        text = "".join(part.get("text", "") for part in parts if part.get("type") == "text")
        return text.strip()

    raise RuntimeError(f"The model could not be reached after {config.max_retries} attempts: {last_error}")


def vibe_check(config: Config, event: CulturalEvent) -> Verdict:
    """Ask the model whether this event belongs in a birthday app.

    This function fails closed. The only answer that lets a row through is the
    single word ACCEPT. A refusal, an explanation, an empty answer, or anything
    the model says while being helpful is treated as a rejection, because the
    cost of dropping one cheerful event is a missing row and the cost of
    passing one grim event is a person reading about a plane crash on their
    birthday.
    """
    user_text = (
        f"Date: {event.event_date.isoformat()}\n"
        f"Category: {event.category}\n"
        f"Title: {event.event_title}\n"
        f"Description: {event.context_string}"
    )
    answer = _call_anthropic(config, user_text)
    normalised = answer.strip().strip(".").upper()
    accepted = normalised == "ACCEPT"

    if not accepted and normalised != "REJECT":
        log.warning("  the model did not answer with one word, treating as REJECT: %r", answer)

    return Verdict(accepted=accepted, raw_answer=answer, model=config.vibe_check_model)


# ---------------------------------------------------------------------------
# Stage three: the database
# ---------------------------------------------------------------------------


def connect(config: Config) -> "Client":
    """Open the Supabase connection with the service role key.

    The service role bypasses row level security, which is exactly why this key
    lives here and never in the iOS app target. CLAUDE.md section 9: if it ever
    appears in the app, that is a security incident and not a bug.

    supabase is imported here rather than at the top of the file so that a dry
    run works with nothing installed but requests. Somebody checking what the
    source returns should not have to set up a database client first.
    """
    try:
        from supabase import create_client
    except ImportError as exc:
        raise SystemExit(
            "The supabase package is not installed. Run: pip install -r requirements.txt"
        ) from exc
    return create_client(config.supabase_url, config.service_role_key)


def insert_event(client: "Client", event: CulturalEvent, vibe_model: str) -> None:
    """Write one accepted event.

    An upsert on the natural key of date and title, so that running the whole
    pipeline again corrects rows rather than doubling them. The migration
    declares that pair unique, which is what makes this safe.
    """
    client.table(TABLE_NAME).upsert(
        event.as_row(vibe_model),
        on_conflict="event_date,event_title",
    ).execute()


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------


@dataclass
class Tally:
    read: int = 0
    accepted: int = 0
    rejected: int = 0
    written: int = 0
    failed: int = 0


def run(limit: int | None, dry_run: bool) -> Tally:
    config = load_config(needs_write=not dry_run)
    tally = Tally()

    log.info("Birthed cultural event ingestion")
    log.info("Model: %s", config.vibe_check_model)
    log.info("Mode:  %s", "dry run, nothing will be written" if dry_run else "live, accepted events will be written")
    log.info("-" * 68)

    events = fetch_events(config)
    if limit is not None:
        events = events[:limit]
        log.info("Limited to the first %d event(s)", len(events))
    tally.read = len(events)

    if dry_run:
        log.info("-" * 68)
        for event in events:
            log.info("WOULD CHECK  %s", event.label)
        log.info("-" * 68)
        log.info("Dry run finished. %d event(s) read, no model called, nothing written.", tally.read)
        return tally

    client = connect(config)
    log.info("Connected to %s", config.supabase_url)
    log.info("-" * 68)

    for position, event in enumerate(events, start=1):
        log.info("[%d/%d] %s", position, tally.read, event.label)
        try:
            verdict = vibe_check(config, event)
        except Exception as exc:  # the model was unreachable, or answered with nonsense
            tally.failed += 1
            log.error("  CHECK FAILED  %s", exc)
            continue

        if not verdict.accepted:
            tally.rejected += 1
            log.info("  REJECTED      the content check declined this event")
            continue

        tally.accepted += 1
        log.info("  ACCEPTED")

        try:
            insert_event(client, event, verdict.model)
            tally.written += 1
            log.info("  WRITTEN       %s", TABLE_NAME)
        except Exception as exc:
            tally.failed += 1
            log.error("  WRITE FAILED  %s", exc)

    log.info("-" * 68)
    log.info(
        "Finished. read %d, accepted %d, rejected %d, written %d, failed %d",
        tally.read, tally.accepted, tally.rejected, tally.written, tally.failed,
    )
    return tally


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s  %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read cultural milestone events, check them, and write the ones that pass into Supabase.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read and validate the source and stop. Calls no model and writes nothing.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process only the first N events. Useful for a first live run.",
    )
    parser.add_argument("--verbose", action="store_true", help="Debug level logging.")
    args = parser.parse_args()

    configure_logging(args.verbose)

    try:
        tally = run(limit=args.limit, dry_run=args.dry_run)
    except KeyboardInterrupt:
        log.warning("Interrupted.")
        return 130

    # A non zero exit if anything failed, so a scheduled run shows up as failed
    # rather than quietly doing nothing.
    return 1 if tally.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
