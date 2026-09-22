# Creative direction for the date page

Written 8 September 2026 by Nathan's session, after reading
`notes/first-impression-brief.md`, `notes/first-impression-proposal.md` and
`docs/opus-worklist.md`, and after looking at the live September 8 page.

This is a creative note, not a build plan. The work list is still the work
list. This says what the page is doing right, what it is doing wrong, and what
a stranger on Reddit will say when they see it.

---

## 1. The one thing that decides everything

The last Reddit post did not fail on looks. It failed because strangers
decided the site wanted something from them and would not say what. Every
creative choice from here gets judged against one question:

**Does this make a suspicious stranger less suspicious in four seconds?**

That is the whole job. A prettier page does not do it. A page that answers
"what is the catch" before anybody asks does it.

## 2. What the page is doing right

**The state line is the best thing on the site.** "Open. Closes tomorrow
night, then sealed until next year." That sentence has a verb, a clock and a
consequence in eleven words. Nothing else on the page works that hard. It
should be the loudest idea on the screen, and right now it is set smaller than
the date, which is the one fact the reader already knew.

**Three answers with no up or down vote is a real design.** Most people will
not notice it. The few who do will respect it, and they are the ones who
write the comments everybody else reads. It is currently explained nowhere a
skimmer will see.

**The typography and the dark palette read as expensive.** That is worth real
money against the "vibe coded" charge, because slop is usually ugly. Do not
redesign the look. The look is not the problem.

**The mechanic is genuinely new.** A date that opens for three days and then
seals for a year is a thing no other site does. "Wikipedia records what
happened, Birthed records what stuck" is the sentence that sells it, and it
does not appear on the page at all. That is the largest single miss.

## 3. What the page is doing wrong

**The lead card is the whole product and today's card is bad.** On September 8
it is a routine space station resupply flight from the year 2000, with a movie
soundtrack cover sitting beside it that has no visible connection to the
sentence. A cold reader sees a picture that does not match the words. That
reads as either broken or as a machine that stopped paying attention, which is
exactly the accusation from last time. The caption explains the picture, but
nobody reads a caption before forming an opinion.

The deeper problem is what the rule is optimizing for. Nearest to twenty five
years back, with a source, is a rule that reliably picks the routine over the
memorable. Routine things get written down. Memorable things get remembered.
The card should be picked for the second one.

**Nothing on the first screen says who made this or what it wants.** A
polished site with no owner and no price is, to a suspicious reader, a data
business. Silence is not neutral here. Silence is the accusation.

**The privacy claim on the site is currently false and it is checkable in
about thirty seconds.** The privacy page says birthed.app sets no cookies.
`serve.ts` sets a one year token cookie the first time somebody answers a row.
Somebody will open the developer tools, screenshot the cookie next to the
sentence, and that screenshot becomes the top comment. Nothing else on this
list matters until that paragraph is true. It is item 1 on the work list and
it should be treated as the gate on posting anywhere, not as a quick win.

**The thing that makes this not Wikipedia is below the fold.** Internet and
gaming rows are the differentiator. A reader who sees a meme or a game launch
with an exact date and a source thinks "this is not an encyclopedia." A reader
who sees notable people, historical events and a chart position thinks "this
is an encyclopedia with a dark theme." Right now the first screen shows the
second thing.

## 4. What Reddit will say, in the order they will say it

Write the page so these comments are answered before they are typed.

1. **"How do you make money on this?"** Answer it on the page, in the site's
   voice, above the fold. Even "nobody pays for this and nothing is for sale"
   beats silence.
2. **"The privacy page contradicts the cookie."** See above. This one is fatal
   and it is entirely preventable.
3. **"This is AI slop."** Triggered by mismatched pictures, by sentences that
   sound like a chatbot, and by any hint that a model wrote what is on the
   page. The true answer is strong: a model finds candidates and every one of
   them cites a page you can open, and no row reaches the site until a person
   publishes it. That gate is real. Say it.
4. **"It is just Wikipedia with a dark theme."** Answered only by putting a
   culture row where they can see it.
5. **"Why does it want my birthday?"** Keep the app and the birthday out of
   the first screen entirely. The site does not need a birthday and should not
   look like it wants one.
6. **"This will be dead in six months."** Answered by the clock. A site with a
   deadline on it does not look abandoned.

## 5. Four moves, in order

**Move one. Put the catch above the fold.** One short line under the mechanic,
small and plain, saying what is kept and what is not. Something close to: no
account, nothing sold, no ads, no trackers, and one cookie that only exists so
you cannot answer the same thing twice. Do not write it until the privacy page
is true, because the line and the page have to match word for word.

**Move two. Rotate the ask card, and change what it picks for.** Nathan's
instinct is right and there are two reasons for it. A single fixed card is one
chance to hook a stranger, and a card that never changes gives a returning
reader nothing. The rule should stop optimizing for nearest to twenty five
years and start preferring rows a person who was alive would recognize, which
in practice means the culture rows first. That is work list item 5 and it
should move up.

The mechanism, given that the site runs no JavaScript and the pages are baked:
bake five candidate cards into the page, all hidden, and let `today.css`
reveal one. `today.css` is generated on every request and is not cached, so
the choice can change on every load, or every hour if a stable window is
wanted. Only the three open dates need rules, so this costs almost nothing.
One rule has to survive the rotation: after somebody answers, the redirect
lands on that row's anchor, so a targeted card must show itself whatever the
rotation picked, or a reader answers and watches their answer vanish.

**Move three. Show one internet or gaming row on the first screen.** Not as
decoration. As the proof that this is a different kind of site. It can be the
ask card itself, which is why move two and move three are really one move.

**Move four. Sign it.** A name, or at least a human sentence about why this
exists, reachable in one tap from the first screen. The About page does this
work already and nothing points at it from where the doubt happens.

## 6. One disagreement worth having

The pitch "voted on by humans and scored by artificial intelligence" is half
right and the second half is a liability with this audience. On Reddit right
now, "scored by AI" reads as "the machine decides what is true," and it invites
the slop accusation rather than defending against it.

The same facts told in the honest order are much stronger:

> A model searches and proposes. Every row cites a page you can open. Nothing
> reaches the site until a person publishes it. The order comes from what
> readers said they remembered, and nothing else.

That is true today, it is checkable, and it puts the humans at both ends where
they belong. Use it instead.

## 7. Today gets its own rows

Decided 8 September 2026. This looked like it would break the concept and it
does not, as long as it is framed correctly.

**It is not a news feed. It is the newest layer of the same stack.** The
September 8 page already carries 1998, 2000 and 2011. A thing that happens on
8 September 2026 is a September 8 row for the year 2026, and it belongs on
that page permanently, at the top, the same as every other year. Nothing about
the seal changes. The date still opens for three days and still shuts.

**This makes the ask card better, not worse.** Asking "do you remember this
one" about something from six hours ago is a different question, and a more
interesting one. It stops being about memory and becomes about reach: did this
get to you. And because the row stays on the page, the same row is asked again
next September, when it really is a memory question. The gap between what
reached people the week it happened and what they still recognise a year later
is the forgetting curve, measured. That is the year two idea in work list item
12, arriving a year earlier and for free.

### The rule that keeps this from becoming a news site

A row about today earns its place only if it would still earn its place on
this page in ten years.

That is a narrow filter and it is meant to be. It keeps a game launch, a
platform shutting down, a record broken, a death people will remember, a thing
the internet spent the day on. It throws out daily politics, routine business
news, and anything whose whole interest is that it is new. A date page with
one real row from today is good. A date page with six rows of today's headlines
is a news aggregator, and there are a thousand of those.

### Three things that will go wrong

**Today's news skews grim.** The suppression screens exist because eight
thousand Wikipedia events were too heavy for a birthday page. Today's rows have
to pass the same screens and probably a stricter one, because a fresh disaster
at the top of somebody's birthday page is the worst thing this site could do.
Nothing about today may lead the ask card without clearing `mayLead`.

**Politics will try to get in and cannot be allowed to.** The site has no up
or down vote precisely so that a crowd cannot fight on it. A daily political
row is an invitation to have that fight anyway. The ten year rule mostly
handles it. Where it does not, the answer is no row.

**It needs a build every night and there is not one.** The pages are baked, so
a row from today does not appear until something rebuilds. Sealing has the
same problem and it is already an open question on the work list. One nightly
job after the site's midnight covers both. It does not need a model and it must
not use the fact finder, which cost forty dollars in seventy minutes.

## 8. The site is signed by a person

Decided 8 September 2026. The name is **Jason Evan Page**. A real name and one
human sentence about why this exists, reachable in one tap from the first screen, and ideally a few words of
it visible without the tap.

The reason is narrow. A polished site with no owner, no price and no ads is,
to a suspicious stranger, a data business that has not shown its hand yet.
Silence is read as the answer, and the answer it is read as is the bad one. A
name is the cheapest possible fix and it is the one thing an accusation of
"this is a scam" cannot survive contact with.

It does not need to be a biography. "I built this because I wanted to know what
people actually remember, it costs me money to run, and nothing on it is for
sale" over the name does the entire job.

## 10. The youth problem, measured

Written after reading the live September 8 page rather than the database.

**The differentiator is a rounding error.** That page carries 47 rows in the
feed. Fourteen of them are from 1958 on. The rest run from 1198 to 1946, and
the drawer opens on a Prince of Hohenstaufen being crowned King of Germany.
There are 341 published culture rows across 366 dates, which is under one per
date, and none of them is on the first screen.

So a nineteen year old opening a date page is shown, in order: a coronation
from the twelfth century, a number one record from before their parents were
born, and a rail of notable people most of whom are dead. The thing this site
has that nothing else has is real, and by volume it is a rounding error against
an encyclopedia. That is the whole youth problem and it is not a design
problem. No layout rescues a page whose content is not for the reader.

**What the code proved today.** The ask card never changed on reload because
only one row on September 8 could be a candidate at all, and the scorer that
picked it would rather have International Literacy Day than the first
broadcast of Star Trek, because that sentence is eighteen characters shorter.
Both facts point the same way. Ranking Wikipedia's sentences by anything
measurable produces the dullest one that fits, every time, because the dull
ones are short and the memorable ones need a clause to say what they were.

## 11. What curation has to produce, and in what order

Nathan is right that this needs people. The panel to do it already exists.
`docs/curation-panel.md` designed it, the three states shipped, and a curator
publishes by pressing one key. What is missing is not the tool. It is a
decision about what the people are producing, and there are two products, not
one.

**First, and smaller, and far higher leverage: a lead line per date.** One
short human sentence per date, written for the ask card and nothing else. Not a
rewrite of the feed. Not a new fact. The same row, said the way a person would
say it.

> Wikipedia: "The science fiction television series Star Trek made its
> broadcast television debut in the United States on NBC with the episode The
> Man Trap."
>
> Lead line: "Star Trek went out for the first time."

That is 366 sentences. It is a week of evenings, or a month at ten a night, and
it fixes the single most important element on the site, which is the one thing
a stranger is asked to do. It needs one nullable column and one line in the
picker. Nothing else changes.

**Second, and larger: enough culture rows to change the mix.** Three per date,
on the first screen, is roughly 1,100 rows against 341 published today. Around
700 more. The generator and the approval gate both exist, so this is a
budgeting question rather than a building one, and it runs into the standing
policy from the forty dollar night: every run gets an estimate in dollars
before it starts, not a count.

**What a team means with no users.** Not payroll. Three shapes, and the third
is already built:

1. Jason and Nathan doing ten a night. Slow, free, and the only version where
   the taste of the site is the taste of the people who made it.
2. Opening the panel to a handful of trusted people, one at a time, each with
   their own account against the admin allowlist that already exists.
3. The model proposes and a person presses a key. This is the shipped loop and
   it has already earned its keep by catching five album and film rows before
   anybody saw them.

The honest order is three for volume and one for taste, and one goes first,
because a lead line written by a person is the part a stranger reads.

**What curation must never become.** Writing rows to fill a date.
`docs/internet-culture.md` already says thin years stay thin, and a date with
three real culture rows and four invented ones is a dead site. The panel exists
to say no faster, not to say yes more.

## 9. What shipped on 8 September 2026

In the order of section 5, and the first two were the gate on posting
anywhere.

- **The footer denied a cookie the site sets, on every one of 366 pages.** The
  sentence written to answer the harvesting accusation said "this page sets no
  cookies" while the answer route was returning a one year `bt` cookie, and
  its whole value was that a reader could check it in the network tab in five
  seconds. It now names the cookie and says what it is for. The privacy page's
  website section says exactly what is kept, names `bt` and `by`, and says the
  request address never reaches the database or an answer. Two tests fail if
  either goes false again. This was work list item 1, and it was larger than
  the work list thought, because the footer was not in it.
- **The site is signed.** One line under the mechanic on every date page, and
  a "Who made this" section on the About page in the first person. A test
  asserts the name renders above the first ask card rather than under the
  fold.
- **The ask card is dealt rather than fixed.** Up to five candidates baked,
  one revealed per request by `today.css`, which is never cached, so a reload
  deals again. The rule that picked them changed too: evidence first, then a
  1985 to 2015 window rather than distance from a single year, then shortness,
  and each decade taken once before any decade is taken twice.
- **"Anonymous" is on the ask card**, which was work list item 2.

Not done, and next: culture rows are still not in the ask pool. They are the
rows a reader under forty recognises and they are the reason the card exists,
but they sit outside the timeline and `cultureSection` would have to learn the
same hiding rule the feed has. That is work list item 5 and it is the single
highest value thing left on the first screen.

## 9. Left open

- Whether the rotation should change on every load or hold for an hour.
- Whether "Do you remember this one?" survives cold reader testing, which is
  work list item 11 and is still the right next test.
