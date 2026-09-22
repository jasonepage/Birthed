# The website walkthrough, September 22, 2026

Hana walked the live site and left a ranked list of eleven items. This is what
each turned out to be and what was done. Website only; nothing here touches the
iPhone app. It belongs in `CLAUDE.md` section 5 as well, and was kept out of that
file here only because the file had uncommitted iPhone work in it at the time.

## What was found

1. **"bbc.comwith", "Sealedat", "The week you wereborn." are not on the page.**
   The markup has the spaces and every browser draws them. The run-together
   words come from reading the page through its accessibility tree, which splits
   an inline element, and a line that wraps, into separate trimmed pieces, so a
   tool that joins those pieces loses the space. Checked on the live site in a
   real browser on September 22, 2026. Nothing was changed for it.
2. **"Your September 22" on a birthday of June 15 was real, and was the cookie.**
   The `by` cookie held the birth year alone, so the site could not tell the
   reader's own date from any other and called every date theirs. It now holds
   the whole birthday, `yyyy-mm-dd` (`birthdayFromCookie` in `serve.ts`). The
   panel says "Your June 15" only on June 15; elsewhere it says "Your birthday is
   June 15", links there, and gives the real age. The song strip says "The week
   you were born" only on the reader's own date, and every age on a row is the
   age on that date in that year (`lifeMark`), so the one year high limit named
   in the editorial pass is gone for anybody with the new cookie. A cookie from
   before holds a year and is read as one, and never claims a day or a week.
   The birth year is still never printed. Nathan's call, with the privacy page
   and the footer edited in the same commit.
3. **Support was the app's page.** It now answers the website first (accounts,
   buzzes, hives and sealing, undo, lost marks, sources, the song lag) and has a
   button that forgets the birthday cookie, which the privacy page had promised
   and no control on the site could do since the year picker came off. The app's
   answers follow under their own heading, unchanged.
4. **The app had no door.** A fourth pill, Get the app, in the bar on every date
   page, beside the birthday button on a phone where the bar has no room, and a
   link in the footer of every page. All point at the TestFlight join link, now
   `TESTFLIGHT_URL` in `render.ts`.
5. **A sealed hive is not filtered.** Every hive that sealed before September 22,
   2026 was cut when `UNBACKED_PLACED` was eight, and a sealed board is never
   re-cut, so September 8 to 20 hold eight to twelve tiles and September 21 on
   hold about forty. The line under a sealed board now says how many buzzes it
   sealed with, and on the older ones that the small board is the rule of the
   time (`sealedLine` in `wall.ts`). Checked against `wall_stories` that day.
6. **The song strip gaps were the hive.** A number one that made the board was
   left out of the strip, because a story on the hive is not repeated below it.
   It is in the strip now, marked On the hive and pointing at its tile. 2026 is
   a different cause: `chart_weeks` ended at the issue dated September 5, 2026,
   so the importer needs running for the weeks since.
7. and 8. **Share.** A story's receipt and a new card page, `/<date>/card/`, carry
   Share (the phone's share sheet, with the picture itself on the card) and Copy
   link. That is a script, the third kind on the site, and the header names it
   by its hash rather than allowing inline scripts, so a receipt, which prints a
   source's words, can run this one and nothing else (`share-button.ts`). Save
   your card and Save this picture open the card page. Receipts also end with
   five more stories from the same hive. Nathan's call.
9. **The cookie copy.** The privacy page was right about `bt`: set on the first
   buzz, not on a page load. The footer was the one out of step: it said one
   random string was the whole of what is kept, and never mentioned `by`. It
   names both now.
10. **/every-date/** redirects to `/calendar/`, since that is the word on the
    pill and people type what they read.
11. **A "why this matters" layer** is open and belongs to Nathan and Jason. Not
    built.

## Not run

Nothing here has been deployed. The tests pass (web, 379). The pages are baked,
so the next deploy is what brings the receipts, the song strip and the sealed
line; the panel, the cookie, the card page and the headers are live the moment
the server restarts.
