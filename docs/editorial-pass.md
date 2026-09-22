# The editorial pass

September 22, 2026. The date page's data is good and it was shown raw: whole
encyclopedia sentences at headline size, the same badge on every row, a song
strip that ignored the reader, and template rows nobody would pick by hand.
This is what was done about it, and what is left, in order.

## Done, September 22, 2026

- **The violence screen reaches the hive.** `notabilityScore` forced these
  people to nought, which kept them off the top of a date page, but
  `hivePeoplePath` reads every person on a date with no floor, so a nought
  was filed last and still got a Buzz button. `planHistory` now drops anyone
  `isViolentNotoriety` catches, by description, so a new term applies on the
  next tick without a re-import. "sentenced to death" and "death row" were
  added after "Hamida Djandoubi, sentenced to death in France" appeared on
  the September 22 hive.
- **A feed row says nothing about the lowest tier.** `rowChip` in `wall.ts`.
  Every seeded story is claimed and stays claimed, so "Claimed" sat on every
  row. The receipt still names every tier, claimed included.
- **The song strip starts at the reader's year.** `songMark` in `serve.ts`
  now sets the grid's `order` so a reader with a year sees their own week
  first, then one card per birthday with "You were 16." on it, then the
  years before them. Nobody else's page changes, because it is all in the
  per reader style block that already marked the birth week.
- **Dated feed rows carry the reader's age.** `yearAttr` in `wall.ts` bakes
  `data-y="1975"` on any row whose headline opens "1975: ", and `ageMark` in
  `serve.ts` writes "You were 11" above it. News and people rows get none.

## Known limit, and the next real fix

**The cookie holds a year, not a birthday.** The panel, the song mark and
now the ages all treat the date being read as the reader's own. On somebody
else's date an age can be one year high, and "The week you were born" marks
a week that was not. `/year` already receives the month and day and throws
them away. Keeping them changes what the privacy page says the site stores,
so it is a decision with the privacy page open beside it, not a patch.

## Left for the next session, in order

1. **Clean the live September 22 hive.** The Djandoubi story is already
   filed in `wall_stories` and the new screen only stops new ones. Deleting
   it is a live database delete, so ask first. Check other open dates for
   the same shape.
2. **Short headlines, rule first.** Use the unapplied migration
   `20260922120000_does_it_look_like_history.sql` (`sentence`,
   `sentence_model`, `sentence_at`), add a fingerprint of the source
   headline to that same file rather than a second migration, and never
   overwrite `headline`, which the checker matches against the page. The
   rule to write into `the-wall.md` before building: a short headline may
   shorten the source and never add to it. Every number and every
   capitalised name in it must appear in the source headline, it is thrown
   out when the fingerprint no longer matches, and one that fails is never
   shown. Generate in a one-off batch script like `npm run pictures`, never
   in the tick, which is near its memory ceiling. It spends money, so ask
   before the first full run.
3. **People tiles.** `personHeadline` could say "Tatiana Maslany, Canadian
   actress, turns 41" on a living person's hive, which is true for that
   hive's year. It changes `headline`, so check what the checker does with
   person rows first, and `repair-person-headlines.ts` is the pattern for
   the rows already filed.
4. **Template rows.** "1974: Bad Company by Bad Company was the number one
   album" and the box office rows. Either merge each year's song, album and
   film into one card, or take them out of the feed and give them a strip
   like the songs. It bends "everything with a birthday is a pixel", so it is
   Jason's and Nathan's call.
5. **`import:all` with the 1400 floor**, at a quiet hour, then Render,
   birthed-web, Manual Deploy. Until then there is nobody born before 1600.

## Parked

- **Head to head.** Read `docs/the-wall.md` section 15 first. A pairwise
  pick produces a ranking, not a boost, so it does not fit `wall_boosts`.
- **Song previews.** The iTunes response likely carries a preview address,
  but copying the clip is probably against Apple's terms and linking it
  means opening the site's security policy to Apple's servers.
- **The 324 MB of pictures in git history.** Fixing it rewrites history,
  which cannot be undone. Jason's call.

## Note for anybody running the web tests from the Cowork shell

The server tests write scratch folders under `web/` and delete them after.
Without delete permission on the folder the deletes fail, twelve tests fail
with `EPERM`, the folders are left behind, and a `git status` can leave a
stale `.git/index.lock` that blocks git on the Mac. Grant delete permission
before running them.
