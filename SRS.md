# Birthed: Software Requirements Specification

**Status:** Draft 1
**Date:** September 4, 2026
**Scope:** Version 1.0, iOS only
**Companion documents:** `PRD.md` (why), `SDS.md` (how)

---

## 1. Purpose and conventions

This document turns `PRD.md` into requirements an engineer can build and a tester can verify. It does not explain product reasoning. That is in the product requirements document.

**Identifier scheme.** `FR-nnn` is a functional requirement, meaning something the system does. `NFR-nnn` is a non-functional requirement, meaning a constraint on how well it does it.

**Wording.** "Must" means required for version 1.0. "Should" means required unless it threatens the ship date. "May" means optional. Anything marked **[v1.1]** or later is recorded here for design continuity but is out of scope for version 1.0.

**Testability.** Every requirement states an observable outcome. If a requirement cannot be failed by a test, it does not belong in this document.

### 1.1 Definitions

- **Calendar birthday.** A month and a day, with no year and no time zone. September 4 is a calendar birthday. It is never stored as a timestamp. See section 3.
- **Birth year.** Optional and stored separately from the calendar birthday.
- **Day page.** The screen for one calendar date, showing people born on it, events, and rewards available to people born on it.
- **Offer.** One birthday reward from one brand, with its qualification rules.
- **Rule.** One condition attached to an offer, such as an advance signup deadline or a prior purchase requirement.
- **Qualification state.** What the user has personally done toward one offer.
- **Verification tier.** How much confidence the system has in one offer's rules. See section 5.
- **Profile.** A subject that has a birth date. In version 1.0 every profile is a human. See section 11.
- **Local day.** The calendar date in the user's own time zone at the moment of evaluation.

---

## 2. Onboarding and profile

**FR-001** The app must let a new user set their calendar birthday by choosing a month and a day. Test: select February 29 and the app accepts it.

**FR-002** The app must let the user optionally supply a birth year, and must function fully when the year is absent. Test: complete onboarding with no year and confirm every screen renders.

**FR-003** The app must not require the birth year in order to show any version 1.0 feature.

**FR-004** The app must let the user set an approximate location as a United States postal code or a city and state. Test: enter 97301 and confirm the location is stored.

**FR-005** The app must let the user skip location entry, and must then show offers without distance information and hide the day plan's routing.

**FR-006** The app must not request the operating system location permission during onboarding. It may request it later, only at the moment the user opens the day plan, and must explain why in the prompt.

**FR-007** Onboarding must be completable in four screens or fewer and must not present a sign-in screen. See FR-010.

**FR-008** The app must let the user change their calendar birthday, birth year and location at any time from settings, and must recompute all derived state within 5 seconds of the change.

**FR-009** The app must warn the user when they change their calendar birthday after having marked any offer as claimed in the current cycle, and must require confirmation. Test: mark an offer claimed, change the birthday, confirm a warning appears.

---

## 3. Accounts and identity

**FR-010** The app must create an anonymous server account silently on first launch, with no user-visible screen and no user action. Test: install fresh, complete onboarding, and confirm a server identifier exists without any sign-in interaction.

**FR-011** The app must remain usable when the anonymous account cannot be created. It must complete onboarding, store the profile locally, display bundled seed content for the current calendar date, and retry account creation on next launch and on next foreground. Test: launch with the network disabled on a fresh install and confirm onboarding completes and a day page renders.

**FR-012** The app must offer Sign in with Apple from settings, and must migrate the existing anonymous account's data to the permanent account without loss. Test: create data anonymously, sign in with Apple, confirm all claimed offers and settings persist.

**FR-013** The app must never present a sign-in wall in front of any version 1.0 feature.

**FR-015** The app must present exactly three top-level destinations in version 1.0: Today, Mine, and Me. Test: count top-level tabs and confirm three, with those titles.

**FR-016** The Me destination must contain, at minimum: claim history, settings, notification controls, the attributions screen, subscription management, and account deletion. Test: confirm each is reachable within two taps of the Me tab.

**FR-014** The app must let the user delete their account and all associated server data from settings, and must complete the deletion within 30 days per platform policy, with the local data removed immediately. Test: delete the account and confirm the server returns not found for that identifier.

---

## 4. Calendar day and identity content

**FR-020** The system must provide a day page for all 366 calendar dates, including February 29.

**FR-021** Each day page must show notable people born on that calendar date, ordered by a stored notability score, descending.

**FR-022** Each day page must show at least 10 and at most 50 people when that many exist in the data set. Test: load any date and confirm the count falls in range.

**FR-023** Each person entry must show, at minimum, a name, a birth year, and a short description of why they are notable.

**FR-024** Each person entry must link to its source record. See FR-027.

**FR-025** Each day page must show between 0 and 5 historical events for that date, each with a year and a one-sentence description.

**FR-026** Each day page must show the count of Birthed profiles whose calendar birthday is that date. The count must be an aggregate only. No individual profile may be exposed in version 1.0.

**FR-027** Every piece of identity content must carry visible attribution to its source, and the app must include an attributions screen naming Wikipedia and Wikidata and stating the license under which each is used. Test: open any day page and confirm attribution is reachable within two taps.

**FR-028** The system must not display a person entry whose source record lacks a verifiable birth date.

**FR-029** The app must show the day page for the current local day on launch when the user is not within their own birthday window. See FR-032.

**FR-030** The app must let the user browse to any other calendar date from the day page. Test: navigate from September 4 to December 25 and confirm the page loads.

**FR-031** The app must cache the most recently viewed 30 day pages for offline reading, and must show cached content with a visible staleness note when offline.

---

## 5. Your day and the birthday window

**FR-032** The app must define the user's birthday window as the period from 45 days before their calendar birthday through 30 days after it, evaluated in local days.

**FR-033** When the user is inside their birthday window, the app must open on their own day rather than on today's day page.

**FR-034** The app must show a countdown in whole local days from today to the next occurrence of the user's calendar birthday. Test: with the device set to September 4 and a birthday of September 6, the countdown reads 2 days.

**FR-035** On the user's calendar birthday in their local time zone, the app must present a distinct birthday state rather than a countdown. Test: set the device date to the user's birthday and confirm the state changes without relaunching, within 60 seconds of local midnight.

**FR-036** For a user whose calendar birthday is February 29, the app must treat February 28 as the observed birthday in non-leap years, and must state that it is doing so. Test: set the device to a non-leap year and confirm the birthday state activates on February 28 with a visible explanation.

**FR-037** The app must let a February 29 user choose March 1 instead of February 28 as their observed date in non-leap years, and must persist that choice.

---

## 6. Reward catalog and data integrity

**FR-040** The system must store each offer with a brand, a reward description, a set of structured rules, a source uniform resource locator, and a date the terms were last verified.

**FR-041** Every rule attached to an offer must store the exact sentence from the source that supports it. An offer must not be publishable with a rule that has no supporting quotation. Test: attempt to publish a rule with an empty quotation field and confirm the system rejects it.

**FR-042** The system must support all rule categories enumerated in `docs/research/reward-terms.md` section B. At minimum it must represent: loyalty account required, mobile application required, marketing consent required, birth date on file required, advance signup deadline as a fixed number of days, advance signup deadline as a relative period, prior purchase requirement with a lookback window, prior purchase product category constraint, prior purchase recurring annually, tier dependent redemption window, tier dependent reward content, redemption window with an anchor, reward granted as points rather than an item, minimum spend per channel, basket composition requirement, channel exclusion, geographic exclusion, participating locations only, dine in only, age eligibility, item category exclusion within the reward, inventory contingent availability, single use, non transferable, anti resale, no cash value, cannot combine, redemption method requirement, family enrollment, and sunset date.

**FR-043** A redemption window must store an explicit anchor from the set: birthday date, birthday month, month start, and reward collection date. Test: store Dutch Bros as 30 days anchored to collection and Sephora as the birthday month, and confirm both compute correct end dates.

**FR-044** Minimum spend and location validity must be stored per channel, where channel is at least one of: in store, brand website, brand mobile application, and third party marketplace. Test: store Sephora as $25 on the brand website and $0 in store, and confirm both display.

**FR-045** Every offer must carry a verification tier from the set **Verified**, **Reported**, and **Unconfirmed**.

- **Verified** requires a source uniform resource locator, a supporting quotation on every rule, and a named human reviewer.
- **Reported** means the offer's existence is supported by a secondary source but its rules are not fully confirmed.
- **Unconfirmed** means the offer's existence itself is not confirmed against a primary source.

**FR-046** The app must display the verification tier on every offer, in the offer list and on the offer detail screen, without requiring a tap. Test: open the catalog and confirm every row carries a tier indicator.

**FR-047** The app must display the date an offer's terms were last verified, on the offer detail screen, in plain language such as "Checked 12 days ago."

**FR-048** The system must automatically downgrade an offer from Verified to Reported when its terms were last verified more than 180 days ago. Test: set a verification date 181 days in the past and confirm the tier changes without manual action.

**FR-049** The app must not state a rule that its source does not state. Where a rule category has no information, the app must display "Not stated by the brand" and must not display an assumed value. Test: an offer with no advance signup deadline must not display "no deadline" and must display the not-stated wording.

**FR-050** The app must not permit personal qualification tracking on an offer whose tier is Unconfirmed, and must show an explanation in its place.

**FR-051** The app must present a visible warning on any Unconfirmed offer stating that Birthed has not confirmed the offer exists.

**FR-052** The catalog must contain offers from at least 150 distinct brands at launch, of which at least 50 brands must have an offer at the Verified tier. Test: count distinct brand identifiers among published offers, and count distinct brands having at least one Verified offer.

**FR-053** The app must let the user filter the catalog by verification tier, and must default to showing all tiers with Verified first.

**FR-054** The app must link to the brand's own source page from every offer detail screen. Test: tap the source link and confirm it opens the stored uniform resource locator.

---

## 7. Personal qualification tracking

**FR-060** For each offer, the app must let the user record their own state for each applicable requirement, from the set: not started, done, and not applicable.

**FR-061** The app must compute an overall qualification status per offer from the recorded states, from the set **Qualified**, **Action needed**, and **Not eligible this year**.

**FR-062** When the status is Action needed, the app must name the specific outstanding requirement and, when a deadline applies, the date by which it must be done. Test: with Starbucks unstarted and a birthday 30 days away, the app states that signup is required and gives a date 7 days before the birthday.

**FR-063** The app must compute Not eligible this year when an advance signup deadline for that offer has already passed in the current birthday cycle. Test: with a birthday 3 days away and an offer requiring 7 days advance signup that the user has not completed, the status must be Not eligible this year.

**FR-064** The app must state plainly why an offer is Not eligible this year, and must state when the user could become eligible next year.

**FR-065** The app must reset all qualification states that do not carry over between cycles at the start of each new birthday cycle, defined as the day after the birthday window closes. Requirements that recur annually, such as the Starbucks star earning transaction, must reset. Requirements that persist, such as having created an account, must not reset. Test: advance past the window end and confirm annual requirements reset while account creation does not.

**FR-066** The app must show a single summary count on the home screen in the form "N rewards ready, M need action."

**FR-067** The app must let the user mark an offer as not interested, and must exclude it from counts, notifications and the day plan until un-marked.

**FR-068** The app must open the brand's signup page in the system browser or the brand's application when the user taps the action for an offer, and must return to the offer on re-entry so the user can mark it done. Test: tap the action, return to the app, and confirm the offer is still on screen with the mark-done control visible.

---

## 8. Notifications

**FR-070** The app must request notification permission only after the user has completed onboarding and viewed at least one screen of content, and must explain the benefit in an in-app screen before the system prompt.

**FR-071** The app must schedule a notification for each offer's real deadline rather than on a fixed generic schedule. Test: with one offer requiring 7 days advance signup and another requiring enrollment before the birthday month, confirm two separately dated notifications exist.

**FR-072** The app must schedule a notification 45 days before the calendar birthday summarizing how many offers need action.

**FR-073** The app must schedule a notification on the morning of the user's **observed** birthday, meaning the calendar birthday resolved through the leap day observance setting for the target year, in the user's local time zone, at a user-configurable hour defaulting to 8:00 in the morning. Test: a February 29 user with the February 28 observance receives the notification on February 28 in a non-leap year and on February 29 in a leap year.

**FR-074** All notification scheduling must be computed against the user's current local time zone, and the app must reschedule all pending notifications when the device time zone changes. Test: schedule notifications, change the device time zone by 8 hours, and confirm all fire times shift to preserve the intended local hour.

**FR-075** Notification fire times must remain correct across a daylight saving time transition. Test: schedule a notification for 8:00 in the morning on a date on the far side of a daylight saving change and confirm it fires at 8:00 local, not 7:00 or 9:00.

**FR-076** The app must not send more than one notification per calendar day outside the birthday window, and not more than two per calendar day inside it.

**FR-077** The app must consolidate multiple offers sharing a deadline date into a single notification. Test: three offers with the same deadline produce one notification naming three.

**FR-078** The app must let the user disable each notification category independently: deadline reminders, the day-of reminder, and the daily day page.

**FR-079** The daily day page notification must default to off.

**FR-080** The app must cancel a scheduled deadline notification when the user marks the corresponding requirement done or marks the offer not interested. Test: mark done and confirm the pending notification is removed.

---

## 9. The birthday day plan

**FR-090** On the user's observed birthday, the app must present a day plan containing every offer whose status is Qualified and whose redemption window includes the current local day.

**FR-091** Each day plan entry must show the reward, the brand, the redemption window closing time, and the nearest known location of that brand with its distance from the user.

**FR-092** The app must order day plan entries by the closing time of each redemption window, soonest first, and must break ties by distance, nearest first.

**FR-093** The app must show the brand's typical operating hours for the current day of the week, and must label them as typical hours for the brand rather than confirmed hours for that location. Test: confirm the hours label includes wording that they are typical and not guaranteed.

**FR-094** The app must mark a day plan entry as at risk when the current local time is within 90 minutes of the brand's typical closing time.

**FR-095** The app must show today's forecast for the user's location, including the high temperature in degrees Fahrenheit and the chance of precipitation.

**FR-096** The app must display a weather advisory when the chance of precipitation for the remaining daylight hours exceeds 50 percent, and must state which plan entries are unaffected because they are indoors. Test: with a mocked forecast above 50 percent, confirm the advisory renders and indoor entries are identified.

**FR-097** The app must let the user open any day plan entry's location in Apple Maps for driving directions.

**FR-098** The app must let the user mark a day plan entry as claimed, and must move it to a completed section without removing it.

**FR-099** The app must show a running count and estimated total value of what has been claimed today.

**FR-100** The app must function without location permission by omitting distance, ordering, and the nearest-location lookup, and by showing a control to grant permission. Test: deny location and confirm the day plan still lists rewards and windows.

**FR-101** The app must not require network access to display the day plan for offers already downloaded, and must degrade by omitting weather and nearest-location data.

---

## 10. Claiming, reporting and sharing

**FR-110** The app must let the user mark any offer claimed, with the local date recorded.

**FR-111** The app must let the user rate a claimed offer as good or disappointing, in one tap, with no required text.

**FR-112** The app must let the user report a problem with an offer in no more than two taps from the offer detail screen, choosing from at least: the reward did not exist, the rules were different, the location did not honor it, and something else.

**FR-113** A problem report must transmit the offer identifier, the report category, the optional free text, the app version, and the user's approximate region. It must not transmit precise location. Test: inspect an outgoing report and confirm no coordinates are present.

**FR-114** The system must place any offer receiving 3 or more problem reports of the same category within 30 days into a review queue, and must automatically downgrade it to Reported if it was Verified. Test: submit 3 matching reports and confirm the tier changes.

**FR-115** The app must generate a shareable image for the user's day, containing the calendar date, a selection of notable people who share it, and, when the user has claimed at least one reward, the count and total value claimed.

**FR-116** The share image must carry the Birthed name and must include attribution for any sourced content shown on it.

**FR-117** The share image must be generated on device and must not require a network round trip. Test: enable airplane mode and confirm the image still generates.

**FR-118** The app must not include the user's name, exact location, birth year or age on the share image unless the user explicitly enables each. Default is off for all.

---

## 11. Profile types and future extension

**FR-120** Every profile record must carry a profile type field with the permitted values HUMAN and AGENT.

**FR-121** Version 1.0 must create only HUMAN profiles, and every version 1.0 query must filter to HUMAN.

**FR-122** The system must not implement any AGENT-specific behavior, screen, or field in version 1.0 beyond the type value itself.

**FR-123 [v1.1 or later]** Day pages may include AGENT profiles as a separate, clearly labeled section. Out of scope for version 1.0.

---

## 12. Content and catalog pipeline, backend only

**FR-130** The pipeline must import person records from Wikidata by date of birth, storing at minimum: source identifier, name, birth date, death date when present, a short description, and a notability score.

**FR-131** The pipeline must reject any imported person record whose birth date lacks day precision. Test: a record with only a birth year must not be imported.

**FR-132** The pipeline must store the license under which each imported record is used, and must expose it to the application for the attributions screen.

**FR-133** The extraction pipeline must, for each candidate offer, produce a set of proposed rules where every rule includes a verbatim quotation from the source document and a character offset or equivalent locator into that document.

**FR-134** The extraction pipeline must output no rule at all where it cannot locate a supporting sentence. It must never output an inferred or default value. Test: run extraction against a terms page that is silent on advance signup and confirm no advance signup rule is produced.

**FR-135** No offer may move to the Verified tier without a recorded human reviewer identifier and a review timestamp.

**FR-136** The review interface must present the proposed rule beside its source quotation, and the reviewer must approve or reject the quotation-to-rule mapping rather than a prose summary. Test: confirm the reviewer cannot approve a rule whose quotation is not displayed.

**FR-137** The system must retain a full history of rule changes per offer, including who changed what and when.

**FR-138** The system must be able to publish a catalog update to clients without an application release. Test: change an offer's rules on the server and confirm the client reflects it on next refresh.

---

## 13. Entitlements and monetization

**FR-140** The app must treat all identity content, meaning day pages, notable people, events, twin counts and the share image, as free with no entitlement check.

**FR-141** The app must gate the following behind a paid entitlement: the catalog beyond the free set, personal qualification tracking, deadline notifications, and the day plan.

**FR-141a** The free set must be defined by an explicit per-offer flag on the server, not by position in a sorted list. It must contain exactly 15 offers, all at the Verified tier, from 15 distinct brands spanning at least 4 categories. Test: count offers flagged free and confirm the count, the tier, the distinct brand count and the category spread.

**FR-142** The app must show the paywall only after the user has viewed at least one day page and one offer.

**FR-143** The app must offer an annual subscription and must state the renewal price and terms on the paywall.

**FR-144** The app must restore purchases from settings.

**FR-145** The app must not display third party advertising in version 1.0.

---

## 14. Non-functional requirements

### Correctness of dates

**NFR-001** Calendar birthdays must be stored as a month and day pair, never as a timestamp, and never converted through a time zone. Test: set the device to a time zone 14 hours ahead, restart, and confirm the stored birthday is unchanged.

**NFR-002** All "is it today" and countdown evaluations must use the user's current local calendar day, obtained from the device calendar, not from a coordinated universal time offset calculation.

**NFR-003** The system must have automated tests covering, at minimum: February 29 in a leap year, February 29 in a non-leap year under both observed-date settings, December 31 to January 1 rollover, a birthday one day away across a daylight saving transition in both directions, and a user in a time zone at coordinated universal time plus 14 and minus 11.

**NFR-004** No date arithmetic may assume a day is 86,400 seconds long.

### Performance

**NFR-010** Cold launch to the first meaningful screen must complete in under 1.5 seconds on an iPhone 12 or newer.

**NFR-011** A day page must render from cache in under 300 milliseconds, and from the network in under 2 seconds measured on a connection delivering at least 5 megabits per second with round trip latency at or below 100 milliseconds.

**NFR-012** The offer catalog must be searchable and filterable with results appearing in under 200 milliseconds for a catalog of 500 offers.

**NFR-013** Share image generation must complete in under 1 second.

### Reliability and offline behavior

**NFR-020** With no network connection, every screen must render its primary content from cache without presenting a blocking error state. Three sections are exempt and must instead show a labeled unavailable placeholder: the day plan's weather, the day plan's nearest-location distances, and the twin count, which is a live server call. Test: enable airplane mode after a successful sync and confirm every screen renders, with exactly those three showing placeholders.

**NFR-021** Any screen whose primary content list resolves to zero items must display an explanatory message naming the reason, and, where the cause is a failed network request, a retry control. Test: for each list screen, force a zero-result state and a failed-request state and confirm both render the required elements.

**NFR-022** All user-entered state, including qualification states and claims, must be written to local storage before any network call, and must synchronize when connectivity returns.

**NFR-023** Crash-free session rate must be at or above 99.5 percent.

### Privacy

**NFR-030** The app must not transmit precise location coordinates to the Birthed backend at any time. Location may be used on device and may be sent to a weather provider at reduced precision.

**NFR-031** The app must not collect the user's contacts in version 1.0.

**NFR-032** The birth year, when supplied, must not be transmitted to any third party.

**NFR-033** The twin count must be computed such that a count below 5 is displayed as "fewer than 5" rather than an exact number, to reduce identifiability on rare dates.

**NFR-034** The app must ship an App Store privacy nutrition label that accurately reflects every collected data type, and must be re-audited before each release.

**NFR-035** All analytics events must be free of personally identifying information and must not include the exact calendar birthday. Days-until-birthday buckets may be used instead.

### Security

**NFR-040** All network traffic must use transport layer security version 1.2 or higher.

**NFR-041** Row level access controls must prevent any user from reading another user's qualification states, claims or profile record.

**NFR-042** The catalog and identity content must be readable by any authenticated client, including anonymous ones, and writable only by backend service roles.

**NFR-043** Problem reports must be rate limited to 10 per user per day.

### Accessibility

**NFR-050** Every screen must support Dynamic Type through the accessibility extra extra extra large size without truncation or overlap.

**NFR-051** Every interactive element must carry a VoiceOver label, and the day plan must be fully operable with VoiceOver.

**NFR-052** Color must never be the only signal of verification tier or qualification status. Each must also carry text or a distinct shape.

**NFR-053** All text must meet a contrast ratio of at least 4.5 to 1 against its background in both light and dark appearance.

### Content integrity

**NFR-060** No string displayed in the app may originate from a language model without a visible label identifying it as generated. In version 1.0 the intended count of such strings is zero, because every reward rule is displayed from its human-approved structured form and all identity content comes from Wikidata. Test: each release must include a signed-off audit listing every model-originated string shipped in that build, and the expected result for version 1.0 is an empty list. A non-empty list without labels is a release blocker.

**NFR-061** Attribution for Wikipedia and Wikidata content must be present wherever that content appears, and the license text must be reachable from the attributions screen.

**NFR-062** The application must not cache brand logos or celebrity images without a recorded license basis for each.

### Analytics

**NFR-070** The system must record, at minimum: onboarding completion rate, day page views per user per week, day 30 retention segmented by days until the user's birthday, offers marked done, offers claimed, problem reports per 1,000 offer views, share image generations, and paywall view to purchase rate.

**NFR-071** Day 30 retention among users whose birthday is more than 60 days away must be reportable as its own metric, since `PRD.md` section 14 names it as the primary signal for whether the product's core bet is working.

---

## 15. Out of scope for version 1.0

Recorded so that scope creep is visible. Any of these appearing in a build is a defect against this specification.

- User to user messaging, matching, rooms, feeds, following, or any means for one user to contact another
- Sending or scheduling birthday wishes
- Wishlists, gifting, or any payment between users
- Friends' birthdays and contact import
- An artificial intelligence conversational assistant
- Activity risk scoring, such as fishing or thrifting outcome prediction
- Local and independent business offers
- AGENT profile behavior beyond the type field
- Android, web, iPad-specific, watch and widget targets
- Third party advertising

---

## 16. Traceability

| Product requirements document section | Requirements |
|---|---|
| 10.1 Day page | FR-020 to FR-031, FR-130 to FR-132 |
| 10.2 Your day | FR-032 to FR-037 |
| 10.3 Reward catalog | FR-040 to FR-054, FR-133 to FR-138 |
| 10.4 Qualification tracking | FR-060 to FR-068 |
| 10.5 Deadline ladder | FR-070 to FR-080 |
| 10.6 Day plan | FR-090 to FR-101 |
| 10.7 Share card | FR-115 to FR-118 |
| 10.8 Claim and report | FR-110 to FR-114 |
| 12 Future versions | FR-120 to FR-123 |
| 15 Monetization | FR-140 to FR-145 |
| 16.2 Accuracy risks | FR-041, FR-045 to FR-051, FR-114, FR-134 to FR-136, NFR-060 |
| 16.4 Technical risks | NFR-001 to NFR-004 |
| 9 Journeys A to D, onboarding | FR-001 to FR-009 |
| 10.9 Three-tab shape | FR-015, FR-016 |
| 3 Accounts and deletion | FR-010 to FR-014, NFR-041, NFR-042 |
| 16.1 Retention measurement | NFR-070, NFR-071 |
| 13 Privacy commitments | NFR-030 to NFR-035 |
| Polish over features | NFR-010 to NFR-013, NFR-050 to NFR-053 |
| Offline and reliability | NFR-020 to NFR-023 |
| Content licensing | NFR-061, NFR-062 |
