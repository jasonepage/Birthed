# Scan a day

What a scan is allowed to do, the prompt it runs, and the one rule that keeps
this from being a wrapper with a nice font.

---

## 1. The rule

**A scan writes only to `day_scans`.** It never sets `verified`, never sets
`status`, never deletes anything, never puts a word on a page. It produces
arguments. A curator reads one, agrees or does not, and presses a key. The
keypress is the only thing that moves a row.

That is the whole difference. A wrapper is prompt in, content out, published.
Here the model is a colleague with opinions and no hands.

The second half matters as much: **the verdicts are kept, including the ones
that were overruled.** A model that calls forty rows boring and loses thirty
eight of those arguments has a bad prompt, not bad luck, and that is invisible
unless the disagreements are written down. `day_scans.agreed` is the record.
It is the same reason rejected culture rows are kept.

## 2. What it is asked to do

Two jobs on one date, in one call.

**Audit what is there.** Every culture row, found fact and Wikipedia line
currently on the page, judged against the rules already written down, with one
verdict and one sentence each.

**Say what is missing.** The thing the date is short of, proposed in the site's
own voice, with a source, ready for a curator to accept as is.

## 3. The verdicts

One word each, and each one names a rule rather than a feeling.

| Verdict | Means |
|---|---|
| `keep` | Earns its place. Say why in one clause. |
| `release` | A release calendar entry. `docs/internet-culture.md` calls this the filler the site exists to replace. |
| `encyclopedia` | Could sit on a Wikipedia date page unnoticed. That is the differentiator test and this row fails it. |
| `thin` | True, and nobody wrote it. "Streamers went dark for a day over hate raids." |
| `explains` | Says why it mattered instead of saying what happened. |
| `wrong_date` | The date is a spread or a guess dressed as a day. |
| `unsourced` | Nothing to check it against, or the cited page does not say this. |
| `heavy` | Real and serious. Never a card, and a person decides whether it is on the page at all. |
| `missing` | Not a row here yet, and should be. Carries a proposal. |

No score anywhere. A number would be a thing a curator has to trust; a sentence
is a thing they can disagree with.

## 4. The test that separates top tier from fine

The hard part is not spotting junk. It is telling a good row from a great one,
and "would people like this" is exactly the question a model answers with slop.
So it is asked something concrete instead.

**Does the thing have an afterlife?** Not "was it big at the time". Did people
keep bringing it up. Evidence a model can actually point at:

- somebody made a Know Your Meme entry for it
- it gets posted again on its anniversary
- there are jokes that assume you know it, years later
- people argue about the details
- it has a name people use as shorthand

Pizza Rat has all five. "Android Pay is released" has none. Both are true, both
are dated, both are sourced, and only one of them is a row.

The second test, applied out loud: **would somebody who was there say "oh my
god I remember that", or would they say "huh, neat"?** Neat is not enough. Neat
is what the whole internet already has.

## 5. The prompt

The scan sends this, with the date's current rows appended. It is written down
here rather than living only in a function, because the prompt is the product
and it should be arguable in a pull request.

> You are helping curate one date on a site that records what people remember,
> not what happened. Wikipedia already records what happened.
>
> The reader is a person who landed on their own birthday. They are usually
> under forty. They will decide in about four seconds whether this site is real
> or whether it is a database with a nice font.
>
> Two jobs.
>
> **One. Judge every row I give you.** For each, return one verdict from this
> list and one sentence saying why, addressed to a curator who will overrule
> you if you are wrong: keep, release, encyclopedia, thin, explains,
> wrong_date, unsourced, heavy.
>
> A row is a `release` if it is a film opening, a record coming out, a single, a
> tour, a trailer or an awards show. A game, console or app shipping is not
> automatically a release: it is one if nothing is said about it beyond the
> name. "Mini Ninjas is released" is a release. "Toby Fox released it on Steam.
> Sans has not left the internet since" is not.
>
> A row is `encyclopedia` if the sentence could sit on a Wikipedia date page
> without looking out of place. That is the whole differentiator and it is the
> most common failure.
>
> A row is `thin` if it is true and nobody wrote it. Two sentences is the shape.
>
> **Two. Say what this date is missing.** Not by searching the date, which finds
> nothing, because no page on the web is organised by date the way this site is.
> Search your memory instead: think of things people bring up unprompted, work
> out which of them fall on this date, then find a page published within days of
> it that says so.
>
> For each proposal give a title, two sentences in the voice below, the year,
> and a source URL whose own address or dateline carries the date. If you cannot
> find such a page, do not propose it. Absent beats wrong, always.
>
> Prefer things with an afterlife: people still post it on the anniversary,
> there are jokes that assume you know it, somebody wrote it up years later,
> people argue about the details. Big at the time is not the same as remembered.
>
> The voice: name the thing, say what happened, stop. Do not explain why it
> mattered. Do not say iconic, viral sensation, cultural phenomenon, went on to,
> or paved the way. A reader who was there does not need it explained and a
> reader who was not is better served by the link. No dashes.
>
> Good, all real rows from this site:
> - "A rat dragged a slice of pizza down the stairs at First Avenue station.
>   Matt Little filmed it and posted it before lunch."
> - "Team Salvato put a free dating sim on itch.io. It was not a dating sim."
> - "Rogan passed him a joint on a livestream. The still frame became a reaction
>   image for the next decade."
>
> Bad, also real rows from this site:
> - "Streamers went dark for a day over hate raids." Thin. True and nobody wrote
>   it.
> - "Mini Ninjas is released." A release calendar entry.
> - "Georges Méliès released the landmark French silent film A Trip to the Moon,
>   widely recognized as one of the first science fiction films." Explains, and
>   reads like an encyclopedia.
>
> Never propose: a death, an attack, a disaster, a crime or a war as something
> to celebrate. If a date carries one and it is genuinely what people remember,
> return it with the verdict `heavy` and say plainly what it is. A person
> decides. You do not.
>
> Return JSON only.

## 6. What steers it later, and what does not steer it now

The site collects the one signal nobody else has: what real people said they
remembered. Today there are twenty two answers in the whole database, so it
steers nothing, and saying otherwise would be the exact dishonesty this project
was built against.

When there are enough, the loop closes: the model proposes, readers answer, and
the answers say which SHAPES of row get "I remember it" rather than "never heard
of it". That is a real measurement of transmission and no wrapper has one,
because no wrapper asked anybody.

The rule when it does turn on, copied from `docs/what-readers-respond-to.md`:
it is advice appended to the prompt, never a quota, and a real finding of an
unpopular shape beats a stretched one of a popular shape.

## 7. Cost

A scan is one Gemini call with search for the proposals. Comparable to a
culture run: three to nine searches, so roughly eight to twelve cents a date.
Scanning all 366 is around forty dollars and it should be run a month at a time
with the count checked against `fact_search_budget` first, per the standing
rule after the forty dollar night.

## 8. Still to build

The table, the panel surface and this prompt are done. The edge function is
not: it needs writing against the same shape as `find-culture`, deploying with
`supabase functions deploy scan-day`, and one run on a date somebody already
knows well before it is pointed at a month.

Its contract, so it can be written without reading this whole file:

- **POST** `{ month, day }`, service role key, verify_jwt on, is_admin checked.
- Loads every published culture row, verified fact and unsuppressed Wikipedia
  line for that date.
- Sends section 5 with those rows appended.
- Writes one `day_scans` row per verdict, `scanned_by` naming the model and the
  prompt version.
- Writes nothing anywhere else. Ever.
