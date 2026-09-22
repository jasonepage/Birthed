# Posting Birthed to Hacker News

The checklist, so nothing is forgotten. Written September 22, 2026. Tick
each line off by editing this file.

## Before posting

- [x] Page weight. The date page carried every feed row folded under "Show
      all", 617 rows and 418 kilobytes on September 22, plus 207 kilobytes of
      picture rules for rows that draw no picture, plus 39 kilobytes of CSS
      comments. The first dozen rows stay, the rest are on the comb
      (`/<date>/comb/`), the picture rules name only what is drawn, and the
      comments are stripped on the way out. Measure again after deploy.
- [x] The number one song covers moved to the comb too (51 kilobytes of the
      date page), and the comb became a grid of cells by kind, with pictures,
      the covers in the middle, and motion that settles in, breathes on a
      backed cell and drifts behind the heading, all switched off for a
      reader who asked for reduced motion. The comb is the heavy page now,
      which is the point: it is the one a reader asked for.
- [x] "Three a day. Typing spends nothing." cut from under the board, and the
      "Only you can see it" clause cut from the link to /yours/ (the page
      itself already says it).
- [ ] Deploy. After the push, check on the live site: a date page, the comb,
      a story page and its Share button on a phone, the card page, /support/,
      /every-date/.
- [ ] Measure the September 22 page again in the browser's network tab.
      It was 857 kilobytes of HTML before; write the new number here: ____
- [x] Run the song import for 2026 (done September 22: 39 weeks, through September 26), then deploy again (a data change alone
      deploys nothing, see CLAUDE.md "A data change needs a manual deploy"):

      cd worker
      npm run import:songs -- --from 2026 --to 2026 --dry   # look first
      npm run import:songs -- --from 2026 --to 2026

      Then Render, birthed-web, Manual Deploy, Deploy latest commit.
      Wikipedia had the weeks of September 12, 19 and 26 on September 22;
      the table stopped at September 5.
- [ ] Supabase live connections. The project is on Pro with the spend cap
      on, which allows 500 live connections at once and 500 messages a
      second. Every open full screen hive holds one connection, and every
      buzz is one message to every one of them. For launch day, turn the
      spend cap off (Supabase dashboard, Organization, Billing, Cost
      Control), which raises those to 10,000 and 2,500, and turn it back on
      after. If it fills anyway, the page now stops after four tries and says
      "Live paused, reload for the latest"; buzzing still works.

## The post

Title (under 80 characters, no hype):

    Show HN: Birthed, a daily board of what mattered that locks at midnight

Link: https://birthed.app/

First comment, posted right after:

    Hi HN, I'm Jason. I built Birthed on my own.

    Every calendar date gets a board, which I call the hive. It holds
    everything with a birthday on that date: what happened on it in
    history, who was born on it, what was number one, and today's news.
    You get three buzzes a day to spend on what you think people will
    still care about in a few years. Each buzz makes that story's tile
    bigger. At midnight Eastern the next day it seals for good, and next
    year the same date gets a new board beside it.

    Some things HN usually asks about:

    - No accounts. The date pages run no JavaScript; the security header
      is default-src 'none'. A few pages run a small script (the live full
      screen board, the Share buttons, and the page that hands a birthday
      to the app) and the privacy page says exactly what each one does.
    - No analytics, no ads, nothing loaded from another company. The site
      sets two cookies, both HttpOnly: a random string when you buzz, and
      your birthday if you give it, which stays in your browser. Full list:
      https://birthed.app/privacy/
    - AI: a few facts on each date page were found by Google's Gemini
      searching the web. One is shown only if the page it cites loads, and
      each links to that page. Headlines on the board are always the
      source's own words. No model writes or summarizes them.
    - Sources: people from Wikidata, history from Wikipedia's date pages,
      number ones from Wikipedia's Billboard lists, news from public
      newsroom feeds. Every tile has a receipt page with its sources and
      every check run on them.
    - Stack: pages are pre-rendered and served by a small Node server with
      no dependencies on Render; Postgres on Supabase.

    What I'd love feedback on: is the buzz mechanic clear the first time
    you see a board, and what would make you come back tomorrow?

## On the day

- Post on a weekday morning, Eastern time.
- Stay for the first two hours and answer every real question plainly.
- Watch the Render logs and the Supabase Realtime logs.
