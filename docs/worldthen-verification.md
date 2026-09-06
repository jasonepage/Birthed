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

---

# Two console timelines added, September 6, 2026

Nintendo home consoles and Xbox. Twelve rows, each checked against the
console's own Wikipedia article and its infobox release field, which breaks
the date out by region. The rule is unchanged and is the reason this was
checked rather than written: **every date is a United States release date.**

| Console | Date used | Source |
|---|---|---|
| Nintendo Entertainment System | September 27, 1986 | en.wikipedia.org/wiki/Nintendo_Entertainment_System |
| Super Nintendo | August 23, 1991 | en.wikipedia.org/wiki/Super_Nintendo_Entertainment_System |
| Nintendo 64 | September 29, 1996 | en.wikipedia.org/wiki/Nintendo_64 |
| GameCube | November 18, 2001 | en.wikipedia.org/wiki/GameCube |
| Wii | November 19, 2006 | en.wikipedia.org/wiki/Wii |
| Wii U | November 18, 2012 | en.wikipedia.org/wiki/Wii_U |
| Switch | March 3, 2017 | en.wikipedia.org/wiki/Nintendo_Switch |
| Switch 2 | June 5, 2025 | en.wikipedia.org/wiki/Nintendo_Switch_2 |
| Xbox | November 15, 2001 | en.wikipedia.org/wiki/Xbox_(console) |
| Xbox 360 | November 22, 2005 | en.wikipedia.org/wiki/Xbox_360 |
| Xbox One | November 22, 2013 | en.wikipedia.org/wiki/Xbox_One |
| Xbox Series X and S | November 10, 2020 | en.wikipedia.org/wiki/Xbox_Series_X_and_Series_S |

## The two rows that were a decision rather than a copy

**The Nintendo Entertainment System is September 27, 1986, not October 18,
1985.** Both dates are real, both are on the same page, and the infobox holds
the earlier one. October 18, 1985 is a test market in New York City alone,
followed by Los Angeles in February 1986, and the body of the article calls
September 27, 1986 the full North American release. Eleven months apart.

This is the same argument that found eleven wrong dates in September: the
question is not "is this a real release date", it is "is this the date this
reader's world changed". A shop in one city for eleven months was not most
readers' world. The cost is that this row is now wrong for a New Yorker born
in early 1986, and the alternative was being wrong for everybody outside New
York. `WorldThenTests` asserts the gap directly, so a change back to the test
market date fails a test that says why.

**The Nintendo 64 is September 29, 1996, and the page disagrees with itself.**
The infobox says September 29. The body says it was first sold in North
America on September 26 "though having been advertised for the 29th". The
29th is what was advertised and therefore what almost everybody experienced,
so it is the one in the file. A reader born on September 27 or 28, 1996 sits
inside the disagreement and there is no answer that is right for them.

## Where a Japanese date would have been wrong

These are the rows where the United States and Japan differ by more than a
month, which is the shape every one of the eight bad rows took last time.
`WorldThenTests` pins three of them with the sentence a reader would see.

- Nintendo Entertainment System: Japan July 15, 1983, United States full
  release September 27, 1986. Over three years.
- Super Nintendo: Japan November 21, 1990, United States August 23, 1991.
- Nintendo 64: Japan June 23, 1996, United States September 29, 1996.
- GameCube: Japan September 14, 2001, United States November 18, 2001.
- Xbox: United States November 15, 2001, Japan February 22, 2002. This one
  runs the other way, and so do the Wii, the Wii U and the Xbox One.

## No regional line to get wrong

The Switch, the Switch 2 and the Xbox Series X and S launched worldwide on a
single day, so their articles give one date rather than a regional breakdown.
Those three are stated, not inferred, and there is no second date to confuse
them with.
