# Brief: the first impression on a date page

A handoff written 8 September 2026 for a fresh session with no memory of this
project. Everything you need is here. Read it all before designing anything.

---

## 1. What you are being asked to do

Redesign what a stranger sees in the first screen of a date page on
birthed.app, so that it is immediately obvious what the site is, that it is a
live thing with a clock on it, and that it is worth taking part in **today**.

It has to work with zero users. That is the hard part and it is the whole
brief. Everything below is context so you can solve that honestly rather than
by faking activity.

## 2. What the site is, in five lines

An index of every calendar date. Each page carries who was born that day, what
happened on it, and what was number one the week it fell.

Underneath that is the thing nobody else has. **Every date opens for three days
a year and takes answers about what people actually remember of it, then seals
until next year.** Every row on the page asks one question, do you remember
this, with three answers and no way to say a thing did not matter. When a date
seals, the page reorders itself so the rows its own people remembered rise to
the top, and that order is frozen.

The sentence that decides arguments: **Wikipedia records what happened, Birthed
records what stuck.**

## 3. The exact problem

Right now the first screen is: the wordmark, a date stepper, three chips
reading Yesterday, Today and Tomorrow, the words BORN ON, the date at sixty
point, three pretty cards, then a heading called "What came out".

It is handsome and it is inert. A stranger cannot tell from it that anything is
happening, that there is a clock, that they are meant to do something, or that
this page will be different next year. The three chips are the only trace of
the mechanic and they read as navigation.

Two people have looked at it cold and both said the same thing in different
words: it reads as a database with a nice skin. One of them called it "a lame
database wrapper". They are right.

## 4. The constraint that shapes everything: no script

**This site runs no JavaScript at all.** The Content Security Policy is
`default-src 'none'`. One page, `/add`, is the single exception and it has its
own policy. Everything else is HTML and CSS.

This is not a limitation to route around. It is the strongest claim the privacy
page makes and it has already cost the project one outage when somebody
loosened it by accident, so it stays.

What that leaves you, and all of it is already used somewhere on the site:

- `:target`, which reveals one of several sentences after a form posts
- radio inputs plus `:checked` and a sibling selector, which is how the year
  dial and the new birth-year picker work
- `<details>` and `<summary>`
- forms that post and redirect
- CSS animation, transforms, gradients, `@media`, `@supports`
- a per-request stylesheet: `today.css` is generated on every request and is
  the only thing on the site that knows what day it is. It is how the answer
  buttons appear on the three open dates and nowhere else. **You can put
  anything you like in it.**

What you do not have: any client-side state, any fetch, any counter that ticks,
any live update.

## 5. The other constraint: the pages are baked

Every one of the 366 date pages is rendered at build time and served off disk
by a small Node process that holds no database connection. A Supabase outage
cannot take the site down, and that property is deliberate.

Two requests are exceptions and both follow an answer: the POST that records
one, and the single redirected GET that draws the result. Nothing a reader
reaches by browsing calls a database.

So: anything that varies per reader must come from `today.css`, from `:target`,
from a cookie the server reads on a POST, or from the build.

## 6. What you actually have to work with

Real numbers from the live database today.

| Material | Amount |
|---|---|
| Notable people | 25,741, about **71 per date**, from Wikidata |
| Wikipedia events shown | 11,434, about **31 per date** |
| Wikipedia events suppressed as too grim | 8,300 |
| Researched facts about specific dates | 3,089 |
| Chart weeks, number one songs and films | 11,014 |
| Chart weeks **with cover art already downloaded** | 4,295 |
| Curated internet-culture rows, published | 341 |
| Curated rows waiting for review | 53 |

Faces for people are downloaded and served from the site's own origin. Album
and film artwork likewise. **There is a lot of imagery available and the
current first screen uses three pieces of it.**

## 7. The rules you cannot break

These are not preferences. Each one exists because of something that already
went wrong or was already argued out.

**No votes and no direction, ever.** There are three answers, "I remember it",
"Heard of it", "Never heard of it". There is no upvote, no downvote, no score,
no leaderboard, no streak, no badge, no reputation. A direction is a weapon:
this site carries September 11, the 1973 Chile coup and the Birmingham church
bombing, and an up and down score on any of them is a brigading target inside a
week. Nothing you design may let a crowd push a row off a page.

**A budget, not a score.** A reader gets ten answers per date per year. That is
scarcity, so each answer is a decision. It is not a score: spending all ten
earns nothing and spending none costs nothing.

**Every row cites a page that says what the row says.** Nothing is generated by
a model at read time. If your design implies content the site does not have,
the site does not get to invent it.

**Every date has at least one atrocity on it.** 41 percent of the imported
Wikipedia events match the project's own "heavy" screen, which is why 8,300 are
suppressed. Whatever you put at the top of a page must not be capable of
setting a mass casualty in celebratory type on somebody's birthday. There is an
existing rule that keeps a heavy row out of the lead position; respect it.

**No em dashes anywhere.** Commas, colons or separate sentences. Plain words, a
seventh grade reading level, and no explaining the joke.

**No fake activity.** Do not invent counts, do not show "47 people are here" if
nobody is, do not fabricate a leaderboard of dates. The site's only asset is
that it does not lie, and a cold start that lies about being warm is worse than
one that is honestly empty.

## 8. The cold start, said plainly

Today there are three answers in the whole database and they are all the
developer's. September 7 will be the first date ever to seal, and it will seal
with almost nothing on it.

So a design that only comes alive once people arrive is not a solution, because
nobody arrives at a page that looks dead. You have to make the mechanic legible
and appealing **from the materials the page already has**: seventy one people,
thirty one events, a number one song and film for most years since 1958, cover
art for four thousand of those weeks, and a clock that really is running.

The honest raw material for urgency is real: this date is open for three days
and then it is shut for a year. That is true today with zero users. Nothing
about it requires anybody else to be there.

## 9. What good would look like

You are not being asked for a "bento grid" or a "newspaper front page",
although either might be the answer. You are being asked to solve this:

A person lands on birthed.app/september-8/ having never heard of it. Within
about four seconds they should understand that this page is open right now,
that it closes, that what they do here changes what the page becomes, and that
the thing being collected is memory rather than facts. They should want to
answer one row before they scroll.

Better than the brief is welcome. If the answer is that the three chips should
become the loudest thing on the page, say so. If the answer is that the date
itself should carry the countdown, say so. If you think the whole framing is
wrong, say that, and say why.

## 10. Where the code is

- `web/src/render.ts` renders a date page. `openingBand` is the three cards,
  `feedSection` is the list, and the stylesheet is a template literal near the
  top of the same file.
- `web/src/serve.ts` serves it, and `todayStylesheet` is the per-request CSS
  that knows the date.
- `web/src/pages.ts` is the about page, which was rewritten to explain the
  mechanic and is worth reading for the voice.
- `docs/internet-culture.md` is the content bar.
- `docs/app-handoff.md` is why the remembering loop exists at all.

Deliver whatever is most useful: a written proposal, marked up HTML and CSS, or
both. If it is code it must build with no JavaScript and no new dependencies.
