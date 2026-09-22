# Birthed: Product Requirements Document

**Status:** Draft 2. Direction changed from draft 1, see section 4.4.
**Date:** September 4, 2026
**Owner:** Jason Page
**Related documents:** `docs/specs/SRS.md` (requirements), `docs/specs/SDS.md` (architecture), `docs/research/`

---

## 1. What this document is

This is the product definition for Birthed, an iOS app about birthdays. It is written before production code so that we agree on what we are building and, more importantly, on what we are refusing to build.

Two things here are not standard for a product requirements document. First, observation is kept separate from conclusion, because the whole product came out of one person's single birthday, and one person's day is not proof of a market. Second, the arguments against the product are stated as clearly as the arguments for it. Sections labeled **Evidence** say where a claim came from.

**Draft 2 changes the center of the product.** Draft 1 made reward qualification the product. Draft 2 makes birthday identity the product and demotes rewards to the utility layer. Section 4.4 explains why, with the evidence that forced the change.

---

## 2. The founding observation

On a real birthday, one real person had this day:

- Woke up with no plan, choosing between fishing and thrifting.
- Committed to neither, because of the fear of getting skunked. Catching nothing, or finding nothing at the thrift store, would waste the one day of the year that cannot be repeated.
- Doomscrolled in bed until about 10 in the morning, then wandered the house for another two hours.
- At noon, collected a free Dutch Bros birthday drink. It came with a pink straw. This was the best part of the day.
- Drove 16 minutes to Bi-Mart for nightcrawlers, having finally decided to fish.
- It started raining. The fishing never happened.
- Went to iWings with family in the evening.
- Received birthday messages. One at midnight, which felt awkward to answer at midnight. One from a brother in the morning. Others in person.
- Researched birthday freebies across four tools: Famous Birthdays, Reddit, Google, and ChatGPT.
- Discovered that Jersey Mike's requires a qualifying purchase in the previous year, so someone reading "free birthday sub" on a list would assume they qualify when they do not.

That is the whole input.

Two details in it are easy to skip past and both turned out to matter. **He opened Famous Birthdays.** Not as a chore, but as part of the ritual of the day. And **the free drink was the best part of the day**, which says something about what a good birthday is actually made of.

---

## 3. Problem analysis: separating symptoms from needs

### 3.1 "I didn't know what to do"

**Symptom.** The underlying problem is decision paralysis under unusual conditions: high emotional stakes, a hard deadline, and no do-over. A wasted Saturday is replaceable. A wasted birthday is not. That combination produces avoidance, and avoidance on a birthday looks exactly like scrolling in bed until ten in the morning.

**Strength: strong feeling, weak business on its own.** Once a year per person.

### 3.2 "I was afraid of getting skunked"

**The most important finding, and easy to misread.**

He was not short on ideas. He had two good ones. He lacked confidence that either would pay off. Google, Reddit, TikTok, Yelp and ChatGPT all generate ideas fine. None of them tell you the chance that a specific activity will actually be good, for you, today.

The need is **not idea generation. It is outcome confidence.**

**Strength: strong as differentiation, hard to build.** Version two or three.

### 3.3 "The free Dutch Bros drink was the best part of the day"

The highest satisfaction moment of the day cost nothing and took minutes. Compare it to fishing, which needed a drive, a bait purchase, real time, and carried a genuine chance of nothing.

The freebie was not valuable because it was free. It was valuable because **it was guaranteed.** A reward you qualify for has a one hundred percent hit rate. It is the emotional opposite of fishing.

**Birthday rewards are the anti-skunk.** They are the guaranteed floor under the day. The design principle that falls out: a good birthday is a floor of certain small wins plus one optional bigger swing, not one big uncertain bet.

### 3.4 "Jersey Mike's needed a purchase I didn't know about"

**Symptom of something much larger.** The problem is not that lists are hard to find. heyitsfree.net catalogs over 300 companies. Slickdeals lists 205.

The problem is that **the lists are wrong, and being wrong is embarrassing in public.** Our research checked 14 well known brands against their own published terms:

- Red Robin's terms, versioned June 1, 2026, say the birthday burger "will not be renewed." Nearly every published list still advertises it.
- Buffalo Wild Wings has no birthday reward anywhere in its June 2026 terms or help pages, despite being widely listed as having one.
- Chipotle's birthday reward does not appear in Chipotle's own rewards terms at all, and its press release and rewards page state two different redemption windows.
- Denny's rewards terms contain no birthday section.
- Starbucks requires signup at least 7 days in advance **and** at least one star earning purchase **every year**.
- Sephora requires $25 minimum online and nothing in store.

Three of fourteen could not be verified at all. Two appear to have no birthday reward despite being widely listed as having one.

**Strength: very strong, and now confirmed to be unsolved by the leading competitor.** See section 8.1. The cost of a wrong entry is not lost money. It is walking into a Red Robin, asking for a free burger, and being told no.

### 3.5 The timing problem hiding inside 3.4

Look at when qualification actually has to happen. Starbucks: 7 days before, plus a purchase that year. IHOP: 7 days before. Ulta: birth date on file before the birthday month. Jersey Mike's: a qualifying sub in the previous 12 months, re-earned annually.

**By the time you are searching "birthday freebies" on your birthday morning, most of the value is already gone.**

This is why rewards stay in the product even after being demoted. It is the only mechanic in the entire app that gives a user a reason to open it **before** their birthday. Everything else in Birthed happens on one day. This happens for six weeks.

**Strength: very strong. This is the retention engine, not the product.**

### 3.6 "I researched across Famous Birthdays, Reddit, Google and ChatGPT"

Two separate things are buried here and draft 1 only caught one of them.

**The one draft 1 caught:** fragmentation. Four tools, none authoritative, and the research consumed birthday morning. An actual App Store review of a competing app reads, "There are ads that pop up way too frequently... I ended up getting so frustrated with it that I just deleted it and asked ChatGPT." Users already route around freebie apps to a language model.

**The one draft 1 missed, and it is the more important one:** he opened **Famous Birthdays** on his birthday. Nobody made him. It was not research toward a goal. It was part of the ritual of the day.

That behavior is not rare. Famous Birthdays does 23.4 million visits a month, 77.6 percent of it organic search, on programmatic advertising alone, with roughly 35 people, bootstrapped and profitable. Checking who you share your birthday with is a thing millions of people do, every day, unprompted.

**Strength: very strong, and verified at scale.** This is the front door of the product.

### 3.7 "A birthday message arrived at midnight and felt awkward"

**Real and small.** A social timing friction, not a product.

Worth stating plainly because it constrains a whole feature area: **he was not short of birthday wishes.** His brother texted. Family said it in person. Someone messaged at midnight. He had a surplus arriving at awkward times, not a shortage. Facebook solved "everyone you know wishes you happy birthday" so thoroughly that the perfunctory birthday post became a cliché.

Any feature premised on "users need more birthday wishes" is solving a problem this research does not show. Do not build one.

**Strength: weak.**

### 3.8 "Artificial intelligence agents could have birthdays too"

**Unproven as a user need.** Nothing in the research points to it, and no user asked.

It does, however, fit the draft 2 architecture better than it fit draft 1. When the core object of the app is a calendar day and the people born on it, an agent with a creation date is simply another entry on that day. It stops being a bolt-on and becomes a row.

**Recommendation unchanged: keep the door open, build nothing.** One type field on one table.

---

## 4. Evaluating the hypotheses

### 4.1 Hypothesis 1: "This is a birthday decision engine, not a birthday reminder app"

**Verdict: directionally right, reasoning backwards.**

The ambition is correct. But a decision engine with no proprietary data is a thin wrapper around a language model, and it loses, because ChatGPT is free and already installed.

What ChatGPT cannot do is know that **you** signed up for Starbucks Rewards in March and have not bought anything since, so your free drink is not actually coming. That is a state problem, not a language problem, and state is something you own and a chat interface does not.

Corrected: **Birthed becomes a decision engine only because it owns verified data and personal state first.** Order matters.

### 4.2 Hypothesis 2: "Rewards are the practical utility, social discovery is the engagement and growth mechanism"

**Verdict: the roles are right, the ranking is inverted.**

Draft 1 accepted this and put rewards at the center. Draft 2 flips it, for the reasons in 4.4. Rewards are the utility and the retention engine. Identity is the front door, the reason to open the app, and the thing that gets shared.

The half that stays true: if the reward half were removed, the app would lose its only pre-birthday mechanic. If the identity half were removed, the app would have no reason to be opened on 364 days of the year. Neither half survives alone.

### 4.3 Hypothesis 3: "Artificial intelligence agents are another kind of birthday bearing entity"

**Verdict: unproven, cheap to preserve, build nothing.** Covered in 3.8. Note that the name Birthed fits this better than any alternative considered. "This agent was birthed on March 4, 2026" needs no explanation.

### 4.4 The direction change, and the evidence behind it

Draft 1 made reward qualification the product. That was wrong, for two reasons that only became visible after further research.

**Reason one: the reward catalog is a commodity.** The data is public. Freebird has it. Three-hundred-entry listicles have it. Anyone can copy it. The moat is operational, meaning it depends on doing the tedious work of keeping records fresh, and operational moats are weak for a solo developer. Our qualification tracking is genuinely better, and it is still a feature rather than a company.

**Reason two: identity has a verified business behind it and stranger networking does not.** These get lumped together as "the social side" and they should not be.

Birthday identity content, meaning who shares your date and what your day means, is a proven business. Famous Birthdays: 23.4 million monthly visits, 77.6 percent organic search, profitable on ads with about 35 people.

Stranger networking over a shared birthday has three failed attempts, verified from Apple's own data on September 4, 2026:

| App | Genre | Shipping since | Current version | Ratings |
|---|---|---|---|---|
| Twiny, Find your twins | Social Networking | **January 2024** | 3.0.0, Aug 2026 | **1**, at 1.0 stars |
| Twinly, Birthday And Party | Social Networking | January 2026 | 3.3.5, Jun 2026 | **1** |
| Born Today: Daily Fame | Lifestyle | December 2025 | 1.0, abandoned | **0** |
| Freebird, for comparison | Finance | June 2026 | 1.0.8, Sep 2026 | **22** |

Twinly shipped birthday rooms, instant matching, group chats, a feed, streaks and direct messages. That is the full stranger-networking concept, live, three major versions in, with one rating. Twiny has been shipping for two and a half years and has one rating at one star.

Ratings are a weak proxy for usage. But three teams ran this experiment independently and the direction is not ambiguous.

**Reason three, the arithmetic that explains why:** there are 366 possible birthdays. With 1,000 users, about 1.7 other people share your date. With 10,000, it is about 26. With 100,000, about 273. A twin finder is an empty room until you have tens of thousands of users, which means **the feature meant to drive growth does not function until after you have already grown.** That is the chicken and egg problem that killed Twinly and Twiny.

Famous people are on every date regardless of how many users you have. That single fact is why the content version works where the social version does not, and it is the load-bearing insight of draft 2.

**What draft 2 therefore does:** identity becomes the front door and the shareable surface. Rewards become the utility layer and the pre-birthday retention engine. User-to-user social is deferred until there is density to support it.

---

## 5. Product vision

**Your birthday is a thing worth knowing about, and worth not wasting.**

Birthed makes your birthday into something with substance. It tells you who you share it with, what happened on it, and what the world offers you because of it. In the weeks before, it makes sure you actually qualify for the free things waiting for you. On the day, it turns all of that into a plan and a thing worth sharing.

Famous Birthdays tells you who was born today. Freebird tells you what is free. **Birthed is the only one that knows the day is yours.**

### 5.1 The core object

Architecturally and conceptually, the center of Birthed is not the user. **It is the calendar day.**

September 4 is a thing that exists whether or not anyone has signed up. It has famous people born on it. It has historical events. It has a set of rewards available to anyone born on it. It has some number of Birthed users who claim it.

That single object serves four purposes at once: it is the identity content, it is the share card, it is the twins count, and later it is the web page that pulls in search traffic. Everything in the product is a view onto a day. Section 10 and `docs/specs/SDS.md` both build on this.

---

## 6. Target users

### Primary: the person whose birthday is coming

Roughly 18 to 40, iPhone, likes free things without being an extreme coupon person, and has felt the specific disappointment of a birthday that went nowhere. Willing to spend two minutes on a loyalty signup if told it is worth it and exactly when.

The defining trait is not frugality. It is **not wanting to waste the day.** The free food is proof the day was used well, not the point of it.

### Primary, second motion: the person who is curious about their day

Overlaps heavily with the first, and is the reason 23.4 million people a month visit a site that just tells them who shares their birthday. This person is not looking for utility. They are looking at their day the way people look at their horoscope, and they will do it more than once a year.

### Secondary, deferred: the person tracking someone else's birthday

Out of scope for version one. Best candidate for version 1.5, and the strongest structural answer to the retention problem in section 14.

### Explicitly not a target

- Extreme deal hunters. Their volume demands would compromise accuracy.
- Party planners. This is not an events app.
- People looking to meet strangers. See 4.4.

---

## 7. Core value proposition

**Identity:** your birthday is not just a date. Here is who you share it with and what it carries.
**Rewards:** you will not walk into a store and be told no.
**The day:** you will not wake up on your birthday without a plan.

The second is the only one worth paying for. The first is why people open the app and tell someone about it. The third is what makes the day feel used.

---

## 8. Competitive differentiation

Evidence for this section is in `docs/research/competitive-landscape.md`.

| Competitor | What they do | What they cannot do |
|---|---|---|
| **Famous Birthdays** (23.4M monthly visits, 77.6 percent organic search) | Proves the identity appetite at enormous scale. Deep celebrity database, twelve-plus years of content | It is a search destination and an advertising business. It does not know your birthday, does not remember you, gives you nothing to act on, and has no reason to be opened twice by the same person. You go to it. It never comes to you. |
| **Freebird** (see 8.1) | A good year round freebie app with a Birthday tab. Broad catalog, human curation, clean design | Its birthday cards carry one headline requirement, not the rule set. Documented failure in 8.1. Ad supported, which is the top complaint in the category. No identity, no day plan, nothing shareable. |
| **Twin and birthday social apps** (Twiny, Twinly, Born Today) | Attempted exactly the stranger-networking concept | Three attempts, two combined ratings, one of them still shipping after two and a half years. Section 4.4 has the arithmetic on why. |
| **Birthday reminder apps** (hip at 17,739 ratings, Birthday Reminder & Countdown at 10,129) | Prove the category is real and monetizable. hip sells cards and gifts on top | Not one of them surfaces a single freebie, and none do identity. Verified across every description read. |
| **Published freebie lists** (heyitsfree.net 300 plus, Slickdeals 205) | Broad coverage | Static and impersonal. No notification, no personal qualification state, and demonstrably stale. |
| **Google, Reddit, Yelp, TikTok** | Generate ideas fine | No memory of your birthday, no verification date, no ability to wake you before a deadline you did not know existed. |
| **ChatGPT** | The real competitor for the research job. Users already reach for it | Will confidently tell you Red Robin gives a free birthday burger, because its sources are stale and it has no verification date. Does not remember your birthday. Will never proactively notify you, which is fatal for a product whose value depends on acting before a deadline. |

### 8.1 Freebird, examined directly

Installed and reviewed September 4, 2026. Evidence is a screenshot of the Birthday tab.

**What it is.** A year round freebie app with five tabs: Discover, Search, Birthday, Saved, Me. Birthday is one tab inside it, not the product. The Birthday tab is organized around the birthday **month**, headlined "It's your month," with two counters: rewards left to claim and total dollar value. In the screenshot, 50 rewards and $382. Cards carry an "Editor's Pick" badge, so there is human curation. The feed carries a labeled sponsored advertisement.

**What to copy.** The month framing is correct and matches how Sephora and Ulta actually work. The running dollar counter is a strong motivator. The design is clean. Freebird is a good app and pretending otherwise would make our planning worse.

**Where it fails, verified from the screenshot.** Each card carries one line of requirement text. Sephora: "Beauty Insider sign-up." Build-A-Bear: "Bonus Club, in-store only." Starbucks: "App download, 1 min."

The Starbucks card is the proof. Per Starbucks' own terms effective March 10, 2026, the reward requires **enrollment at least 7 days before your birthday** and **at least one star earning transaction before your birthday, every year**. Neither rule is on the card. A user who reads "App download, 1 min" on their birthday morning, downloads the app, and walks into a Starbucks will be told no.

**That is the Jersey Mike's failure reproduced inside the leading competitor.** It is no longer a hypothesis. It is a demo.

Two further notes. The Sephora card shows "$25 reward," the same figure as Sephora's online minimum spend, so it may be a value estimate or a conflation. Unconfirmed. And nothing on the tab tracks whether the user has satisfied a requirement. Saved appears to be bookmarking, not qualification state.

**Strategic read.** Freebird is a deals app that includes birthdays. Birthed is a birthday app that includes deals. Both are listed under Finance, which is the deliberate head-to-head placement decided in section 17, with Lifestyle as the secondary category. Freebird owns nothing on the day itself and nothing about identity: no plan, no store hours, no travel sequencing, no weather, no rain fallback, no twins, nothing shareable.

**The uncomfortable part.** Freebird's year round scope solves the retention problem structurally. They use the birthday as one hook inside a 365 day product. Draft 1 proposed a birthday product with no reason to be opened in March. Draft 2's answer is section 14, and it has to be good.

**Follow up checks still outstanding:** whether a reward detail screen shows full terms or a verification date, whether any screen states a signup deadline, whether Jersey Mike's appears with its prior purchase rule, and whether Red Robin still appears with a birthday burger its own terms discontinued.

### 8.2 The one sentence version

Famous Birthdays answers "who was born today." Freebird answers "what is free." **Birthed answers "it is my day, what does that get me, and what do I do with it."** Nobody is standing in that spot.

---

## 9. User journeys

### Journey A: The curious install, any day of the year

1. Ben installs Birthed in March. His birthday is in September. He is not shopping for anything.
2. He enters his birth month and day.
3. The app opens on **his day**. Fourteen well known people share September 4. Three historical events. A countdown.
4. Below that: **nine rewards are waiting on your birthday. Four need you to do something first.**
5. He does not act. That is fine. He shares the card because the famous names are genuinely interesting.
6. In July, the first deadline notification arrives, and now it is concrete.

This journey matters because it is the only one that produces a user who is not already in a hurry.

### Journey B: The right way in, 45 days out

1. Sarah installs 45 days before her birthday.
2. Enters her date and city.
3. Sees her day, her famous twins, and **7 rewards you can still qualify for, 3 need action this week.**
4. Starbucks: sign up by October 12, and make one purchase before your birthday. One tap to the signup page.
5. She signs up and marks it done. The card turns green and reads **Qualified**.
6. Four more notifications arrive over the following weeks, each tied to a real deadline rather than a generic countdown.
7. On the morning of her birthday the app opens on a plan: six confirmed free things ordered by when each redemption window closes, with distance and typical hours on each, and a rain fallback.
8. She marks each claimed. At the end of the day she gets a card worth sharing.

### Journey C: The hard way in, on the day

**Most first users will take this one, and it is the worst, so it gets the most design attention.**

1. Marcus installs on his birthday morning after searching for birthday freebies.
2. Most signup deadlines have passed. The app cannot fix that.
3. It says so plainly: **4 rewards needed a signup you missed this year. Here are 5 you can still get today.** It does not pretend.
4. It gives him a plan for the 5 that still work, free, because the day plan is not paywalled during a user's first birthday window. It shows him his day: who he shares it with, what happened on it. **That part still works on a birthday morning**, which is exactly why identity is the front door and rewards are not.
5. At the end: **next year I start reminding you 45 days out, and you qualify for all 9.**

Turning the miss into the hook is the central design problem of the first run.

### Journey D: The daily open

1. On an ordinary Tuesday, the Today tab shows who was born today.
2. Ben looks, because that is the thing 23.4 million people a month already do.
3. Once a year, that day is his.

This journey creates no utility. It is the reason the app is not opened once a year.

---

## 10. The minimum viable product

Ordered by importance. Cut from the bottom.

### 10.1 The day page

The core object from 5.1, rendered. For any calendar day: notable people born on it, a few historical events, the rewards available to people born on it, and how many Birthed users claim it.

Sourcing note: Wikidata publishes structured birth date facts under a public domain dedication, which makes commercial reuse straightforward, and it is queryable by date. Wikipedia article text carries a share-alike license that requires attribution, so summaries need care. Images need per-file license checks. `docs/specs/SDS.md` covers this and it is a real piece of work, not a free lunch.

### 10.2 Your day, the home screen

Your birthday. A countdown. Your famous twins. Your reward status in one line. On the day itself, this becomes the plan.

### 10.3 Reward catalog with real qualification rules

**At least 50 United States national chains fully verified at launch, growing toward 150 or more afterward.** Decided September 4, 2026. The Verified 50 is the gate to ship, and the tail publishes from the server with no application release, per `docs/specs/SRS.md` FR-052a and FR-138. The reasoning is that FR-050 already switches qualification tracking off for Unconfirmed offers, so the tail past 50 adds rows rather than value on day one, and there is one reviewer. The three-tier confidence model in `docs/specs/SRS.md` FR-045 is what makes that honest rather than reckless. An offer we have not confirmed still ships, visibly marked Unconfirmed, with a warning attached and qualification tracking switched off. That is strictly better than the listicles, which present everything with identical confidence and are demonstrably wrong about Red Robin and Buffalo Wild Wings. The promise becomes "we tell you what we know and what we do not," which is more defensible than a short list claiming perfection.

Every offer stores its rules as structured data covering at minimum:

- Whether a loyalty account is required, and whether the mobile app specifically is required
- The advance signup deadline, in both fixed-day form (7 days before) and relative-period form (before the birthday month)
- Any prior purchase requirement, with lookback window, product category constraint, and whether it recurs annually
- The redemption window with an explicit **anchor**, because Dutch Bros counts 30 days from collection while Sephora uses the calendar birthday month
- Minimum spend and location validity, both stored **per channel**, because Sephora is $25 online and $0 in store
- A source link, the exact sentence from the source supporting each rule, and the date last verified

`docs/research/reward-terms.md` section B enumerates 30 distinct rule categories observed in real terms. That list is the schema.

### 10.4 Personal qualification tracking

For each offer the user records their state: no account, account created, birth date on file, qualifying purchase made. The app computes **Qualified**, **Action needed**, or **Not eligible this year**, and names the remaining action.

No competitor has this, including Freebird. It is the reason the reward half is not a commodity.

### 10.5 The deadline notification ladder

Notifications fire on each offer's real deadline, not a generic countdown. Starbucks at 7 days and Ulta before the month are two different notifications on two different days.

This is the retention engine. Roughly 8 to 12 sessions per user per year out of the core mechanic alone.

### 10.6 The birthday day plan

An ordered, time-boxed itinerary built from confirmed rewards, store hours, travel time, today's weather and each reward's redemption window, with a rain fallback.

**Deliberately not a language model.** It is a scheduler over verified inventory. It cannot hallucinate and it can be unit tested. The concierge comes in version two, once there is verified data to reason over.

### 10.7 The share card

One image: your date, your famous twins, and what you got. This is the growth loop and it is cheap. Section 13.

### 10.8 Claim logging and problem reporting

Mark claimed, rate it, report a problem. Reports feed the verification queue, which is how the catalog stays honest at low cost.

### 10.9 Proposed shape

Three tabs. **Today** (the day page for today, the daily-open reason), **Mine** (your day, your countdown, your rewards, your plan), **Me** (history, saved, settings). Anything that needs a fourth tab is probably not in the minimum viable product.

---

## 11. Explicitly not in the minimum viable product

- **User to user contact of any kind.** No messaging, no rooms, no matching, no feed, no following. Section 4.4 has the evidence and the arithmetic. Twin counts are a number, not a door.
- **Sending birthday wishes.** Section 3.7. He was not short of wishes.
- **Wishlists and gifting.** A different app. The category is crowded with GiftList, Giftster, Things To Get Me, Farha and Ouish, and every one of them runs on an existing friend graph. Stranger funded wishlists additionally bring payments, fraud, moderation, and a serious safety exposure around minors soliciting from adults. Not a version one problem, and arguably never ours.
- **An artificial intelligence concierge.** Version two, on top of verified data.
- **Activity risk scoring**, the real answer to "will I get skunked fishing today." The most interesting long term idea in the product. Needs fish counts, river conditions and weather windows. Version two or three.
- **Friends' birthdays.** Version 1.5. Best retention answer, but shipping it first makes Birthed look like the fortieth reminder app.
- **Local and independent businesses.** National chains only, so nobody sees an empty screen.
- **Agent profiles.** Nothing built. Data model stays open.
- **Android and web.**

---

## 12. Future versions

**Version 1.5, roughly three months post launch.** Friends' birthdays, with the qualification engine pointed at gift timing. Reward expiry notifications, since Dutch Bros gives 30 days from collection and IHOP's points expire in 365 days, which is a legitimate post-birthday notification stream. Version 1.0 already records the collection date, per `docs/specs/SRS.md` FR-069, so this stream has an anchor to count from.

**Version 2.** The artificial intelligence concierge, reasoning over the verified catalog, confirmed qualification state, weather, budget and interests. It must cite which verified record it drew on and must never state a rule absent from the catalog. Also activity risk scoring, starting with fishing and thrifting, only in markets where the underlying data exists.

**Version 3.** The web surface at birthed.app, one page per calendar day, carrying the famous births and the verified rewards. This is the search play in section 13 and the day page from 5.1 is already the right shape for it. Local business coverage in launch markets.

**Only if density arrives.** Twin-to-twin contact. Not before tens of thousands of users, for the reasons in 4.4.

**Someday, only if the human product works.** Agent profiles. The data model reserves a profile type field with values HUMAN and AGENT from day one. If it never happens, the cost was one column.

---

## 13. Growth loop

The central decision: **do not build a social graph. Borrow everyone else's.**

The share card goes to Instagram, TikTok and iMessage, where the user's friends already are. This sidesteps the density problem entirely. Twin content is interesting to share on day one with ten users, because the famous names are there regardless of how many people have installed the app.

Ranked by confidence:

**1. The share card. Medium to high.** Your date, the well known people who share it, and what you got free. Screenshot native. The content is genuinely interesting because most people do not know these offers exist and do not know who shares their day.

**2. Search, through the web surface. Medium to high, and the best evidence-backed channel available.** Famous Birthdays gets 23.4 million monthly visits with 77.6 percent from organic search. That proves the search demand exists and is enormous. A page per calendar day at birthed.app, carrying both the famous births and the verified rewards, is a credible way to capture some of it. Version 3 to build, but the day page in 10.1 should be designed for it now.

**3. Friend invites. Low in version one**, since there is no friend graph. Real in 1.5.

The loop we are betting on: **a user sees their day, finds it interesting enough to share, a friend installs out of curiosity rather than need, and that friend arrives early enough to actually qualify for things.** Note this loop works best when it fires well before the friend's own birthday, which is a scheduling problem we do not yet have a good answer to.

---

## 14. Retention strategy

**This is the hardest problem in the product and the most likely reason it fails.** Draft 2 is better positioned than draft 1 because it now has two independent legs instead of one.

**Leg one: the pre-birthday deadline ladder.** T minus 45, 30, 14, 7 and 1, plus the day and a wrap up. Roughly 8 to 12 sessions per user per year out of the core mechanic, no extra features required. High intensity, narrow window, once a year.

**Leg two: the daily day page.** Who was born today, available all 365 days. Famous Birthdays proves the appetite at 23.4 million visits a month. Low intensity, unlimited window. This is the leg draft 1 did not have, and it is the whole reason the direction changed.

The two legs are complementary rather than redundant. Leg one produces intense engagement in a six week window. Leg two produces light engagement year round. Neither alone is enough.

**Leg three, version 1.5: friends' birthdays.** Turns one day a year into fifteen or thirty. Proven category at 17,739 ratings on hip. This is the strongest structural answer available and should be treated as planned rather than optional.

**Leg four: post-birthday reward expiry.** Dutch Bros gives 30 days from collection, IHOP's points expire in 365 days. Extends engagement for a month after the day.

**The Freebird problem.** Freebird did not solve retention cleverly, it solved it structurally by covering free things all year. That is a better answer than anything above and we should be honest about it. We are not copying it, because competing on catalog breadth against someone already ahead leaves no differentiator, and because a year round deals app is a different product with different economics. But refusing to copy it means legs two and three have to genuinely work rather than merely exist.

**The honest failure mode.** If leg two turns out to be shallow, meaning people look at the day page once and never again, and leg one only fires for six weeks a year, then Birthed is a once-a-year app with a nice design. That is the outcome to watch for, and the metric that reveals it early is **day 30 retention among users whose birthday is more than 60 days away.** If that number is bad, the identity leg is not working and the strategy needs revisiting, not more features.

---

## 15. Monetization hypotheses

Nothing here is proven. The direction change splits the app cleanly, which helps: **the free half is the growth engine, the paid half is the utility.**

**Hypothesis A: subscription on the utility, the primary bet.** Free gets the day page, your day, famous twins, the share card, and a limited set of rewards. Paid gets the full catalog, qualification tracking, the per offer deadline ladder, and the day plan in every cycle after the first. Free gets the birthday morning notification and one summary 45 days out, and no other notifications. The per offer deadline ladder is the sharpest line in the product and the main reason to upgrade. Decided September 4, 2026, on the reasoning that a free user who never hears from the app never comes back to be converted, and that the 45 day summary saying seven rewards need action is the paywall's best sales moment. Annual pricing fits a once-a-year value moment better than monthly, around $9.99 a year. The identity content stays free forever because it is the funnel and it wants to be shared. The open question is real: will people pay for value they collect on one day?

**Hypothesis B: loyalty program referral, the most natural fit.** The app's core action is getting people to sign up for loyalty programs, which has real value to those brands. The revenue event and the user value event are the same event, which is close to ideal. **Whether affiliate arrangements exist for these specific brands is unverified and must be checked before it is counted on.**

**Hypothesis C: advertising on the identity surface only.** Famous Birthdays proves a birthday content audience monetizes on programmatic advertising at scale. But ads are the single most common complaint in reviews of every competing freebie app. If this is ever tried, it belongs on the free content surface and must never touch the reward screens, where trust is the product.

**Hypothesis D: sponsored placement in rewards. Recommended against.** It directly conflicts with the accuracy promise. If it ever happens, sponsored entries must be visibly labeled and must never outrank an offer the user is more likely to qualify for.

**Recommended path: subscription first, referral second, and hold the advertising question until leg two of retention is proven.**

---

## 16. Risks

### 16.1 Product risks

**Retention on the identity leg. High severity, and now the central bet.** Section 14 names the metric that reveals it early.

**The inverted cold start. High severity, high likelihood.** People discover a birthday app on their birthday, the day it can help least, because the deadlines already passed. Journey C is the design answer. Draft 2 improves this materially: the identity half still works perfectly on a birthday morning, so a late arrival gets something real instead of only being told what they missed.

**Competing with Famous Birthdays on content.** They have twelve-plus years, a proprietary database, and 23.4 million monthly visits. We will not beat them at breadth. The wedge is that they are a destination you go to and we are an app that knows your date and comes to you. That is a real difference but it is not a wide one.

**The identity content may be commodity too.** Wikipedia has it, free. What makes ours worth opening is that it is personalized to your day and joined to something actionable. If that combination is not compelling, we have built a worse Wikipedia.

**Freebird deepening their birthday tab.** If they add real qualification tracking, they arrive at half our product with a year round audience already installed. **This is the most serious competitive risk in this document.**

### 16.2 Accuracy risks, the ones that can kill the product

**Wrong information sends a user to a store and embarrasses them.** Worse than a crash, because it damages the one thing we claim to be good at.

Requirements, not nice to haves:

- Every offer shows the date it was last verified, in the interface, not buried.
- Every rule is backed by the exact sentence from the source, with the link one tap away.
- Any record past a set age is shown as unverified rather than silently served as fact.
- One tap problem reporting, feeding the verification queue.
- The app never states a rule the source did not state. Silence shows as "not stated by the brand," never as a guess.

**Artificial intelligence extraction inventing a rule.** High likelihood without controls. The mitigation is structural: **extraction must quote the source sentence, and the human reviewer approves the quote, not the summary.** No offer publishes without a source quote, a link and a named reviewer. A model that cannot find a supporting sentence outputs nothing.

**Brands changing terms without notice.** Documented explicitly at Jersey Mike's, Dutch Bros, Sephora, Ulta and Starbucks. Not eliminable. Designed for with expiration dates.

**Content licensing.** Wikidata's public domain dedication makes structured facts safe. Wikipedia text and Commons images are not automatically safe and need attribution handling and per-file checks. Celebrity images carry publicity-rights questions separate from copyright.

**Legal exposure from republishing brand terms.** Quote minimally, always link out, never imply a brand endorses Birthed.

### 16.3 Artificial intelligence recommendation risks, version two

- Recommendations explain why. "Because it is raining and your Dutch Bros reward expires in 3 days" is acceptable. A bare suggestion is not.
- Anything generated rather than verified is visibly labeled. The line between a verified rule and a model's suggestion is never blurred.
- The model cannot invent a reward, a rule or a deadline. It reasons only over records already in the catalog.

### 16.4 Technical risks

Covered in `docs/specs/SDS.md`. In short: the freshness pipeline is the real risk, not the app. Calendar date handling is the sharpest correctness risk, including February 29 birthdays, time zones, and the daylight saving bug that appears in a competitor's reviews as reminders firing an hour off in winter.

---

## 17. Open questions for Jason

**Decided September 4, 2026:**

- **Day page depth.** 10 to 50 people per date, plus up to 5 events, sourced from Wikidata with Wikipedia and Wikidata both credited. Wikipedia article text is not used, for the licensing reason in `docs/specs/SDS.md` section 8.1.
- **Catalog size.** At least 50 brands at the Verified tier is the gate to ship. 150 or more is a post launch target, published from the server with no application release. Revised September 4, 2026.
- **Day plan.** Full scheduler with weather and routing ships in version one.
- **Accounts.** Silent anonymous account on first launch, Sign in with Apple offered later from settings. No sign-in wall anywhere.
- **First vertical slice.** The day page, end to end.
- **Backend.** Supabase.
- **Free tier boundary.** Identity content free, utility paid, as proposed in section 15, with two carve-outs decided September 4, 2026: the birthday morning notification and one 45 days out summary are free, and the day plan is free during a user's first birthday window only.
- **Human review.** Jason reviews, but the language model is the primary aggregator at every stage before review, including discovering candidate brands and drafting the rules. See `docs/specs/SDS.md` section 10.
- **Brand operating hours** are gathered by the pipeline alongside the reward terms, not by a separate manual pass.
- **App Store category.** Finance primary, Lifestyle secondary. Freebird also chose Finance, so this is a deliberate head-to-head placement in the category where deal-seekers already browse.

**Still open:**

1. **Launch timing.** Whether to run a full 45 day cycle on yourself before shipping, so the deadline ladder is proven against a real birthday rather than a simulated clock. This is the only remaining question that affects the schedule.

---

## 18. Confidence assessment

**Verified facts.** Everything in section 8 and 3.4 sourced from `docs/research/`. App ratings and release dates pulled from Apple's public lookup interface on September 4, 2026. Similarweb traffic figures for Famous Birthdays. Brand terms language and effective dates read from the brands' own pages. Freebird's Birthday tab read from a screenshot. Quoted App Store reviews.

**Logical inferences.** That stranger networking over shared birthdays does not work, drawn from three apps and two combined ratings. That the twin density arithmetic explains why. That the freebie catalog is a commodity, drawn from the volume of public listings. That identity is the better front door, drawn from Famous Birthdays' verified scale against the twin apps' verified failure. That freebies function as anti-skunk insurance, drawn from one person's stated experience.

**Assumptions.** That other people feel the decision paralysis in 3.1. That the day page produces repeat opens rather than one look. That users will pay for annual value. That the share card gets shared. That loyalty referral revenue is available.

**Unknown or unverifiable.** Whether Freebird stores deeper rules than its cards show. Whether affiliate programs exist for these brands. Total addressable market. Whether the identity leg retains anyone, which is now the central bet.

**Overall confidence in this product definition: 0.74.** Up from 0.72, and the composition changed more than the number. Confidence in the reward accuracy wedge went up to about 0.85, because the Starbucks card verified it. Confidence in retention went down, because the honest read of Freebird is that a year round competitor has a structural advantage.

**I cannot confirm this with high certainty.** The largest remaining unknown is whether the identity leg produces repeat engagement or a single look. Famous Birthdays proves people will visit a birthday content site. It does not prove they will return to an app, and their own numbers show a 64 percent bounce rate and 1 minute 18 second average visit, which is not deep engagement. The cheapest thing that would raise this number is still the same as in draft 1: talk to eight or ten people about their last birthday, and separately, ask them whether they have ever looked up who shares their birthday.
