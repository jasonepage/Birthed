# Work list for the next session

Written 8 September 2026, at the end of the session that shipped the first
screen. This is a plan for a fresh session to work through on its own, with
as little back and forth as possible. It is ordered. Do the quick wins first
and commit each one on its own, because every one of them is a thing a reader
can hit tonight.

## The prompt to paste

> Read `docs/handoff.md` section 1 for who you are talking to and how to
> write, then `docs/app-handoff.md` sections 2 and 5 for the rules that must
> not break, then `docs/first-impression-proposal.md` for what the date page
> now is, then this file. Work through this file top to bottom. Commit each
> item on its own with the trailer from `docs/handoff.md`. Verify by
> rendering, not by reasoning: `npm test` in `web/`, and a screenshot at 375
> wide for anything on a page. Do not ask me about anything below unless the
> item says to. If an item turns out to be wrong, say why in one paragraph and
> move on. No em dashes anywhere.

## Where things stand tonight

- The first screen of every date page was rebuilt today. State line, fuse,
  the date, the mechanic in two sentences, one row to answer above the fold,
  the three tiles demoted. `docs/first-impression-proposal.md` has the
  reasoning. Three commits, `b200ea9`, `d3b62ba`, `d25d4aa`. Not deployed.
- A mobile bug was fixed in the same run: every date page was wider than a
  phone because of hidden labels in the song dial, and iOS drew the page at
  desktop size. Commit `b200ea9`.
- There are three answers in the whole database and they are the developer's.
  September 7 is the first date that will ever seal. It closes at the end of
  September 8 in the site's clock, which is six hours behind UTC.
- A Chinese friend of Jason's looked at the page cold and asked "who will
  take their time to edit this". The word "edit" means the page still read as
  Wikipedia to them. Unknown whether they saw the old or the new first
  screen. Their second concern was privacy.
- The pages cannot be rebuilt from a Cowork shell, which has no network. Do
  the build from Claude Code, where `npm run site` reaches Supabase.

## Quick wins. Each one is under an hour and each one is real.

**1. The privacy page says the site sets no cookies. It does now.**
`web/src/pages.ts` around line 645: "birthed.app sets no cookies and uses no
analytics." `web/src/serve.ts` sets a token cookie the first time somebody
answers a row. Rewrite that paragraph to say exactly what is kept: a random
token in a cookie, set only when you answer, that is the whole of what
identifies you; the answer; the birth year if you gave one. Say what is not
kept: no name, no account, no address logged against an answer. This is the
first thing a careful reader checks and it is currently wrong.

**2. Put the word "anonymous" on the ask card.** `askrule` in
`web/src/render.ts` reads "One tap, no account. Ten answers per date, no
score, and "never heard of it" counts the same as the others." Make it "One
tap, no account, anonymous." and keep the rest. The About page already says
"it is anonymous"; the card is where people read it.

**3. Say when a date sealed and how many answered.** `app-handoff.md`
section 4 calls this the year one version of time travel and the web does not
do it. `memorynote` in `render.ts` says "Sealed. In the order the people who
were here remembered it." The build already knows the edition (see
`timeline.ts` around line 477, which reads `closes_at`). Make it "Sealed 9
September 2026. Twelve people answered." Count distinct tokens on that
edition, not answers. Write the number in words under a hundred. If the count
is zero, say "Sealed 9 September 2026. Nobody answered." That is honest and
it is a better sentence than hiding it. Also switch the baked state line on a
sealed-with-answers page from "Sealed. Opens again on ..." to the dated
version, since that page knows more than the others.

**4. Check the first ask on all 366 dates.** Write a one-off script, keep it
in `web/src/` under a clear name or throw it away, that builds the timeline
for every date and prints the row `firstAsk` picks, plus how many dates get
none. Read all 366 lines. You are looking for two things: a row the screens
missed that should not lead a page (add the word to
`NOT_ON_A_BIRTHDAY_CARD` in `highlight.ts`), and how often the pick is dull.
Report the count of dates with no ask and the ten worst picks in the commit
message. Do not change `ASK_YEARS_BACK` without saying what it was and what
the 366 look like at the new value.

**5. Let the ask draw from the culture rows too.** `firstAsk` only looks at
the timeline, which is facts and Wikipedia events. `cultureSection` rows
(games, records, memes, with an exact date) are the ones a reader under forty
recognises, and the whole point of the ask is a row somebody can answer with
more than "never heard of it". Add them to the pool with the same screens
and the same year rule. The feed copy hiding (`asked` class) has to apply in
`cultureSection` as well, and the ask's `subject_kind` must be
`cultural_event` for those rows. Rerun item 4 after.

**6. The person tile shows a monogram when the first person has no face.**
September 8 leads with "AM" for Aimee Mann. Pick the first person in the
list who has a photograph, and fall back to the first person only when none
do. The tile is the only picture of a human on the first screen.

**7. Check the live site on a real phone after deploy.** Render deploys on
push to `web/**`. Then on an iPhone: the page fills the width, the state line
reads "Open", the fuse is drawn, the three buttons are above the fold, tap
one, the result bars appear on the card, undo works. Then open a sealed date
and confirm it says sealed and has no card. If anything fails, fix it before
anything else in this file.

## Medium. Each is a session's work.

**8. The birthday is the distribution channel. Build the loop.** Nobody
visits September 8 on purpose except people born on it, and one in 365 of
everybody has their birthday today. The app already knows the user's
birthday and already has `NotificationService.swift`. Add a local
notification the day before the user's birthday and on the day: "Your date
is open. It takes answers for three days and then it shuts for a year." It
opens the app on `DayPageView` for that date, where `RememberRow.swift`
already exists. Read `app-handoff.md` section 4 before touching the app.
This is the single most important item in this file and it is not a quick
win, which is why it is here and not above.

**9. A sealed date should be worth screenshotting.** The share card in
`og.ts` and `share.ts` is the same for every state. Make a sealed edition
its own card: the date, "Sealed 9 September 2026", the row that was most
remembered, and the count. Nothing about any individual. No ranking of dates
against each other. This is the artifact people pass around, and today it
does not exist.

**10. "Not open yet" on the pages ahead of today.** A sealed page says
"Sealed. Opens again on September 7." For a date later in the year that is
true but odd: it has not opened at all this year. `today.css` knows the
date, so it could send one rule per remaining date to flip a `sennext`-style
sentence to "Not open yet. Opens September 19, for three days." That is
around 360 short rules per request. Measure the bytes. If it is under 20 KB,
do it. If not, write down why not in a comment in `todayStylesheet` and
leave it.

**11. Three cold readers, one question.** Before building anything else on
the first screen, put the new page in front of three people who have not
seen it, on their phones, and ask one question only: "What is this page
asking you to do?" Write the three answers verbatim into
`docs/first-impression-proposal.md` under a new heading. If two of three do
not say some version of "say what I remember", the first screen is not done
and the next fix is copy, not layout. Jason has to run this one; write him
the exact message to send.

## Big picture. Think about these, write a page each, do not build yet.

**12. Year two is the product.** Everything on the site today is year one,
which is a poll. The thing nobody else has arrives in September 2027, when
the same date takes a second set of answers and the difference between the
two is a measurement of forgetting. Write `docs/year-two.md`: what the page
looks like when there are two editions, how the difference is shown without
becoming a score or a ranking, what "most forgotten" means and whether it is
safe to print, and what has to be stored now so it is possible then. The
`remembrance_tally` function already returns `edition_year`.

**13. Where the people who care already are.** The Reddit launch failed on
trust. The date page now leads with a question and cites everything. Write
`docs/where-to-post.md`: for each of a dozen communities (birthday subreddits,
year-of-birth groups, gaming history, internet history, genealogy, teacher
forums, the ones you can think of), what the honest one-line pitch is for that
audience, which date page you would link, and what the top comment will say
against it. No growth hacking. The pitch that works is the true one: "this
date is open for three days, say what you remember, then it seals."

**14. What a wrong "never heard of it" costs.** The measurement assumes
answers are honest. Write one page on what a coordinated crowd could do with
three answers and no direction, what the ten-answer budget and the cookie
token actually prevent, what they do not, and what the cheapest honest
defence is. Read `app-handoff.md` section 5 first so you do not propose a
score by accident. The answer might be "nothing yet, here is the tripwire to
watch". That is an acceptable answer if it is argued.

## Things to leave alone

- The `default-src 'none'` policy. Not negotiable, see the brief.
- The three answers. No fourth, no fifth, no direction.
- The chips. They are gone on purpose. Do not bring them back as a
  "navigation improvement".
- `ASK_YEARS_BACK` without the 366-date report from item 4.
- The tax and legal structure of anything. Not in scope, ever.

## Known unknowns

- Whether the friend saw the old page or the new one. Ask Jason once, in
  item 11's message.
- Whether the seal on September 8 night actually runs end to end: the build
  has to happen after `closes_at` for the sealed order to be baked. Nothing
  schedules that build today as far as this session could see. Item 3 will
  find out. If nothing runs it, a nightly Render cron that runs `npm run
  site` after 06:30 UTC is the fix, and it needs Jason to create it.
- Face coverage: `web/static/faces` was empty from the Cowork shell. Faces
  may live in `web/out/faces` and be downloaded at build. Confirm before
  doing item 6.
