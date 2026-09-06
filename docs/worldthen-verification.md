# WorldThen, checked against real pages

September 6, 2026. Test pass item 47, closed.

All 101 dated rows in `Birthed/Domain/WorldThen.swift` were checked against
pages that actually state the day, one quoted sentence per row. This replaces
the five row spot check the item originally asked for.

Every earlier session that touched this file had no route to the web, so the
dates were written from memory. That is what the item existed to catch.

## The rule, now written down

**Every date is a United States release date.** The sentence this data writes
is about the reader's world rather than about the object. "Pokemon was on
Generation 1 the day you were born" is a claim about what a child could have
been holding, so the date has to be the day the thing arrived where they were.

## What was found

| Timeline | Rows | Wrong |
| --- | --- | --- |
| Fortnite | 32 | 0 |
| Minecraft | 27 | 0 |
| iPhone | 19 | 0 |
| Pokemon | 9 | 5 |
| PlayStation | 5 | 3 |
| Arrivals | 9 | 1 corrected, 3 open |

Eleven rows were wrong and every one of them was a real date. That is why
nothing caught them: they were correct answers to a different question.

## Corrected

| Row | Was | Now | What the old date was |
| --- | --- | --- | --- |
| Pokemon Generation 1 | 1996-02-27 | 1998-09-28 | Red and Green, Japan only. The United States got Red and Blue. |
| Pokemon Generation 2 | 1999-11-21 | 2000-10-15 | Japan |
| Pokemon Generation 3 | 2002-11-21 | 2003-03-19 | Japan |
| Pokemon Generation 4 | 2006-09-28 | 2007-04-22 | Japan |
| Pokemon Generation 5 | 2010-09-18 | 2011-03-06 | Japan |
| original PlayStation | 1994-12-03 | 1995-09-09 | Japan |
| PlayStation 2 | 2000-03-04 | 2000-10-26 | Japan |
| PlayStation 3 | 2006-11-11 | 2006-11-17 | Japan |
| Spotify | 2008-10-07 | 2011-07-14 | Sweden and a few European markets. Spotify was not usable in the United States until 2011. |

Pokemon X and Y onward launched worldwide on one day, so generations 6 to 9
were already right and there was no choice to make.

## Still open, and deliberately not changed

These three are not regional staggers, so the rule above does not settle them.
They are a different question: whether an arrival date means the day a thing
began or the day an ordinary person could use it.

- **Facebook, 2004-02-04.** That is the Harvard-only launch. Anyone with an
  email address could join on 2006-09-26. Every source in the world gives
  February 2004 as Facebook's birthday, so changing it would make the app
  disagree with the reader's own intuition.
- **YouTube, 2005-02-14.** That is the day the domain record was created.
  Nothing existed to use until the open beta on 2005-04-23.
- **Google, 1998-09-04.** That is the incorporation of the company. Search was
  publicly reachable from Stanford in 1996 and google.com was still labelled
  beta after this date, so no source gives a clean availability day.

Discord, 2015-05-13, was checked and kept. Wikipedia gives it as the release
date; a fan wiki puts a public beta at 2015-03-06.

## What was not checked

`knownThrough` on the Fortnite and Minecraft timelines is late 2024, so
anybody born after that gets no line from those two. Nobody has a birthday in
the future, so this only matters for babies, and it will matter more every
year. Not a correctness problem, a freshness one.
