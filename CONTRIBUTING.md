# Contributing

Birthed is built by one person and is public so that anyone can check the
privacy page against the code. Pull requests are read, and small ones are
read first.

## Before opening a pull request

Run the tests for every part you touched, from a clean checkout:

```
cd web && npm install && npm test
cd worker && npm install && npm test
swift test
```

`swift test` runs at the repository root and needs a Swift toolchain. It
compiles `Birthed/Domain/` and `BirthedTests/DomainTests/` through
`Package.swift`. If a change in `Birthed/Domain/` makes it import a
framework, that command fails, and it is meant to.

A change to the iPhone app outside the domain has to be built in Xcode. Say
in the pull request whether you built it and on which simulator or device,
because several sessions in this repository's history changed the app without
compiling it, and `CLAUDE.md` records which of those rules still have a test
that has never been run.

A change to the database is a new file under `supabase/migrations/`, never an
edit to an existing one and never a change made by hand in the dashboard. Say
whether you applied it, and to what.

If the change alters what the website or the app sends, stores or runs, edit
the privacy page in `web/` in the same pull request. The privacy page is
written from what the code does, and it is edited in the same commit as the
code, never after.

## Read first

`CLAUDE.md` is the decision record. Section 5 lists decisions that are made
and are not reopened by a pull request. Section 6 lists rules that each exist
because of a specific bug. Read both before changing anything under
`Birthed/Domain/`, `supabase/migrations/` or `worker/src/wall/`.
`docs/the-wall.md` is the authority for every rule of the hive, and where the
document and the code disagree, the document wins and the code is the bug.

## House rules for anything written

These apply to code, comments, commit messages, documentation and copy shown
to a reader.

- No em dashes. Use commas, colons or separate sentences.
- Write out an abbreviation before using it, and prefer the plain full term
  throughout.
- Degrees Fahrenheit only, never Celsius.
- Cite requirement identifiers in commit messages where one applies, for
  example `feat(dayplan): order by redemption window close (FR-092)`. The
  identifiers are in `docs/specs/SRS.md`.
- Say what is unknown rather than guessing. If a design question is not
  answered in the specifications, ask in the pull request rather than
  inventing an answer and burying it in code.
- Commit messages follow the log: a type, an optional scope in parentheses, a
  colon, and a plain sentence. Types in use are `feat`, `fix`, `docs` and
  `chore`. Split commits by what changed, not by when it was written.

## Changes that are wanted

- A bug in date arithmetic, with a test in `BirthedTests/DomainTests/` that
  fails before the fix and passes after.
- A mismatch between the privacy page and what the code does.
- A source that the worker reads wrongly, with the real page it misread.
- A migration that tightens row level security or pins a function's search
  path.
- A correction to a fact in `docs/` or `CLAUDE.md`, with the page that shows
  it is wrong.
- A wrong date in `Birthed/Domain/WorldThen.swift`, checked against the page
  linked on that timeline.

## Changes that are not wanted

- Any analytics service, advertising, tracking, or third party code that
  reports on a reader. The privacy page says there is none and that is not
  going to change.
- A dependency where the standard library will do. The website has no
  runtime dependencies on purpose.
- Anything that lets one user contact another. Messaging, following, feeds,
  rooms and wishes are refused in `docs/specs/PRD.md` section 4.4 and `CLAUDE.md`
  section 5.
- A score, karma, honey or any reward for buzzing. `docs/the-wall.md`
  sections 6 and 8 refuse it.
- Reopening a decision listed in `CLAUDE.md` section 5. If you think one is
  wrong, open an issue that says why, with evidence, rather than a pull
  request that changes it.
- Work on the reward catalog. It is in the schema, tested, and unused.
- A change to the hive's clock, its budget, or the immutability of
  `wall_boosts`. These are the product.
- Rewriting `docs/` to sound better. The documents are candid about failures
  on purpose.

## What a maintainer will check

- Tests pass for each part touched.
- No em dashes anywhere in the diff.
- No secret, key or `.env` file. `.gitignore` names them and the check is
  repeated by hand.
- The privacy page still says what the code does.
- The commit message says what changed and, where one applies, which
  requirement.
