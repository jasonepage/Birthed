# The objections, answered

These are the things people actually said when they first saw Birthed,
mostly in two posts to r/InternetIsBeautiful in September 2026. Each answer
says what is true now, and where the objection was right.

## "It is a way to harvest birthdays."

This was the top comment, and the front door invites it: the first thing
the site asked was "When is your birthday?"

What happens to the answer on the website:

- The month and day only choose which page to send you to. They are not
  written down anywhere. The `/year` handler in `web/src/serve.ts` answers
  the form and redirects.
- A birth year, if you give one, goes into one cookie in your own browser.
  It is not sent to the database. Choosing the blank option deletes it.
- The website has no accounts to put a birthday in.

The iPhone app is different, and says so. It makes a silent anonymous
account on first launch and sends a month, a day and an optional year to it,
because that is how its reminders and counts work. The list of other
people's birthdays you keep in the app never leaves the phone. Only how many
there are is sent.

**Where the objection was right:** asking for a birthday before showing
anything reads as harvesting, whatever the code does. Letting the front door
be today's page, and asking for a year only after somebody already likes it,
is written down in `CLAUDE.md` as the trust fix. It changes the first screen
and has not been built.

## "It is American and entertainment heavy."

It was. People on a date page were ordered by English Wikipedia attention,
which put a teenage footballer above Gandhi on October 2 and Beethoven eighth
on his own birthday.

Since September 22, 2026 a date page is ordered by `world_score`: the square
root of monthly views, times the number of languages with an article about
the person. Attention still counts, so a reader born on May 7 still finds
MrBeast near the top, but one viral English month no longer outweighs four
hundred years in two hundred languages. `CLAUDE.md` section 5, "The ranking",
has the before and after.

**Where the objection is still right:** the import only reached back to
1600 until the same day, so nobody earlier is in the database yet. The floor
is 1400 now, and the import has not been run again.

## "It is just scraped Wikipedia."

The facts are Wikipedia's and Wikidata's, and every row says so and links
to the page it came from. Which record was number one on a date, or who was
born on it, is a fact and cannot be owned.

What Birthed adds is the shape: the date as the thing you visit, everything
with a birthday on that date in one pool, a hive where the people there on
the day decide what mattered, a seal that makes their answer permanent, and
your own age written next to each year.

**Where the objection is right:** the rows are still shown too raw. Whole
encyclopedia sentences sit on tiles at headline size. `docs/editorial-pass.md`
is the plan for that.

## "What stops one person from buzzing a thousand times?"

On the website, a buzz is tied to a random token in a cookie, and a date
gives each token three. A flood of taps from one address is refused before
the database is touched, and there is a test for it. Somebody who clears
their cookies is a new person tomorrow, and that is a known limit, not a
solved problem.

In the iPhone app, every buzz goes through one Edge Function that checks
Apple's App Attest, which vouches that the request came from a real copy of
the app on a real device.

## "No analytics? Then how do you know anything?"

Mostly by counting rows that already exist. The hive is judged on one
number, how many of the people who buzz come back and buzz on a different
day, and every figure behind it is a count of rows the database already
keeps. The app's four numbers ride on the profile row it already writes. There
is no event stream, no session and no third party code.

**What that costs:** no funnel, no retention curve, and no question that
nobody thought to ask in advance. `docs/measuring.md` and `CLAUDE.md` say
why that trade was made.
