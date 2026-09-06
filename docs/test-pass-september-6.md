# Test pass for Jason, September 6, 2026

Everything below is built and unbuilt: no compiler has seen tonight's Swift.
Work down the list in order and send back a screenshot for each numbered item
plus the exact text of any error. If something fails to build, stop and send
the first error rather than the last one, because the first is usually the
real one and the rest are its echoes.

## Before you build, one thing you have to click

The app now opens birthday links, and registering the `birthed://` scheme is
the one part that cannot be written into a file here. This project has
`GENERATE_INFOPLIST_FILE = YES` and no Info.plist, and a URL type is an array
of dictionaries, which the `INFOPLIST_KEY_` build settings cannot express.

In Xcode: select the Birthed target, the Info tab, expand URL Types, press
plus, set Identifier to `app.birthed.ios` and URL Schemes to `birthed`. Leave
everything else alone. It takes a minute and without it items 17 and 18 below
do nothing at all, which will look like broken code and is not.

## Before you build

Nothing else to add to the project. The Birthed target uses Xcode's synchronised
folders, so `Birthed/Features/MyDay/FoundFactsSection.swift`, which is new
tonight, is picked up from the file system on its own.

Set your profile to **September 4, 2002** with the region **Salem, Oregon**
before you start. That is the one date whose facts are already searched and
cached on the server, so it comes back instantly. Any other date will work
too, but it will take about thirty seconds the first time and cost real money,
so use September 4, 2002 unless a step below says otherwise.

## The list

1. **It builds.** Just that. Send the build succeeded banner, or the first
   error.

2. **Mine, dark appearance.** Under the stage there should be a pink heading
   reading FOUND ABOUT YOUR DAY and about nine facts under it, each a serif
   sentence with a small pink category above it, a thumbs up on the right, and
   a grey web address underneath. Rows are separated by hairlines, not boxed
   in cards. Scroll all the way down and screenshot the whole section in two
   shots if it does not fit in one.

3. **Mine, light appearance.** The same section again. The facts should be
   dark type on cream, the hairlines should still be visible but faint, and
   the pink should be the same pink as in dark.

4. **The local facts are marked.** Two of the facts, the Salem weather one and
   the Salem-Keizer Volcanoes one, should carry a small grey NEAR YOU pill
   next to the category. Screenshot one of them close up.

5. **A source opens.** Tap the web address under any fact. It should open that
   page in Safari. Come back and confirm the app is where you left it.

6. **A thumbs up.** Tap the thumbs up on a fact. It should fill in, turn pink,
   the count should tick up by one, and you should feel a light tap. Tap it
   again and it should go back. Then force quit the app, reopen it, and go
   back to Mine: your thumbs up should still be filled in. That last part is
   the one that proves the like reached the server rather than only the screen.

7. **The order changes.** Like the fact that is currently last in the list.
   Force quit, reopen, and go to Mine. That fact should now be at or near the
   top, because the list is ordered by likes. Screenshot before and after.

8. **A date that has never been searched.** Change your birthday in Settings
   to **March 12, 1998**, leave the region as Salem, and go to Mine. You
   should see the heading, a small lit candle, and the words "Looking into
   March 12, 1998". Screenshot that state, because it is the one nobody has
   seen yet. Wait. Within about a minute the facts should slide in underneath
   and the candle line should go. Screenshot the result. Then set your
   birthday back to September 4, 2002.

9. **The share sheet.** Tap Share on Mine. The row of cards should now start
   with Your day, then three fact cards, then The song and the rest. The fact
   cards should have the date across the top in pink, the fact set in serif at
   a smaller size than the song card uses, and the web address at the bottom.
   Screenshot the row, then screenshot one fact card on its own.

10. **A fact card actually shares.** Tap Share under one fact card and send it
    to yourself in Messages. Confirm the image that arrives is the whole card,
    not a cropped one, and that the candle in it is still rather than mid
    flicker.

11. **No birth year.** In Settings, clear your birth year. Go to Mine. The
    facts should be about September 4 across history rather than about 2002,
    and the searching line should say "Looking into September 4" with no year.
    Screenshot it. Put the year back afterwards.

12. **The Today tab, which is the other half of tonight.** Open Today. Under
    the date there should now be a section headed WHAT HAPPENED ON THIS DAY,
    with the first fact set noticeably larger than the rest, and then the
    names below it rather than above. Screenshot the top of the screen in
    both appearances. Step back and forward a few days with the arrows and
    confirm the facts change with the date and that nothing flickers or gets
    left behind from the previous day.

13. **A date with no facts.** Not every date has been searched yet, so step
    around until you find one with no WHAT HAPPENED section. Confirm there is
    no empty heading, no spinner and no gap, just the names. If every date you
    try has facts, say so and skip this.

14. **Sharing one fact.** Every fact row has a share icon next to its thumbs
    up now. Tap it on a fact in the middle of the list, not the top one. A
    sheet should open with exactly one card, that fact, set smaller than a
    song card because the sentence is long. Send it to yourself and confirm
    the card carries the fact, the source, and the candle. Do this on both
    Mine and Today.

15. **Sources screen.** Settings, then Sources. There should now be three
    cards: Wikidata, Wikipedia, and Google Gemini. Check that the Wikipedia
    card mentions chart weeks and Creative Commons Attribution ShareAlike,
    which it did not before, and that the Google Gemini card links to
    ai.google.dev and to the privacy page. Screenshot it.

16. **Paste a list.** People tab, the plus, then "Paste a list or send a link".
    Paste this in exactly:

    ```
    Sam 3/14
    Priya - March 14
    Alex: 14 March 2003
    Jordan 12/25/1999
    Mia Dec 2
    1. Casey 7/4
    Sam 555-1234
    ```

    It should find six, not seven. The phone number line is not a birthday and
    the parser is meant to know that. Casey should come through as "Casey" with
    no "1." on the front. Each row shows the name, the date it read, and the
    original line underneath. Tap one to leave it out and the count in the top
    right should drop. Add them and check the People tab has them all with the
    right dates. Screenshot the found list before you add.

17. **Your own link.** Same screen, scroll down, tap "Share my birthday link"
    and send it to yourself. Open it on the phone. It should land on
    birthed.app, show your date, and offer "Add it in Birthed". Tap that and
    the app should open with a sheet asking what you call them, with the name
    field empty and the keyboard up. Type a name, tap Add, and it should land
    in the People tab. Screenshot the web page and the sheet.

18. **A link with a name in it.** On the same web page with nothing after the
    hash, so just birthed.app/add, fill the form in as somebody else and press
    "Make my link". Send that link to yourself and open it. This time the sheet
    should arrive with the name already filled in. This is the flow a friend
    uses to send you theirs.

19. **The old screens still work.** These are the ones tonight's changes could
    have broken by accident, so a quick look at each is enough:
    - Fresh onboarding, day wheel then year wheel, answering as you turn it.
    - The birthday state. Set the date to today, hold the candle, watch it
      blow out and relight.
    - Play the reveal again, from Settings.
    - The Today tab and the People tab, just that they open and fill.

## What I need back

The screenshots, in order, and any error text verbatim. For anything that
looks wrong rather than broken, say what you expected instead. Item 2, item 8,
item 9, item 12, item 14 and item 16 are the six that matter most, because nobody has seen any
of those states yet.
