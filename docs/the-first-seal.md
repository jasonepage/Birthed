# The first seal, and what happens next session

Written 8 September 2026 at the end of a long session, for whoever picks this
up next.

---

## 1. Tonight, and it is the only thing on this page with a deadline

**September 7's edition closes at 2026-09-09 00:00 UTC, which is 5pm Pacific on
8 September.** It is the first date that will ever seal in this project.

When it seals, `byMemory` should put its rows in the order its own people
remembered them and the page should say "Sealed. In the order the people who
were here remembered it."

**It will not happen on its own.** The sealed order is baked at build time.
`fetchSealedMemory` in `timeline.ts` reads the editions and treats one as sealed
when `closes_at` has passed, which is right and does not depend on anything
stamping `sealed_at`. But nothing runs a build after midnight UTC. Render
deploys on push to `web/**` and that is the whole of the schedule.

So: **push, or press Manual Deploy in Render, any time after 5pm Pacific.**
That is the entire fix for tonight.

### How to tell it worked

Open `/september-7/`. It should carry the line "Sealed. In the order the people
who were here remembered it", the answer buttons should be gone, and the rows
should be in a different order from `/september-9/`, which is still open.

If the line is missing, the build ran before midnight UTC. Run it again.

### What it will look like, honestly

September 7 has three answers from one person, and that person is the
developer. The reorder will be real and it will be meaningless, and the tally
lines will print nothing because the floor is ten answers. That is fine. The
point tonight is to find out whether the pipeline works, and finding that out
now instead of in September 2027 is worth a deploy.

## 2. The fix that outlives tonight

A nightly job that runs `npm run site` after 06:30 UTC. It is on the work list
as a known unknown and it is still not built. Render cron, one line, and it also
covers the other thing that needs a rebuild to appear: anything imported or
curated since the last push.

Until it exists, every seal for the rest of the year depends on somebody
happening to deploy on the right evening.

## 3. What changed today, in one list

Ordered by how much it matters rather than when it happened.

- **The ask card was starved, not broken.** Fourteen rows on September 8 were
  from 1958 on and one could be a candidate, because a 110 character limit
  written for the share image was screening the card. It carried all five
  rotation slots, which is why the card never changed on reload.
- **A plural walked a bomb onto September 11.** The screen matched `bomb` and
  not `bombs`, `attack` and not `attacks`. On the anniversary, one reload in
  five dealt the Father of All Bombs under "Do you remember this one?", on a
  page that did not mention the attacks at all. Both fixed; the attacks row is
  on the page now and can never lead a card.
- **The footer denied a cookie the site sets**, on every page, in the sentence
  written to answer the Reddit accusation. That was the gate on posting
  anywhere and it is closed.
- **Found facts published themselves.** 2,411 sentences were live with nobody
  having read one, because the model's own citation check was writing straight
  into the column the site reads. Split apart: the check is advice now, and new
  facts wait. **The edge function is not deployed. `supabase functions deploy
  find-facts` is still owed.**
- **The site had no notion of importance.** Wikipedia's selected anniversaries
  now rank the cards. `npm run anniversaries` has not been run: only September
  7 and 8 are populated, by hand.
- **The budget became a cooldown.** Ten answers and then nothing until next year
  was a wall people hit in ninety seconds. Two minutes between answers, no
  total, so a date can be worked all evening.
- **A reader sees their own marks** when they come back to a date they
  answered.
- **326 of 357 published culture rows were a bare title** and are off the page
  until somebody writes a sentence. September 8 shows none. Rocket League,
  Amnesia and VVVVVV are the three worth one line each.

## 4. What is owed, in order

1. **Deploy after 5pm Pacific tonight.** Section 1.
2. `supabase functions deploy find-facts`, or new facts keep self-publishing.
3. `npm run anniversaries`, which fills the ranking signal for the other 364
   dates and takes about six minutes at one request a second.
4. The nightly build. Section 2.
5. Write three sentences so September 8 has culture rows again.

## 5. What I would not do next

Generate more rows. There are 354 dates with nothing and it is a real problem
and it is not the problem. `docs/where-this-goes.md` argues this properly: 22
answers in the whole database is the number blocking everything, and a page with
forty good rows that still gives a stranger nothing back is the same page as one
with four.

The next honest move is a hundred answers on one date.
