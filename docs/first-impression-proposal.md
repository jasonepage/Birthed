# Proposal: the first screen of a date page

Written 8 September 2026 against `docs/first-impression-brief.md`. The mockup
is `web/proto/first-screen-september-8.html`. Open it in a browser; the strip
at the top switches it between today's date, yesterday's, tomorrow's and a
sealed one with no script, and the stylesheet in it is split into the part
that would be baked and the part `today.css` would send.

---

## What I would change, in one paragraph

The first screen has no verb on it. Wordmark, stepper, three chips, BORN ON,
the date at sixty point, three pictures, a heading. Every one of those is a
noun, and the only thing on the page a stranger can do is six hundred pixels
down under a game release most people have never heard of. So I would put the
verb first. The page should open with one sentence that says it is open and
when it shuts, then the date, then one sentence that says what the site
collects, then one real row from this date with the three answers under it at
full size. The three cards move down a screen. The chips go. That is the whole
change, and everything below is the reasoning and the details.

## Where the brief is right and where I think it is wrong

The brief is right that this is a cold start problem and not a visual one, and
right that nothing at the top may fake activity. It is right that the chips
are the only trace of the mechanic and that they read as navigation.

It floats two ideas I want to argue with.

**The chips should not become the loudest thing.** They are three links to
redirects. Louder chips would be louder navigation, and they would still say
Yesterday, Today and Tomorrow, which are words about the calendar and not
about this page. Worse, they are coloured by `href` and not by date, so on
September 10 today, a sealed page, the Today chip is still lit blue and the
line under it still says "Answering is open on these three." I saw that in the
browser while writing this. A stranger reads that as this page being open.
The chips are demoted to one quiet sentence in the mockup, and the sentence
hides the link to the page you are already on, from `today.css`.

**The date should not carry the countdown.** The date is the least
informative thing on the page. The reader typed it or clicked it. Sixty point
type spent on the one fact they already have is why the page feels like a
database: databases lead with the key. The date drops to about forty eight
point and a status line goes above it. The clock lives in the status line,
because the clock is the news and the date is the address.

One more thing the brief does not say and should. The first screen has to be
honest on 363 pages, not three. Whatever says "open" must say "sealed" just as
clearly when it is not, or the site has taught every visitor who lands on a
shut date that the open ones are lying too.

## The four things a stranger has to get in four seconds

1. **It is open right now and it shuts.** The first words after the bar are
   the state line: "Open. Closes tomorrow night, then sealed until next
   year." Four versions are baked into every page, one for each of yesterday's
   date, today's, tomorrow's, and sealed. The sealed one is the default, so a
   page with no `today.css` says the safe thing, and `today.css` switches one
   of the other three on, the same way it already reveals `.rem`. Under it is
   a two pixel line I am calling the fuse, filled to exactly the fraction of
   the three days that has gone. `today.css` sets that fraction from the real
   clock on every request, so it is true to the second the page loaded, and
   where motion is allowed a 72 hour CSS animation starts from that point and
   creeps. It is not a count of anything. It is only the clock, and the clock
   is the one thing that is truly urgent today with nobody here.

2. **You are meant to do something.** One row from this date sits under the
   lede with the three buttons at forty two pixels tall, above the fold on a
   375 wide phone. The label on it is a question, "Do you remember this one?",
   which is the whole mechanic said as a question. The buttons say the same
   three words every row further down uses, so a reader who answers here
   already knows what every smaller button on the page does. Nothing needs
   explaining after that.

3. **What you do changes what the page becomes.** The lede, in two sentences:
   "Everything below happened on this date. Say which ones you remember. When
   it shuts, what people remembered rises to the top and stays there for a
   year." That is the consequence, and it is the sentence the About page
   already has to work up to over four paragraphs. On a sealed page the lede
   swaps to the past tense version, because "say which ones you remember" is a
   lie on a page that refuses answers.

4. **The thing collected is memory, not facts.** The word remember is bold in
   the lede, the ask label is a question about remembering, and the buttons
   are three degrees of remembering. There is nothing else on the first screen
   that is a fact-shaped control: no search, no filter, no count of rows.

## The first ask, and how it is chosen

This is the part that decides whether the design works, so the rule has to
be dull enough to check on 366 pages.

Take the merged timeline for the date. Keep only rows that pass both existing
screens in `highlight.ts`, `NOT_ON_A_BIRTHDAY_CARD` and
`NOT_FROM_AN_ENCYCLOPEDIA`. That is the rule the brief says to respect and
it is the one that keeps a mass casualty out of celebratory type. Keep only
rows under `LONGEST_LINE`. Keep only rows from 1958 or later, because that is
when the chart data starts and a row with a record beside it is the version of
this card that works. Of what is left, prefer rows that carry a source of
their own, for the reason `pickHighlights` gives, and fall back to the whole
list only when none do. Then take the row whose year is nearest to 25 years
ago. Tie goes to the shorter sentence. If nothing survives, no card:
the state line and the lede still do their jobs and the tiles move up.

Why 25 years. The thing being measured is transmission, and the lead row
should be one a large share of living adults can honestly answer with more
than "never heard of it". Twenty five years back is the year most adults
today were somewhere between five and sixty. It is a guess and it is one
number, written in one place, and it is stable across builds so the card for
a date does not change every deploy. On September 8 it lands on 1998, Mark
McGwire's 62nd home run, which is in the data now with a source, and the
number one that week was Aerosmith, which the page has the sleeve for. That
is the card in the mockup. Every word on it is already on the page.

The record sleeve on the card is not the thing being asked about. Songs are
not a `subject_kind` the database accepts and I am not proposing to add one.
The sleeve is there because the year is the question and a sleeve says 1998
faster than the number does. It is captioned as exactly what it is.

"Never heard of it" on the card counts like the others, and the small line
under the buttons says so, along with the ten answer budget and that there is
no account. Three facts, one line, no explaining.

## What happens to the three cards

They stay. They move under the ask, in one row at about a third of their
size, under a label reading "Also on this date." They were the first screen
and they are now the second. They are the prettiest thing on the page and they
were also the thing that made it read as a skin over a database, because a
face, a sleeve and a year with no verb near them is a search result. Under a
row with buttons on it they read as what they are, which is the rest of the
date.

The mockup uses the 1998 sleeve in the strip too because it is the only cover
I copied into a self contained file. In production the strip keeps whatever
`openingBand` picks now.

## What a sealed page says

"Sealed. Opens again on September 7, for three days." Baked, since the page
knows its own date and the day before it. No year, so it stays true whether
the date has passed this year or not. No ask card. No count. A sealed date
that took answers already has the "Sealed. In the order the people who were
here remembered it" note and the front page lead, and those stay where they
are.

I chose not to say "nobody answered this date" on the 363. It is true and it
is honest, but printed on every sealed page it teaches the visitor that the
site is empty before they have seen an open one. Absence of a claim is not a
lie. A number would be.

One thing I would consider and did not do: `today.css` could tell a sealed
page whether its window is behind or ahead this year, so September 20 could
say "Not open yet. Opens September 19" instead of "Sealed". That costs about
360 rules per request. Cheap, but not free, and "Sealed" is true either way.

## What `today.css` would send

For each of the three open dates, with `i` being 0 for yesterday's date, 1
for today's, 2 for tomorrow's, and `gone` computed as below:

```
.on-<slug> .w-1 { display: inline }      /* or .w0 or .w1, by i */
.on-<slug> .wopen { display: inline }
.on-<slug> .wshut { display: none }
.on-<slug> .dot { background: #6FA5DE; box-shadow: 0 0 0 4px rgba(111,165,222,.18) }
.on-<slug> .fuse { display: block }
.on-<slug> .fuse span { --gone: 0.47 }
.on-<slug> .ask { display: block }
.on-<slug> .also a[href="/yesterday/"] { display: none }   /* the link to itself */
```

plus what it sends today. The arithmetic, in the site's own clock:

```ts
const day = 86_400_000;
const shifted = now.getTime() - TODAY_BEHIND_UTC_HOURS * 3_600_000;
const startOfToday = Math.floor(shifted / day) * day;
// A date is open from the start of the day before it to the end of the day
// after it. Yesterday's date opened two days ago, today's opened yesterday,
// tomorrow's opened at the start of today.
const opensAt = startOfToday + (i - 2) * day;
const gone = Math.min(1, Math.max(0, (shifted - opensAt) / (3 * day)));
```

Yesterday's date reads 0.67 to 1.0, today's 0.33 to 0.67, tomorrow's 0 to
0.33, which is right: the page for the date itself is always in the middle
third. `today.css` is already `no-store` so the number is fresh on every load.

"Night" in the state line means the end of the day in the site's clock, which
is six hours behind UTC. That is already documented in `serve.ts` and the
status line does not pretend to know the reader's time zone. If that bothers
anybody the honest fix is a footnote, not a guess.

## Rules checked

- No script. Radios, `:checked`, sibling selectors, `display` flips from a
  per request stylesheet, one CSS animation. All of it is in use on the site
  already.
- No new dependency. The mockup is one file with the site's own palette.
- No direction. Three answers, same three words as every row, no score, no
  count anywhere on the first screen, nothing about who else is here.
- Heavy rows cannot lead. The ask uses both screens from `highlight.ts` and
  nothing else on the first screen is content.
- No fake activity. The only live number on the screen is the clock.
- No em dashes. Plain words. The joke, where there is one, is not explained.
- Before naming, I grepped. `.state`, `.fuse`, `.ask`, `.askhead`, `.asklab`,
  `.askyr`, `.askbody`, `.askart`, `.askcap`, `.asksaid`, `.askrule`, `.mechanic`,
  `.also`, `.alsolab`, `.w`, `.wopen`, `.wshut`, `.w-1`, `.w0`, `.w1`, `.dot`
  and `.sealednote` do not appear in `render.ts`, `pages.ts`, `calendar.ts`
  or `serve.ts` today. (`.how` was my first name for the lede and it is already the
  About page's section class, so it became `.mechanic`.) Grep again before merging, since that is the rule and
  it has been broken three times.

## What I am not sure about

- Whether 25 years is the right anchor. It is one constant and it can move.
- Whether the fuse reads as a clock or as a loading bar. It is two pixels and
  it is under a sentence that says what it is. If cold readers still call it
  a loading bar, drop the animation and keep the static line.
- Whether "Do you remember this one?" is one word too cute. "Do you remember
  this?" is the fallback.
