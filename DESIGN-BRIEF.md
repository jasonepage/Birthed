# Birthed: make the app worth opening

A brief for whoever takes the interface next. Everything you need is in here;
you should not have to reconstruct any of it from conversation history.

---

## 1. What this is

Birthed is an iOS app about the day you were born. Who else has it, what was
number one that week, how many days you have been here, and whose birthdays you
keep forgetting.

**The audience is teens and twenties. The Famous Birthdays crowd.** Not
sentimental adults, not people organising a party. People who look this stuff up
because it is about them, screenshot it, and post it.

**Identity is the product.** There was a rewards and coupon business attached to
this once. It is cut. There is no paywall, no catalog, no offers. Growth first.
Anything in `PRD.md` or `SRS.md` about brands, offers, qualification or
entitlements is dead; `CLAUDE.md` section 5 records what replaced it and is the
document that wins in any disagreement.

Distribution is two things: date pages on birthed.app for search, and short form
video. **Both of those are screenshots of this app.** That is the frame for
every decision below. The question is not "is this screen usable", it is "would
a nineteen year old screenshot this".

---

## 2. Your job

Make the interface dramatically better. Onboarding especially. You have full
licence over anything in `Birthed/Features/` and `Birthed/Design/`, including
throwing screens away and starting again.

Not asked for: correctness work, data work, or the worker. Those are done and
tested and are not where the problem is.

---

## 3. What exists right now

Three tabs and a settings cog. No "Me" tab: settings is a thing you do once and
leave, not a place you go.

```
Birthed/
  App/BirthedApp.swift          wires four stores into the environment
  Design/
    Theme.swift                 the whole visual vocabulary, one file
    CandleMark.swift            the app icon's candle, drawn in SwiftUI
  Features/
    Root/RootView.swift         onboarding or the tabs; opens on Mine inside
                                the birthday window
    Onboarding/
      OnboardingView.swift      three screens: day, year, place
      BirthdayPicker.swift      month and day, February 29 always selectable
    DayPage/                    the Today tab
      DayPageView.swift         people born on a date, browsable day by day
      DayPageViewModel.swift
      ShareCardView.swift       1080x1350, the date and six people, anonymous
    MyDay/                      the Mine tab
      MyDayView.swift           countdown, weekday, number one song, twins
      MyDayShareCard.swift      1080x1350, personal, only made on tap
    People/
      PeopleView.swift          other people's birthdays, soonest first
      PersonEditor.swift
    Settings/
      SettingsView.swift        birthday, region, reminders, sources, delete
      AttributionsView.swift
```

Data is already there and already good. The Mine tab knows the day of the week
you were born, the number one song the week you were born, and how many days you
have been alive. The Today tab has the ten most looked up people for any date.
None of that needs your attention except as material.

---

## 4. The visual vocabulary

All of it is in `Birthed/Design/Theme.swift`. Use it. Do not introduce a second
palette.

| | |
|---|---|
| `accent` | `#EF5680`, the pink straw the product came from. Same value as the app icon and both share cards. |
| `accentSoft` / `accentDeep` | `#FF88A8` / `#A8265A`, the ends of the celebration gradient |
| `ember` / `emberLight` / `emberDeep` | the flame |
| `wax` / `waxLight` | the candle body |
| `ink` | `#0E0C16`, the share card ground |
| `cream` | `#FFF7EE`, type on dark |
| `canvas` / `card` | system grouped backgrounds, so light and dark both work with one palette. `NFR-053`. |
| `celebration` | the pink field from the icon. For celebrating, not informing. |
| `bloom` | the warm radial the icon puts behind its flame |
| `display(_:weight:)` | serif. The product is about a date having weight, not a utility having chrome. |

`CandleMark` is the icon's candle as a real SwiftUI shape, correctly
proportioned off `design/app-icon/birthed-icon.svg`. It is the brand's one
piece of iconography and it is currently used in exactly two places. That is
probably too few.

---

## 5. Where it is weakest, in the order I would attack it

**1. Onboarding does not earn anything.** Three screens of form controls on a
gradient. It asks for a birthday, then a year, then a place, and gives nothing
back until it is over. The best material in the app is the number one song the
week you were born, and it needs the birth year, and right now the year screen
is the most skippable one. Somebody should see something true about themselves
before they are asked for the next field. The pickers should feel like the app
is finding something out, not like a form.

**2. Nothing moves.** This is an app about birthdays and there is not one piece
of motion in it. The countdown number does not animate. The candle is not lit.
Nothing happens on the day itself beyond different words appearing.

**3. The Mine tab is a stack of cards.** It has the best facts in the product
and it presents them as a settings screen: a hero number, then card, card, card.
The song is the thing people will screenshot and it is the second thing down in
a rounded rectangle.

**4. The birthday itself is not an event.** `MyDayView.celebration` is a pink
gradient block with "Happy birthday" on it. That is the single most important
screen state in the entire product, seen once a year, and it is one gradient.

**5. The Today tab is a list.** Ten names and descriptions. Famous Birthdays
wins on names, we will not out-list them. What we have that they do not is the
number one song and the day itself, and the app does not use either on this
screen.

**6. Empty and loading states.** The People tab empty state is fine. Nothing
else has been thought about. A date that failed to load says a sentence.

---

## 6. Hard constraints

These are not preferences. Several exist because of a specific bug or a specific
piece of feedback.

**The row is the control.** No "Change" buttons. A row that shows a value and
does nothing when tapped, sitting above a button whose only job is to make that
row work, is two controls doing one control's job. Text you can edit is edited
in place and saved as you type. This applies everywhere.

**No em dashes.** Anywhere. Interface copy, comments, commit messages,
everything.

**Write abbreviations out before using them.** Degrees Fahrenheit only.

**February 29 is resolved at read time, never at write time.** The stored
birthday stays February 29 forever and the observance setting is consulted every
time. If you touch anything date shaped, read `CLAUDE.md` section 6 first.

**A calendar birthday is two integers.** Never a `Date`, never a timestamp,
never passed through a time zone. `ChartWeek` is the single documented
exception and it explains itself.

**Do not overclaim about data.** The birthday, the birth year and the region are
all sent to the Birthed account. Copy may say that nothing shared out of the app
carries the year, because `ShareCardView` enforces that, and that the device's
location is never used or sent, because it is not. It may not say or imply that
any of it stays on the phone. Onboarding used to get this wrong.

**The notification permission prompt is never in onboarding.** `FR-070`. It is
asked for from a switch the user deliberately touched, in Settings.

**The share cards are 1080x1350 and rendered on device.** `ShareCardView` is
about a date and is deliberately anonymous, because it is generated for any
date. `MyDayShareCard` is about the person holding the phone and only exists
when they tap share. Neither carries a name.

**Swift 6 strict concurrency, `MainActor` default isolation, iOS 17 floor.**

---

## 7. How to check your work

```
swift test          # the domain layer, about 60 tests, seconds
```

That covers the calendar arithmetic, the leap day handling, the chart week
lookup and the notification plan. It does not compile any SwiftUI. Xcode is the
only thing that does, so build early and often.

The interface has no tests and you are not expected to add any. Take
screenshots instead, and judge them against the question at the top: would a
nineteen year old screenshot this.

---

## 8. What to leave alone

- `Birthed/Domain/` — pure, tested, imports Foundation and nothing else
- `Birthed/Data/` — the repository, the account, the stores, the notification
  service
- `worker/` and `web/` — the pipeline and the website
- `supabase/migrations/` — never edit the database by hand, migrations only
- `Birthed/Config/Secrets.swift` and `worker/.env` are gitignored and must
  never be committed. If the service role key ever appears in the app target
  that is a security incident, not a bug.

If you need a new fact on screen and the data layer does not expose it, say so
rather than reaching into the database from a view.
