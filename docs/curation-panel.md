# The curation panel

What /admin is for, what it must never become, and the one change that has to
land before a model is allowed anywhere near it.

Read `docs/internet-culture.md` for what a row may claim and
`docs/dating-the-internet.md` for where dates come from. This document is about
the tool, not the content.

---

## 1. The one sentence

A curator's time is the scarcest thing this project has, so the panel exists to
spend it on judgment and on nothing else.

---

## 2. What it is, and the thing it must not turn into

It is not a table editor. Supabase already ships one of those and it is better
than anything built here would be.

It is a queue. A curator is handed one thing and one decision, over and over,
as fast as they can make them. Everything else on the screen is there to make
that decision take less time: what the date already has, where the claim came
from, whether the page it cites actually opens.

The test for any feature proposed for this panel: does it reduce the seconds
between decisions, or does it add a field somebody has to fill in? A form is
what you build when you have not decided what the work is.

---

## 3. The state a row is in, which does not exist yet

**This is the blocking change and nothing else in this document is safe without
it.**

`cultural_events` has no state. Every row in it is live, because the site reads
the table directly. A batch generator pointed at that table publishes Gemini's
output to 366 public pages the moment it finishes, with nobody having read a
word of it.

So a row needs three states:

| State | What it means | Who sees it |
|---|---|---|
| `candidate` | Proposed. By a model, an importer, or a person in a hurry. | The panel only |
| `published` | A curator read it and said yes. | Everybody |
| `rejected` | A curator read it and said no. | The panel only, forever |

Rejected rows are kept and never deleted. They are the only record of what the
generator keeps proposing that is not good enough, and that record is what
tells you the prompt is wrong rather than the model being unlucky. A generator
that proposes the same rejected thing forty times is a fixable problem, and it
is invisible if the rejections are thrown away.

The site's query gains `and status = 'published'`. The panel's queue is
`status = 'candidate'`. That is the whole mechanism.

The ten rows already in the table were written by hand and go straight to
`published`, since a person wrote every one of them.

---

## 4. Generation: do not build a second one

`find-facts` already is this. It has, and it cost real money and two documented
failures to learn each one:

- Two calls, not one. Asking for research and for JSON in the same breath made
  the model stop searching and answer from memory with invented addresses that
  looked real. The research call has search on and returns prose; the shaping
  call has no search and nothing to look up.
- A retry when the model did not search at all, checked against the query list
  Google reports back, because there is no setting that makes the tool
  compulsory.
- Every cited page has to answer before the row counts as verified.
- A monthly budget in `fact_search_budget`, so a runaway loop is a paused
  feature rather than a bill.
- A `TASTE` block that already says teens and twenties, name the specific
  thing, prefer the internet, at most two space facts.

What a cultural generator needs that is genuinely different:

1. It writes to `cultural_events` as `candidate`, not to `birth_facts`.
2. Its prompt is built from `docs/internet-culture.md` rather than from the
   birthday taste block: file the event and not the meme, say which kind of
   date it is, do not explain the joke, thin years stay thin.
3. It asks for a date with a year, not a fact about a date. That is a different
   question and it is the harder one.
4. It refuses to propose anything it cannot date to a day.

Everything else is the same function with a different prompt and a different
destination table. Write it as a sibling of `find-facts`, share the shape, and
do not reimplement the parts that were paid for.

---

## 5. The review loop

One row on screen. Four keys.

| Key | Does |
|---|---|
| `j` / `k` | Next, previous |
| `a` | Publish |
| `r` | Reject |
| `e` | Edit the sentence, then publish |

No mouse in the common path. A curator who has to move a hand to a trackpad
between every decision does thirty an hour; one who does not does two hundred.
That difference is the entire reason to build a queue rather than a list.

Each item shows the proposed sentence, the date, the category, the source as a
real link, and one line saying whether that link answered when it was checked
and when. Nothing else. Everything else is a reason to stop and read.

Edit and publish is one action, not two, because the most common outcome for a
generated row is that it is right and badly written.

---

## 6. Batches, and the budget

Generation runs against a date, a month, or a list of dates, and it runs behind
the response the way `find-facts` already does: answer at once, work after, let
the panel poll. A curator asking for a month of candidates should not hold a
connection open for four minutes.

The budget is not optional and it is not a number in the code. `find-facts`
already puts its ceiling in a table so it can be raised by somebody looking at
a bill rather than by a deploy. Do the same, count against the same month, and
show what is left in the panel. A curator who cannot see the meter will find it
by hitting it.

A batch that would exceed the remaining budget generates what it can and says
how many it skipped. It does not fail, and it does not silently do less than it
was asked.

---

## 7. Who did what

There is no audit trail today and that is fine for one person and wrong for a
team. Every publish, reject and edit records the account, the time, and for an
edit the previous text.

Not for policing. For two specific things that will happen: somebody will ask
why a row on a live page says what it says, and somebody will publish forty
rows in a bad hour and the whole batch will need finding again.

---

## 8. What must never be automated

The decision. That is the whole job.

A model may propose, may date, may check its own citation and may draft the
sentence. It must never publish, and there must be no setting anywhere that
lets it. The moment there is an auto-publish threshold, the panel becomes a
thing that watches Gemini write the site, and the reason this project has any
claim to being better than a scraped almanac disappears.

The rate this justifies is worth being clear about: at three seconds a decision
a curator publishes several hundred rows an hour. There is no throughput
problem that auto-publishing solves.

---

## 9. The security model, as actually built

The panel is a static page carrying the publishable key, the same one in the
iOS app and in `/add`. Nothing is protected by the page being hard to find.

- `admin_emails` decides who curates, by address, so somebody can be allowed
  before their account exists.
- `is_admin()` checks `auth.users`, not the email claim in the token, because
  the table knows two things the claim does not: whether the address was
  confirmed, and whether the account is anonymous. The app signs every reader
  in anonymously on first launch, so without that second test every reader
  would be one reasonable looking row away from writing to the date pages.
- Every write is a row level security policy. The panel hides controls a
  non-curator cannot use, which is politeness and not protection.
- `/admin` is one of exactly two paths on the site with a widened policy. A
  test asserts `/administrator` is not one of them.

A generation endpoint is called with the curator's own token and must check
`is_admin()` itself. `verify_jwt` alone is not enough: every reader of the iOS
app holds a valid token.

---

## 10. Honest limits

**A queue only works if something fills it.** The generator is the feeder, and
until it exists the panel is a form with a calendar on top. That is what it is
today and this document is mostly about the difference.

**The budget is a real ceiling and the backfill numbers are known.** 283 dates
of birthday facts cost 3,182 searches and about forty dollars. Cultural
candidates for 366 dates are the same order. That is a number to decide on
before the run, not after it.

**Rejections are only useful if somebody reads them.** The record exists so a
bad prompt can be found. Nobody will look unless there is a screen that shows
the most rejected shapes, and that screen is worth building the first time the
generator disappoints.

**Nothing here has been tried with more than one curator.** Every claim about
keyboard speed and queue throughput in section 5 is reasoning, not measurement.

---

## 11. Acceptance

- A generated row cannot appear on birthed.app without a curator publishing it,
  and there is a test that proves it.
- The site's query filters on `published`, and a `candidate` row on a date does
  not change that date's page.
- A rejected row is never proposed again by the same generator run.
- The budget meter is visible in the panel before a batch is started.
- A batch over budget produces what it can and says what it skipped.
- Every publish, reject and edit is attributable to an account.
- The queue is operable start to finish without a pointing device.
