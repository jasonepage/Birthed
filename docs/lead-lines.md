# Lead lines

The one sentence a person writes for a card, what makes it good, and what it
may never do. Read `docs/internet-culture.md` first for the voice; this is the
same voice applied to one sentence at the top of a page.

---

## 1. What a lead line is

The site asks one question above the fold: do you remember this one. The row it
asks about is chosen by a scorer, and the words it asks in are, unless somebody
writes better ones, whatever sentence that row already had.

A lead line is those better words. It is stored in `lead_lines`, keyed to one
row by the same subject kind and id the answer forms carry, and the card sets
it as the question with the row's own sentence printed underneath.

It is not a correction. It is not a new claim. It does not touch the feed. The
row keeps its sentence and its source and the feed still prints them.

## 2. Why a person has to do this

On 8 September 2026 the scorer was measured against the live page. Two rows
from 1966, both sourced, both outside the window it prefers:

> The science fiction television series Star Trek made its broadcast television
> debut in the United States on NBC with the episode The Man Trap.

> UNESCO proclaimed International Literacy Day to highlight the importance of
> literacy for people and communities globally.

It takes Literacy Day, because that sentence is eighteen characters shorter.
Nothing measurable about the two says which one anybody remembers. Every
constant that would fix this one date breaks another. This is a judgement, and
the table exists to hold judgements.

## 3. The five rules

**One. Say the thing, then stop.** The card is read in about a second.

> Bad: "The science fiction television series Star Trek made its broadcast
> television debut in the United States on NBC with the episode The Man Trap."
>
> Good: "Star Trek went out for the first time."

**Two. Write it as a person would say it out loud.** Not a headline, not a
caption, not an encyclopedia. If you would not say the sentence to somebody in
a kitchen, rewrite it.

> Bad: "Mark McGwire records his 62nd home run, surpassing the single season
> mark established in 1961."
>
> Good: "McGwire hit his 62nd, and broke a record that had stood since 1961."

**Three. Never add a fact that is not in the row.** The sentence under it is
what the line is checked against, and a line saying more than the record says
is the site doing the one thing it promises not to do. If the row does not say
where, do not write where.

**Four. Do not explain why it mattered.** A reader who was there does not need
it, and a reader who was not is not going to be argued into a memory. The
question is whether it reaches them, and telling them it should have is how you
get "never heard of it" from somebody who did remember.

> Bad: "Star Trek went out for the first time, changing science fiction
> forever."

**Five. No dates in the line.** The card already prints the year in
thirty point type beside it.

## 4. What may never have one

The word screens read the row's own sentence, always, and a line cannot walk a
row past them. That is enforced in code and there is a test, but it is written
here too because the rule is the point and not the mechanism: a killing does
not get a gentle sentence and a question mark over it. If a row will not take a
line without softening what it was, it does not take a line.

## 5. How many, and in what order

Five per date fills the rotation, so five is the ceiling and one is a real
improvement over none. Write them for the rows a person your age would actually
have a view about. A date where only two rows deserve a line gets two.

Do not write a line to fill a slot. The card falls back to the row's own
sentence and that is a working card; a written line that had nothing to say is
worse than the sentence it replaced.

## 6. Drafts for September 8, for a person to accept or rewrite

Proposals, not rows. Nothing here is in the table. Each is the row's own
sentence, then a suggested line. Cross out what is wrong, rewrite what is
close, and only what a person signs off gets written.

| Year | The row says | Suggested line |
|---|---|---|
| 1966 | The science fiction television series Star Trek made its broadcast television debut in the United States on NBC with the episode The Man Trap. | Star Trek went out for the first time. |
| 1998 | Mark McGwire of the St. Louis Cardinals hit his 62nd home run of the season, breaking the Major League Baseball single-season home run record set by Roger Maris in 1961. | McGwire hit his 62nd, and broke a record that had stood since 1961. |
| 1974 | Watergate scandal: US President Gerald Ford signs the pardon of Richard Nixon for any crimes Nixon may have committed while in office. | Ford pardoned Nixon. |
| 2016 | NASA launched the OSIRIS-REx spacecraft on a mission to travel to asteroid Bennu and collect sample material to return to Earth. | NASA sent something to an asteroid to bring a piece of it back. |
| 1971 | In Washington, D.C., the John F. Kennedy Center for the Performing Arts is inaugurated, with the opening feature being the premiere of Leonard Bernstein's Mass. | The Kennedy Center opened. |

## 7. Writing them

There is no field in the panel yet. `docs/opus-worklist.md` carries it as the
next piece of that tool, and it needs somebody signed in to test, so it is not
a thing to add blind.

Until it exists, a line is one insert:

```sql
insert into lead_lines (subject_kind, subject_id, event_month, event_day, line)
values ('historical_event', '13660', 9, 8, 'Star Trek went out for the first time.');
```

The id is the one in the row's anchor on the page: `r-historical_event-13660`.
