# Test pass for Jason, September 6, 2026

Everything below is built and unbuilt: no compiler has seen tonight's Swift.
Work down the list in order and send back a screenshot for each numbered item
plus the exact text of any error. If something fails to build, stop and send
the first error rather than the last one, because the first is usually the
real one and the rest are its echoes.

## Before you build, one thing you have to click: done, September 6

**Nothing to do here any more.** Jason did it and it is checked in.
`Birthed/Info.plist` now carries the `birthed` scheme under the identifier
`app.birthed.ios`, and `INFOPLIST_FILE` points the target at it alongside
`GENERATE_INFOPLIST_FILE`, which is the supported pairing: Xcode merges the
generated keys into that file rather than replacing it. Because the file is
tracked by git, a fresh clone has the scheme too, which the old instruction
below could not promise.

The old instruction, kept because it explains why the file exists at all: a
URL type is an array of dictionaries, and the `INFOPLIST_KEY_` build settings
cannot express one, so this is the only part of the project that needs a real
property list.

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

19. **Following someone famous.** People tab, the plus, then "Follow someone
    famous". With nothing typed you should get a list headed "People around
    your age". The thing to judge is whether it reads like a mix. If it is six
    footballers in a row, the spread is not working and I want to know.
    Screenshot it.

    Then type "mercury". You should get Freddie Mercury and a TikToker called
    Mercury Stardust. Tap the plus on one, go to the People tab, and confirm
    they are in the list with their date. Go back into the search and the plus
    on that person should now be a tick.

20. **The empty People tab.** Delete everybody from People so the list is
    empty, then leave the tab and come back. Under the candle and the paste
    button there should be a heading OR FOLLOW SOMEBODY and three people with
    plus buttons. Tap one plus. That person should appear in the list and the
    empty state should go, because the list is no longer empty. Screenshot the
    empty state before you tap.

21. **The old screens still work.** These are the ones tonight's changes could
    have broken by accident, so a quick look at each is enough:
    - Fresh onboarding, day wheel then year wheel, answering as you turn it.
    - The birthday state. Set the date to today, hold the candle, watch it
      blow out and relight.
    - Play the reveal again, from Settings.
    - The Today tab and the People tab, just that they open and fill.

22. **The empty People tab scrolls.** With nobody in the list, the screen has
    a candle, a sentence, a paste button, three people to follow and an "Add
    someone" button. That is taller than a 6.1 inch phone and was cut off at
    the bottom. Scroll to the bottom of it and confirm you can reach and tap
    "Add someone". On a large phone where it all fits, it should not bounce.

23. **A followed person carries their year.** Follow Ariana Grande from the
    search. Her row in People should read "June 26 · turns 33", not just
    "June 26", and opening her in the editor should show 1993 in the Year row
    rather than "Do not know".

24. **Somebody who has died is worded differently.** Follow XXXTentacion
    (January 23, died 2018). Three things to check, and all three are about
    tone rather than function:
    - The search row reads "January 23, 1998 to 2018".
    - The People row reads "would have been 28", never "turns 28".
    - Set your phone's date to January 23 to make his card the celebrating
      one at the top. It should say REMEMBERING, not TODAY.
    If you can get a notification to fire for him, it should say "Remembering
    XXXTentacion / Born today in 1998" rather than "say something".

25. **Asking somebody for their birthday.** This is the new one and it needs
    two devices, or a phone and a browser.
    - People tab, plus, "Paste a list or send a link". There is a new section
      OR ASK FOR THEIRS. Type your name in it and tap "Make a request link".
    - Share the link to yourself and open it in Safari. It should say
      "<your name> wants your birthday", the name field should say "Your
      name" rather than "Your name, if you want", and the button should say
      "Send it" rather than "Make my link".
    - Fill it in with a name and a date and press send. The page should
      replace itself with "Sent".
    - Go back to Birthed and background it, then open it again. A sheet
      should come up saying "<name> sent you their birthday", with the name
      already filled in. Tap Add. They should be in your People list.
    - Open the app again. It must not ask you about that same person a
      second time.
    - Do it once more but tap "Not now" instead. Force quit Birthed and
      reopen it. That one should come back.

26. **The link route still works with no server.** On the same web page, open
    birthed.app/add with nothing after it. It should still be the old form
    with "Make my link", and pressing it should still produce a link with a
    hash in it and no question mark.

## Added later on September 6: the birthday message

Also unbuilt. Three new files, `Birthed/Domain/BirthdayMessage.swift`,
`Birthed/Features/People/SaySomethingView.swift` and
`BirthedTests/DomainTests/BirthdayMessageTests.swift`, and edits to
`NotificationService`, `NotificationPlanner`, `RootView` and `PeopleView`.
The synchronised folder picks the new files up on its own. The composer
imports `MessageUI`, which Xcode links by itself.

Two things in here lean on the newer compiler. `NotificationTapHandler` in
`NotificationService.swift` is declared `nonisolated final class`, which
needs Swift 6.1 or later; if the build says `nonisolated` cannot be applied
to a class, send that error and stop. The Messages coordinator in
`SaySomethingView.swift` conforms with `@preconcurrency`; if the build
merely warns that the attribute has no effect, ignore it.

27. **`swift test` first.** It should now report 118 tests or so, and every
    one in `BirthdayMessageTests` passing. If any of the hundred fails, send
    the whole failure line: it names the case, what the Swift said and what
    it should have said.

28. **The card on the day.** Add somebody whose birthday is today with a note
    of "Mum" and a year that makes them 60. The pink card should now have a
    paper plane on the right. Tap it. A sheet titled with their name should
    open, kicker TODAY, and the text should read exactly "Happy 60th Mum.
    Hope it's a good one." or one of the other two family closings. Tap into
    the text and change a word; nothing should ask you to confirm. Send in
    Messages should open the Messages composer with the text in the body and
    the To field empty. Cancel it. The share button should open the share
    sheet with the same text.

29. **Somebody followed.** Follow a living public figure whose birthday is
    today, or change the date of somebody followed to today, and tap the
    card. The line should be "<name> turns <age> today." and the only button
    should be Share. For somebody who has died the kicker should say
    REMEMBERING, the text should say when they were born, and nothing on the
    screen should say happy.

30. **The notification tap.** With reminders on, add a friend whose birthday
    is today and set the phone's clock forward past eight in the morning
    tomorrow, or temporarily change `NotificationPlanner.hour` and `minute`
    to a minute from now, add the person, and wait. When the banner arrives,
    tap it. The app should open on People with the composer already up for
    that person. Try it once with the app closed and once with it in the
    background. Then tap the three day warning for somebody else: it should
    open People with no sheet.

31. **Long press still edits.** On the pink card, long press. Edit and Remove
    should be there. Edit should open the editor as before.

## Added later still on September 6: the Today feed

Unbuilt. `Birthed/Domain/DayFeed.swift` and its tests are new; `DayPageView`
and `DayPageViewModel` are rewritten; `DayPageRepository` gained two reads and
is now `Sendable`. Two migrations are already applied to the live database
and checked in. The events import is written and has not been run against
Wikipedia, because neither machine this was written from can reach it.

32. **`swift test`.** `DayFeedTests` should pass, eleven of them.

33. **`cd worker && npm test`**, then
    `node dist/src/import-events.js --dry --print --month 9 --day 5`.
    Send the output. It should be forty to a hundred lines, each a year and a
    sentence, no `[12]` markers, no wiki markup, nothing from Births. If it
    reads zero, send the notes the script prints under the count.

34. **Then the lot:** `node dist/src/import-events.js`. About 366 requests and
    a few minutes. Send the report at the end, especially the "things to look
    at" list. Rerunning is safe.

35. **Build, Today tab, September 4, 2002 profile.** The screen should be one
    feed: a large first row, then rows taking turns between ON THIS DAY, BORN
    TODAY, NUMBER ONE SONG and NUMBER ONE FILM, with the found facts mixed in
    carrying their like and share. Each row has a pink kicker and a grey pill
    reading YOU WERE 7 and so on. Scroll to the bottom: rows should read N
    YEARS BEFORE YOU. Screenshot the top and the bottom.

36. **Arrows.** Step to September 5 and back. Nothing should flash the wrong
    date's rows under the new heading. Step to a date with no facts: the feed
    should still be there from songs, films and people.

37. **Settings, set the year to "Rather not say", back to Today.** No pills,
    the line under the date says to add the year, songs run from 1959.

38. **February 29 profile.** Today tab loads and songs appear. (The chart
    function used to fall over on this and was fixed before you saw it.)

## Added later still: the facts are dealt, not ranked

39. **`swift test`**, `FactOrderTests`, seven of them.

40. **Mine, twice.** Open Mine, note which fact is set large at the top. Pull
    down to refresh. A different fact should usually lead, and the like
    counts should be unchanged. Open the app again tomorrow: different again.
    Tap like on a fact: the count moves and nothing reorders.

41. **The Edge Function is deployed (version 15).** Nothing to do until a
    date's first search is thirty days old, which is October 4 for September
    4, 2002. On that day, opening Mine should show "Still looking" under the
    facts for about half a minute and then new rows should arrive without
    repeating the old ones. `birth_fact_runs.searches` for that row is the
    cost.

## Added later still: following somebody twice

42. **Ariana stays followed.** Open Follow someone. Ariana Grande, who is
    already in your list, should show a tick, not a plus. Tap Done, open it
    again: the twenty people should be a different twenty, and nobody you
    already follow should be in it.

43. **Editing a followed person keeps them followed.** Tap Charlie Kirk's row
    on People, change nothing, tap Done. His row should still say "would have
    been", not "turns", and the follow sheet should still show him ticked.
    The old build turned him into somebody typed in.

44. **The one row that was already broken.** Your existing Ariana row was
    saved by the old editor with no identifier, so she still gets the three
    day warning a friend gets. Remove her and follow her again and she is
    right. Nothing else on the list needs this.

## Added later still: the world when you arrived

45. **`swift test`**, `WorldThenTests`, twelve of them.

46. **Mine, under the candle.** A new section, THE WORLD WHEN YOU ARRIVED,
    with five rows. For September 4, 2002 the first should read "You are 15
    years older than Fortnite." and the rest should be Minecraft, ChatGPT,
    Instagram, Discord. Each has a share button; tap one and the card should
    say "I am", not "You are". The share picker on the toolbar gains the top
    line as a card.

47. **Check five dates against their pages.** The timelines were written from
    memory by something that could not open Wikipedia. Open
    `Birthed/Domain/WorldThen.swift` and check, on the linked articles: the
    Fortnite Chapter 2 Season 1 start, Minecraft 1.16, the iPhone 4S release,
    the PlayStation 4 release, and the Instagram launch. If any is off, fix
    the row and tell me which, and I will go through the rest.

## Added later still: the feed is dealt on every pull

48. **Today, pull down twice.** The rows near the top should come in a
    different order each pull, and rows from before you were born should
    still be at the bottom both times. `swift test` has three tests for this
    in `DayFeedTests`.

## Added later still: the one permission, and the site's blank page

49. **The reminder row.** Delete the app and reinstall it, or reset it, so
    that iOS has never asked you about notifications for Birthed. Finish
    onboarding, go to People, add one person. A row should appear directly
    under that person's card reading "Remind me the morning of and three days
    before", switched on. Nothing should happen while you look at it: no iOS
    prompt, no banner. Now switch to Mine. The iOS notification prompt should
    appear. Allow it, go back to People, and the row should be gone.
    Screenshot the row before you leave the screen.

50. **Turning it off is an answer.** Reset again, add one person, switch the
    row off, and leave the screen. No iOS prompt should appear at all. Come
    back to People and add a second person: the row must not return. The
    switch in Settings should read off.

51. **The blank page on birthed.app.** Before you redeploy, open
    `birthed.app/add#c=SCJDBSJD&r=Jason` in Firefox with the console open
    (Command Option K) and reload. Send me what the console says. I expect a
    Content Security Policy line about an inline script being blocked, which
    is the bug and is fixed in this change. Then redeploy the site on Render
    and open the same address again: it should read "Jason wants your
    birthday" with a name box, a date and a Send it button. Fill it in, press
    Send it, and it should say Sent. Then open the app: the birthday should
    be waiting to be confirmed.

## What I need back

The screenshots, in order, and any error text verbatim. For anything that
looks wrong rather than broken, say what you expected instead. Item 2, item 8,
item 9, item 12, item 14, item 16 and item 19 are the seven that matter most, because nobody has seen any
of those states yet.

Item 25 is the one to do first if you only do one. It is the only feature in
Birthed that writes another person's data to our server, the database side of
it has been tested against the live project but the app side has never run,
and if the collect step does not work the whole thing is a link that goes
nowhere.
