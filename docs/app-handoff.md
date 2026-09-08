# Birthed iOS: bringing the remembering loop into the app

Written 8 September 2026, straight after the web side of this shipped. Read
this before touching the app. It is written for a fresh session with no memory
of the night that produced it.

---

## 1. Who you are talking to

**Jason** is at the keyboard, not Nathan. The Claude account is shared; Nathan
sells retail software and the app projects on it are Jason's. Address Jason.

- No em dashes. Anywhere. Not in replies, not in comments, not in user facing
  copy.
- Plain full sentences at roughly a seventh grade reading level.
- For a yes or no question, lead with the one word answer and keep it short.
- No bullshitting. If the data does not support a claim, say so. He would
  rather be told a thing is unknown than handed a confident guess.
- He runs `/GODLIKE`: no "you're right" preambles, no filler.

**You have no compiler.** Jason builds in Xcode and sends back errors and
screenshots. Write Swift that compiles the first time, and when you cannot be
sure, say which line you are unsure about rather than shipping it silently.

**The domain tests are your feedback loop.** `Package.swift` at the repository
root points a Swift package target at `Birthed/Domain` and a test target at
`BirthedTests/DomainTests`, so `swift test` runs from a terminal with no Xcode
and no simulator. Anything you can put in Domain, put in Domain, and test it
there. This is the only part of the app you can verify yourself.

**Commits** use:

```
Jason Page <jasonpage@users.noreply.github.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: <the session URL from your own attribution notice>
```

He pushes. You commit.

---

## 2. What this feature is, in one paragraph

Every ranking signal Birthed has measures documentation. Sitelinks measure what
crossed a language border, pageviews measure what got looked up, Wikipedia's
anniversaries list measures what its editors chose. None of them measure what
got **transmitted**: the thing somebody brings up unprompted, the thing everyone
their age knows without having read it. That has never been collected by anyone.
So a date opens for three days around itself, takes what people remember, and
seals into an edition. One edition per date per year, which means the same date
reopens next year on top of the last one, and the difference between them is a
measurement of collective forgetting that cannot be scraped from anywhere,
because it does not exist anywhere.

Wikipedia records what happened. Birthed records what stuck.

---

## 3. What already exists, and it is more than you think

**The database is live.** Applied to project `lunqqhjwqrpbujwxwdzk` on 8
September 2026 and verified against it: an answer on today's date was accepted,
one on a date outside the window was refused, and a short token was refused.

Three tables and three functions, all of them already granted to `anon`:

- `remember_settings` one row, `window_days` currently `1`, meaning a date takes
  answers yesterday, today and tomorrow. It is a column and not a constant so
  widening it is an update rather than a deploy.
- `day_editions` one row per date per year: `event_month`, `event_day`,
  `edition_year`, `opened_at`, `closes_at`, `sealed_at`.
- `remembrances` one answer: `edition_id`, `subject_kind`, `subject_id`,
  `voter_token`, `birth_year`, `depth`, unique on
  `(edition_id, subject_kind, subject_id, voter_token)`.

```
remember(month_in, day_in, subject_kind_in, subject_id_in,
         voter_token_in, depth_in, birth_year_in default null) -> boolean
open_edition(month_in, day_in) -> day_editions        -- null when sealed or out of window
remembrance_tally(month_in, day_in) -> rows of
    (subject_kind, subject_id, edition_year, there, remembers, heard, never)
```

`subject_kind` is one of `moment`, `cultural_event`, `historical_event`,
`birth_fact`, `person`. `depth` is one of `there`, `remember`, `heard`, `never`.
`remember` returns false when the date is sealed, when the window does not cover
it, when the token is under sixteen characters, or when that token already
answered that row. The tables are closed to every client; those functions are
the only way in and the window check lives inside `open_edition` where nothing
on a device can reach it.

**The web side ships it already.** birthed.app renders four buttons under every
row, posts a plain HTML form, and redirects back. No JavaScript, no account, a
random token in a cookie. Look at `web/src/render.ts` `rememberForm` and
`web/src/serve.ts` for the exact contract if anything here is ambiguous.

**And the app is better placed than the web was.** Two things already exist that
took the web a night to fake:

`Birthed/Data/AccountService.swift` creates a silent anonymous account on first
launch with no screen and no user action, and keeps the user id in the keychain.
That id is a stable, per install, non guessable string, which is a better
`voter_token` than a cookie and needs no new plumbing. FR-013 says there is no
sign in wall in front of anything, ever. Keep it that way.

`Birthed/Data/WorldLikesService.swift` is the shape to copy. It aggregates a
count per subject, remembers which subjects this account has acted on, and hides
a number below a floor of five so a row never reads zero and teaches a reader
that nobody is here. Read its header comment before writing anything: it already
argues out why the handle is a stable key and not a position, which is the same
mistake waiting in this feature.

---

## 4. What to build

**A `RememberService`, modelled on `WorldLikesService`.** It posts to
`rpc/remember` with the account's user id as the token, and reads
`rpc/remembrance_tally` for the counts. It holds which rows this account has
already answered so the interface can show that back.

**Four buttons on a row in `DayPageView`.** "I was there", "I remember it",
"Heard of it", "Never heard of it". `Birthed/Features/DayPage/DayPageView.swift`
already has a `FeedRow` and a switch over `.fact`, `.event`, `.person`, `.song`,
`.film`; that switch is where the `subject_kind` comes from.

**Every row needs a stable identifier, and this is the part that will bite.**
The web hit exactly this: a merged feed mixes several sources, so an index is
not an identity. The same row sits somewhere else the day a new fact lands, and
every answer anybody gave slides quietly onto a different sentence. Check what
`SupabaseRestDayPageRepository` selects and make sure the row id comes through.
The web had to add `id` to three selects to fix this.

**The three day window in the interface.** The app can compute yesterday, today
and tomorrow locally for what it draws, and must never treat that as the
authority. `open_edition` decides. If a post comes back false, say the date has
sealed; do not fail silently.

**The seal as an artifact.** When a date closes, the page should permanently say
what it decided and when: "Sealed 8 September 2026. Forty seven people answered."
That is the year one version of time travel and it exists from the first day.

**Time travel, when there is a second edition.** `remembrance_tally` already
returns `edition_year`, so 2027 can show 2026 beside it. In year one there is
nothing to compare, and a screen that says so honestly is better than one that
invents a trend from a single point.

---

## 5. Rules that must not break

**No downvote, and no fifth answer.** There is no way to say a thing did not
matter, only how close to you it was. A direction is a weapon, and an up and
down score on January 6 or October 7 is a brigading target within a week.

**"Never heard of it" is recorded, not discarded.** A row that is thoroughly
documented and that nobody has heard of is the most interesting result this
collects, and it is invisible if you only keep the people who remember.

**No points, no streaks, no badges, no reputation, no leaderboard.** This is not
taste. The moment an answer earns status, people answer for status, and if "I
was there" scores higher than "never heard of it" then everybody was there and
the one signal this exists to collect is worthless. r/place had no points. It
had a cooldown and a canvas that locked. Scarcity and consequence, never
scoring. If gamification is wanted, cap the answers per day so each one is a
choice, and put a clock on the seal.

**No account wall, ever.** FR-013. The anonymous account is silent and the app
carries on without one.

**No analytics, and read `Birthed/Domain/Models/Tally.swift` before arguing.**
Four totals ride on the profile row, there is no event stream, no device
identifier beyond the keychain token, and the privacy page promises exactly
that. A remembrance is not analytics: it is content the reader deliberately
contributed. Do not let one become the other.

**The Domain folder imports nothing.** No SwiftUI, no SwiftData, no networking.
If a Domain type needs data it takes it as a parameter. That is what makes
`swift test` possible without a simulator, and it is your only feedback loop.

**Grave rows do not get a celebratory register.** The web carries a gravity axis
because September 10 leads with an assassination and September 4's most recent
event is a school shooting. A counter next to a killing is grotesque. Check what
`share.ts` `NOT_ON_A_BIRTHDAY_CARD` refuses: 41 percent of the 19,734 Wikipedia
events match it and every date has at least one.

---

## 6. Where things are

- `Birthed/Data/AccountService.swift` the silent anonymous account and the token
- `Birthed/Data/WorldLikesService.swift` the service shape to copy
- `Birthed/Data/SupabaseRestDayPageRepository.swift` where rows are fetched
- `Birthed/Features/DayPage/DayPageView.swift` the feed and `FeedRow`
- `Birthed/Features/DayPage/DayPageViewModel.swift` the state
- `Birthed/Domain/Models/Tally.swift` the measurement stance, read it
- `Birthed/Config/Secrets.swift` the project URL and the anonymous key
- `web/src/render.ts`, `web/src/serve.ts` the shipped web version of this loop
- `supabase/migrations/20260908050000_remembrances.sql` the tables and functions
- `docs/handoff.md` the state of the web side and the strategic frame

Domain tests: `swift test` from the repository root.

---

## 7. One trap, because it cost the web an outage tonight

Before naming anything, grep for the name. A new CSS class called `said` was
added with `display: none`, and `said` had been the event sentence, the year
dial line, the fact text and the song title for months. Every event on
birthed.app went blank and the page still looked plausible. `docs/handoff.md`
already recorded two earlier collisions and stated the rule, and it happened
anyway.

The Swift equivalent is a type or a property name colliding in a file you did
not open. Grep first, and write a test that asserts the thing is **present**.
Both earlier collisions were caught by tests asserting an absence; this one
reached production because nothing asserted a presence.
