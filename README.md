# Birthed

Every calendar date has a page. It shows who was born on it, what happened on
it, the number one song, album and film the week you were born, and a board
called the hive that the people there on the day fill in themselves.

The hive opens at midnight. Everything with a birthday on that date sits in one
pool: today's news, historical events, people born, things released. Whoever
turns up gets three buzzes. A tile's size is its share of the date's buzzes.
At the end of the second day the date seals and stays that way for good. The
same date opens a new hive next year and the old ones stay, so a year later you
can see what a year did to what people thought would last.

Live at [birthed.app](https://birthed.app). iPhone app in TestFlight.

## What happens to your birthday

Short answer: on the website, nothing is stored.

- The month and day you pick only choose which page to send you to. They are
  never written down. See the `/year` handler in
  [`web/src/serve.ts`](web/src/serve.ts).
- The birth year, if you give one, goes into one cookie in your own browser and
  nowhere else. It turns on the song strip and the day counts. Choosing the
  blank option deletes it.
- There are no accounts on the website, no analytics service, no advertising
  and no third party code. Two pages run a script and every other page runs
  none.
- The iPhone app creates a silent anonymous account with a random token and
  sends a month, a day, an optional birth year and an optional typed region to
  it. The list of other people's birthdays you add never leaves the phone.

The full account is on the [privacy page](https://birthed.app/privacy/), which
is written from what the code does rather than from a template, and this
repository is here so you can check it against the code rather than take it on
trust.

## Layout

| Folder | What is in it |
|---|---|
| `Birthed/` | The iPhone app, Swift 6 and SwiftUI. `Birthed/Domain/` is pure Swift with no framework imports and carries nearly all of the correctness risk |
| `BirthedTests/DomainTests/` | The domain tests, runnable from a terminal with `swift test` |
| `web/` | birthed.app. A small Node service that bakes 366 date pages and serves them with no database connection, so a database outage cannot take the site down |
| `worker/` | The nightly importer and the hive's tick. Node and TypeScript, containerised, run on a schedule |
| `supabase/` | Migrations and edge functions. Every table in the public schema has row level security enabled |
| `docs/` | How each decision was reached, including the ones that turned out wrong |

`CLAUDE.md` is the working handoff document. It is blunt about what is broken
and what has never been run, which is the point of it.

## Running it

```
cd web    && npm install && npm run site && npm start
cd worker && npm install && npm test
swift test
```

Copy `web/.env.example`, `worker/.env.example` and `ingestion/.env.example` to
`.env` in the same folder and fill them in. No key is in this repository and
none ever has been. The iPhone app reads its two values from
`Birthed/Config/Secrets.swift`, which is not checked in.

## Where the content comes from

Names, years and descriptions of people come from Wikidata under Creative
Commons Zero. Chart weeks are parsed from Wikipedia's year lists under Creative
Commons Attribution ShareAlike, and every row carries the page it came from.
Event pictures are freely licensed files from Wikimedia Commons. Facts found
about a specific date are found by a model that searches, and each one shows
the page it cites.

Which record was number one on a given date is a fact and cannot be owned.
Birthed is not affiliated with Wikipedia, Wikidata, the Wikimedia Foundation,
Billboard, Penske Media or Google.

## What this is not

There is no revenue and there never has been. No advertising, nothing to buy,
no company. The reward catalogue that an earlier version of this was built
around is still in the schema, unused, and is not coming back.

It is built by one person. If something on the site does not match what the
privacy page says, open an issue and it gets fixed the same day.
