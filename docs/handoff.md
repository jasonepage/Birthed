# Birthed: handoff for a fresh session

Written 8 September 2026. Read this before touching anything.

---

## 1. Who you are talking to

**Jason** is at the keyboard, not Nathan. The Claude account is shared between
them; Nathan sells retail software and the app projects on it are Jason's.
Address Jason.

How he wants you to write:

- No em dashes. Anywhere. Not in replies, not in code comments, not in user
  facing copy. The generator strips them from model output for the same reason.
- Plain full sentences at roughly a seventh grade reading level. Write out a
  term before abbreviating it.
- For a yes or no question, lead with the one word answer and keep the
  reasoning short.
- No bullshitting. If the data does not support a claim, say so. He would
  rather be told a thing is unknown than be handed a confident guess.
- When he asks for "questions and recommendations", use judgment on most of it
  and raise only the genuinely load bearing decisions.
- He runs `/GODLIKE`, meaning no "you're right" preambles or filler.

He is a fast, blunt reviewer and he will tell you when something is wrong. He
gets frustrated by tedious UI back and forth, so verify your own work by
rendering it rather than by reasoning about it. Several bugs this session were
caught only by rendering the page and reading it.

**Commits** use:

```
Jason Page <jasonpage@users.noreply.github.com>
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: <the session URL from your own attribution notice>
```

He pushes. You commit, he pushes, Render rebuilds on `web/**` changes.

---

## 2. What Birthed is

An iOS app plus **birthed.app**, a date almanac. Repo at
`/Users/jasonpage/Documents/GitHub/Birthed`. Supabase project
`lunqqhjwqrpbujwxwdzk`.

The site is 366 static day pages. You look up a date and get who was born, what
happened, what was number one, and what internet and gaming culture landed on
it. The app does the same for your own birthday plus a reminder loop for other
people's.

**The current strategic position.** A Reddit launch on r/InternetIsBeautiful
failed badly in early September. The post was removed and the top comments
accused it of harvesting data to sell, called it a scam and asked whether it was
vibe coded. The diagnosis was that the complaint was about trust, not visual
design. The pivot since: drop the app pitch and the signup, become the best free
date almanac, cite sources hard, and differentiate on internet and gaming
culture rather than on encyclopedia facts, which Jason considers boring.

---

## 3. Architecture invariants. Do not break these casually.

**The site runs no JavaScript.** Every page carries `default-src 'none'` except
`/add` and `/admin`, which are in `SCRIPTED` in `web/src/serve.ts`. This is the
trust story after the scam accusations, so widening it needs a reason. All
interactivity on day pages is CSS only: the year dial is radio inputs plus
`:checked ~ sibling`, collapsing is `<details>`.

**Nothing a model proposes reaches a page.** `cultural_events` rows are
`candidate`, `published` or `rejected`. The site build queries
`status=eq.published` and the row level security policy refuses candidates to an
anonymous caller, which is what the build is. A curator publishes by pressing `a`
in `/admin`. This gate has already earned its keep: it caught five album and film
rows before anyone saw them.

**Rejected is not deleted.** `alreadyHere()` in `find-culture` feeds rejected
titles back to the model as do-not-propose. Deleting a rejected row lets the next
run find it again.

**Pages are baked at deploy time**, so anything time dependent resolves at
request time instead. `/` serves today's built file and `/today.css` is generated
per request. See `serve.ts`.

**Wikidata queries bind dates with `VALUES`**, never `MONTH()`/`DAY()`, which
cannot use an index and dies on the sixty second timeout. Precision is read off
`p:P577/psv:P577`, not the truthy `wdt:`, because a year-only date is stored as
January 1 and the truthy property hands it back with nothing to say it is not a
real day.

**`is_admin()`** is a security definer function checking `auth.users` for a non
anonymous, confirmed account against the `admin_emails` allowlist. It is not the
JWT email claim. Every iOS reader holds a valid token because the app signs
everyone in anonymously, so `verify_jwt` alone would let any reader spend the
Gemini budget.

---

## 4. Money. Read this before running anything.

On 6 September a `find-facts` backfill ran from 01:22 to 02:32 and spent about
$40 in seventy minutes: 319 dates, 3,182 searches, 2,762 facts. It stopped
itself at the 3,000 ceiling. The ceiling worked. It had just been set as a count
by somebody who never converted it into dollars.

Jason's exact words afterwards: **"if we ever do that again im done thats way
too much money spent instantly"**. Treat that as standing policy. Estimate the
cost of any batch job in dollars before running it, and say the number out loud.

Current ceilings live in `fact_search_budget`, one row:

- `monthly_limit` 4500
- `daily_limit` 400, which is about 40 runs, about $5

Both are folded into `fact_searches_left()` so callers see one number and
`find-facts` got the daily cap without a redeploy. Roughly ten searches per run,
roughly twelve cents per run. The panel shows what is left before the button is
pressed.

`culture_search_runs` is the ledger for culture runs, including failed ones, at
whatever they spent before breaking. Known hole, documented rather than papered
over: a run counts when it finishes, so a hard crash between the research call
and the ledger write spends money the meter never sees. The daily ceiling is the
backstop, not the ledger.

**The Wikidata importer is free.** `worker/src/import-culture*.ts` talks only to
`query.wikidata.org` and `en.wikipedia.org`. No key, nothing metered. Run it
freely; the only cost is politeness to a volunteer funded service, which is why
there is a 1.2 second pause between dates.

---

## 5. What was done in the session before this one

Seven commits, newest last:

1. `5b3ebc9` Steerable prompts plus the daily budget ceiling and the culture
   ledger.
2. `f3244b6` Stopped the generator returning a release calendar, and stopped the
   panel showing one app user's private facts.
3. `f8a5fd2` Made the curator's steer binding rather than advisory.
4. `afb444a` Showed status on every cultural row in the date view.
5. `db35cfc` Aimed the generator at what people were inside of rather than what
   got written up.
6. `75b0f98` Printed `date_kind` on the public page. This was stored and never
   selected.
7. `f0d1439` Stopped the importer dating games to their re-releases.

`find-culture` is deployed at **version 6**. The repo file and the deploy match.

### The lessons inside those, worth keeping

**The spec was the bug, twice.** `docs/internet-culture.md` rule one listed
"a game, album, film or app release" among things with real dates, which
conflated *datable* with *relevant*, and the prompt inherited it faithfully. One
date came back with three album releases and two film releases. The fix went
into the document first, then the prompt. If a prompt and a document disagree,
the document is right and the prompt is the bug. That is written in the function
header.

**Prompt ordering is load bearing.** The curator's steer originally sat above the
list of what to look for, so a one paragraph steer competed with five concrete
paragraphs of targets and lost: a "meme origins" run returned three software end
of life notices. It now sits **after** the targets it overrides and **before**
the dating and sourcing rules it must never soften. A curator picks the subject
and cannot relax the evidence, and the ordering is what enforces that.

**The standing tension in `find-culture`.** The evidence rules reward
findability, and the most findable thing on the internet is technology industry
news. Left alone it drifts to sunset notices and end of life announcements,
which are perfectly sourced and which nobody dates their life by. Games are the
one place where the evidence bar and the audience agree, because version
histories carry exact days and stay online. That is why the prompt names the
Minecraft Wiki, Fortnite seasons, patch notes and official changelogs.

**Class name collisions have bitten twice.** `.here` in the calendar, `.when` in
the render. Both were caught by a test asserting the absence of something, not by
reading CSS. Grep before naming a class.

---

## 6. Open problems, roughly in priority order

**No measurement at all.** Nobody knows whether anyone reaches these pages.
Google Search Console and PostHog cost nothing. This is more valuable than the
next feature and has been deferred repeatedly.

**366 pages, 25,741 people, zero person pages.** 17,654 of those people have
more than 5,000 monthly Wikipedia views. `build.ts` renders only day pages.
Famous Birthdays is a real profitable business built almost entirely on person
pages. This is the largest unexploited asset in the repo. Caveat: thin
programmatic pages get penalised now, so quantity alone is not the play.

**The importer has never been run live.** A September dry run produced 2,128
works and kept 360 in 9.9 minutes with zero failures. The top of each date is
strong: Final Fantasy VII on 9/7, Grand Theft Auto V on 9/17, Baldur's Gate 3,
Dark Souls, Halo 3, Fortnite Battle Royale, Undertale. Re-releases and
unreleased games have since been screened out but **that fix has not been seen
in a dry run yet**. Run it and read it before writing 4,392 candidate rows.

**Two known editorial problems in the importer output, both judgment calls.**
Annual sports franchises eat four of twelve slots on some September dates, since
FIFA ships every September, which is factually right and editorially dead. And
Wikidata holds essentially nothing outside games, so pages become a games almanac
unless the Gemini side carries platforms and internet moments.

**Four all-366-pages data problems, still open.** The `almanac_score` ranking
with adult and violence screens carried over; the `WIKIDATA_YEAR_FROM` 1600
cutoff; 29 percent of `notable_people` rows have zero pageviews, which the
`max(1, ...)` floor mitigates but does not fix; and the Gemini credit line.

**TikTok is unsolved and may be unsolvable by retrieval.** Sounds and trends have
no timestamp anyone recorded and search grounding cannot invent one. That is what
the crowd mechanic in `docs/dating-the-internet.md` exists for. The split is:
Gemini takes the documented half, meaning games, platforms and shutdowns; users
take the undocumented half.

**The ten guess test** from `dating-the-internet.md` section 12 has never been
run, and the duration table referenced by `milestones.md` section 12 does not
exist.

---

## 7. Where things live

- `web/src/render.ts` day page rendering, `KINDS`, `WHEN`, the credit lines
- `web/src/timeline.ts` merges facts, Wikipedia events and curated rows, curated
  wins collisions
- `web/src/culture.ts` fetches published cultural rows for the build
- `web/src/admin.ts` the whole curation panel, one static page, fetch only
- `web/src/serve.ts` headers, CSP, today's page, `/today.css`
- `web/src/calendar.ts` extracted from `pages.ts` to break an import cycle
- `worker/src/culture.ts` Wikidata query, re-release and unreleased screens
- `worker/src/import-culture.ts` scoring and row building
- `worker/src/pageviews.ts` 60 day Wikipedia pageviews, batches of 50
- `supabase/functions/find-culture/index.ts` the Gemini generator
- `docs/internet-culture.md` the specification the generator must obey
- `docs/curation-panel.md` the panel design, the budget incident, steering
- `docs/dating-the-internet.md` the crowd mechanic, guess don't confirm

Tests: `cd web && npm test` (145 passing), `cd worker && npm test` (132
passing). Run both before committing. The site build needs network Supabase
access and does not run inside a sandboxed VM.

---

## 8. The strategic frame, as of tonight

Jason asked whether to treat this as a startup, whether to hire, and how it
benefits people. The position reached:

Do not hire. There are no users yet, and hiring before evidence is how solo
founders spend savings on nothing. Volunteers follow traffic rather than
creating it, so a curator community is a phase two thing and cannot be recruited
into an empty site.

This looks more like a good small business than a venture scale company, and
that should change how it is run: no raise, near zero burn, bet on compounding
search traffic, and treat the history API ambition as free optionality rather
than the plan.

The honest value: wrong dates get laundered into model training data and come
back out as confident answers, so a sourced record with its uncertainty stated
rather than hidden is real infrastructure, and nobody has built it for internet
culture. The better human case is smaller: helping somebody place themselves in
time. "I was eleven when that came out" is the sentence the whole product exists
to let somebody say, and it is written into the generator prompt.

The differentiator is honesty about provenance, and it is now visible on the
page rather than only in the database. That same property is what would make the
data worth licensing later, so the trust work and the business are the same work.
