# The first five minutes

Written September 6, 2026. This is not a vision document. It is one person, one
session, and a decision about every feature in the app measured against that
session alone.

## The premise

It is my birthday. A friend sent me something from Birthed: a share card, or a
link. I install it. I have five minutes before I go back to my day. At the end
of those five minutes I either think "yeah, I am keeping this" or I never open
it again, and almost every app I install lands in the second pile.

Everything below is judged by one question: does this move me toward the first
pile in the first five minutes. Not toward growth, not toward a catalog, not
toward being right about February 29. Toward not uninstalling.

## What activated means

**Activated: the person has entered a birth year and added one other person
with a real date, in the first session.**

Two events, both observable on the phone, both cheap to record, and each one
is a different half of the product.

- **The year** is the proof they trusted the app with something. It is also
  the switch that turns on the only content in the app that is about them
  rather than about the date: the song, the day count, the things they are
  older than. Somebody who skips the year has seen the app and not themselves.
- **One other person** is the proof they understood what the app is for. It is
  the only action in the first five minutes that creates a reason to open the
  app again, because it creates a notification that arrives on a day that is
  not their own. Nobody comes back for their own birthday. It is a year away.

Not activation: opening the app, finishing onboarding, taking a screenshot,
sharing a card. Those are the hook. The hook is what makes the session good.
Activation is what makes there be a second session. A screenshot with no person
added is a screenshot of an app that is about to be deleted.

This definition is a hypothesis. The check is day seven retention split by the
two flags once there are a few hundred installs, and if year entry turns out
not to predict return, drop it from the definition and keep the person.

## The core loop, and it is the only loop

```
somebody's birthday comes round
        -> Birthed tells me the morning of
        -> I tap it and a message is already written
        -> I send it, in thirty seconds, and feel like a good friend
        -> the app has earned the next one
```

That is the whole product for the next while. Every feature either makes that
loop start (get people in), makes it fire (reminders), makes it close (the
composer), or is not on the critical path and gets cut or shelved.

The loop has a measurable centre: **messages sent per reminder delivered.** If
that number is high the app is doing its job and people will keep it. If it is
low the reminders are noise and no amount of identity content fixes it.

The install loop hangs off it. Every message that gets sent is to somebody who
did not know the app existed, and every card that gets shared is seen by
people whose birthday is also coming. That is distribution, and it is free,
and it only happens if the loop above is turning.

## The five minutes, screen by screen

Each screen has one emotion it is for. If a screen cannot name its emotion it
should not exist.

### 0:00. The message from the friend

Not our screen, but it sets the first emotion and we control what the friend
was able to send.

**Emotion: this is about me.** The friend sent either a share card with today's
date on it, or a link. The card works because it is a picture of my day. The
link works if it does one thing when opened on my birthday: open the app with
today already filled in.

**Decision.** The share card and the birthed.app link stay. The link should
carry the sender's own birthday in the fragment, which it already can, so the
sender is one tap from being added at the end of the session. That closes the
install loop without asking anybody for a contact list.

### 0:10. Screen one: your day

**Emotion: seen.** Not welcomed, not onboarded. Seen.

If the link says today, the screen is a candle, today's date large, and one
question: "Is today your birthday?" with one big yes. That is the whole
screen. No wheel, no logo animation, no three word tagline.

If the app was installed cold, the day wheel as it exists now, because it
already answers as it turns and that is the right idea. The twins line under
it ("You share it with") stays but is capped at three names. Nobody reads ten.

**Cut from this screen:** everything else. The zodiac and the twin count can
wait; they are on the next screen anyway.

### 0:20. Screen two: the year

**Emotion: wait, that is true.** The first surprise. This is the best screen in
the app and it stays almost exactly as it is: the wheel turns and the day of
the week and the day count answer live, and when it settles the number one
song appears.

Two changes. The skip button becomes small and grey, because the year is half
of activation and the screen should make a case for itself first. And the
album and the film go. Nathan called them filler and for this screen he is
right: the song is the one people read out loud, and two more charts under it
turn a surprise into a list.

### 0:40. Screen three: Mine, on the day

**Emotion: this is mine. Pride, and the itch to screenshot it.**

This is the screen the whole session is for and it should be one screen with
no scrolling needed to get the point. In order, top to bottom:

1. The candle, lit, with confetti, and "Happy birthday". Hold to blow it out.
   Already built. This is the event.
2. The number one song the week you were born, large.
3. One number: how many days you have been alive. Counting up. Not two
   numbers, not a milestone under it. One.
4. One sentence you are older than something: "You are older than Kingdom
   Hearts." When the fact finder has it. When it does not, nothing, and the
   screen is still complete without it.
5. The share button. One. It is the only action on the screen.

**Below the fold**, for the person who scrolls: the rest of the found facts,
who else has the day, the zodiac sign, the sources line.

**Cut from this screen:** the album, the film, the birthstone, the flower, the
Chinese animal, the milestone countdown, the chips row as a row. Every one of
those is true and every one of them makes the song smaller. The birthstone and
the flower are greeting card content and this audience does not send greeting
cards. The Chinese animal is one line under the year on screen two, which is
where it already appears, and that is enough. The thumbs up on facts goes
until there are enough users for likes to mean anything, which the research
document already says is five thousand impressions away.

### 1:30. The share

**Emotion: I want people to see this.** The tap on share opens one card, not a
picker. The picker with variants stays in the code and comes back when
somebody asks for it. The card is the screen they just looked at, so there is
no surprise and no choice to make. The share sheet is the system's.

The person they share it to first is very often the friend who sent it. That
is fine. That is the point.

### 2:00. Screen four: whose birthday do you keep forgetting

**Emotion: oh, this is for something.** Until now the app has been a mirror.
This is where it becomes a tool, and it has to happen inside the first
session or it never happens.

It is not a tab they might find. After the share, or after the first time
they leave Mine, the People screen is shown once with two things on it: the
sender, if the link carried their date, as a card saying "Sam sent you this.
Add Sam's birthday?" with one tap, and the paste box. Paste a list is the
fastest way in and it already exists. Type one in is the small link under it.

One person added is activation. The screen should make that one tap trivially
easy and then get out of the way.

**Cut from this screen:** the follow a public figure path and the suggested
public figures on the empty state. Both are good features later and both are
wrong here. A list of footballers in front of somebody who has not yet added
their mother teaches them the app is about celebrities, and it spends the
sixty four notification slots on people who will never text back.

### 2:30. The one permission

**Emotion: yes, obviously.** The moment somebody adds a person, the app has a
reason to ask for the one thing the loop needs, and it should ask right then:
a single row under the new person, "Remind me the morning of and three days
before", already switched on, and the system prompt when they leave the
screen with it on.

This is a change to `FR-070`, which puts the prompt behind a switch in
Settings. The rule was written to keep the prompt out of onboarding, and it
was right about that. But a permission asked from a switch nobody visits is a
permission never granted, and a reminder app with no permission is a list.
The row is still a control the user touched, which is what the rule was
protecting. The difference is that it is in front of them at the moment it
makes sense instead of three taps away in a screen they will never open.

**Nathan decided this on September 6, 2026: build it.** `FR-070` in `docs/specs/SRS.md`
has been rewritten to match, and it is item 2 of the build order at the foot
of this document.

### 3:00 to 5:00. Leaving

**Emotion: nothing owed.** No account to make, no email, no paywall, no rating
prompt, no "turn on notifications" banner, no badge. They have seen
themselves, shared it, added a person, and been promised a reminder. They put
the phone down. The next time they hear from Birthed is the morning of
somebody's birthday, with a message already written, and that is when they
decide it was worth keeping.

## Every feature, judged

Keep means it is on the critical path of the five minutes or the loop.
Simplify means it stays but loses weight. Later means it is right and not now:
it stays in the code, off the screen. Delete means it goes.

| Feature | Verdict | Why |
|---|---|---|
| Day wheel with live twins and countdown | **Simplify** | One tap "today" when the link says so. Wheel only on a cold install. Three twins, not ten. |
| Year wheel with weekday, day count, song | **Keep** | The best screen in the app. Skip becomes small. |
| Album and film charts | **Delete from screens** | Filler beside the song. Data stays. |
| Chinese animal on the year screen | **Keep** | One line, already there, costs nothing. |
| Candle, confetti, hold to blow out | **Keep** | The birthday is an event. This is the event. |
| Days alive counter | **Keep** | The one number. |
| Milestone countdown ("9,000 days on Tuesday") | **Later** | A second number under the first number. Good notification material later. |
| Zodiac, birthstone, flower chips | **Delete birthstone and flower. Zodiac below the fold** | Greeting card content for an audience that does not send greeting cards. Zodiac is the one they say out loud. |
| Found facts, older-than category | **Keep, promote** | The one sentence that measures the world against the reader. It is the mirror. |
| Found facts, everything else | **Simplify** | Below the fold. Shown when ready, never waited for. |
| Likes on facts | **Later** | Meaningless below five thousand impressions, and a control on every row. Sharing a fact stays. |
| Share card | **Simplify** | One card, the screen they just saw. The picker and variants stay in code. |
| Today tab | **Reversed September 6. Keep it, and keep it a tab** | The verdict below was made about a screen that was ten names, and it was right about that screen. The feed replaced it hours later. See the note under this table. |
| People tab, soonest first | **Keep** | The loop. |
| Paste a list | **Keep** | The fastest way in. |
| Ask for a birthday by link, and the /add page | **Keep, promote** | It becomes the install path. The sender is one tap from added. |
| Follow a public figure | **Later** | Right feature, wrong moment. It spends notification slots and teaches the wrong lesson. |
| Suggested public figures on the empty People tab | **Reversed September 6. Keep** | Half the original reason is already solved in code. See the note under this table. |
| The composer with the written message | **Keep** | It closes the loop. Without it the reminder is a chore. |
| Reminders, the morning of and three days before | **Keep** | The loop firing. |
| The permission prompt in Settings only | **Simplify, move** | Ask on the first added person, from a row they touched. Decided September 6, 2026. `FR-070` rewritten. |
| Own birthday morning notification | **Keep** | It opens the app on the one day the Mine screen is at its best. |
| Own 45 day countdown notification | **Later** | One ping a year about yourself, counting nothing. Not wrong, not needed. |
| Region and regional facts | **Later** | Good content nobody sets up. Out of the first session entirely. |
| Replay the reveal | **Keep** | It is how people make a second screenshot. |
| Delete account | **Keep** | Required. |
| Sources and attributions | **Keep** | Required by the licences, two taps away. |
| Twin count (people sharing the exact birthday) | **Simplify** | One line on Mine below the fold. |
| Web date pages, sitemap, noindex rule | **Keep, out of scope here** | Distribution, not the session. |
| Reward schema and qualification engine | **Already shelved** | Unchanged. |

## Two verdicts reversed, September 6, 2026

Both rows above are struck through rather than rewritten, because a document
whose value is that it says no is worth nothing if its noes are quietly edited
into yeses afterwards.

**The Today tab stays a tab, and item 5 is dropped.** The original verdict was
made about a screen that was ten names, which is the one thing Famous Birthdays
already wins at, and about that screen it was correct. The feed replaced that
screen hours later on the same night, and the verdict was never revisited. It
is now a feed of 19,734 events indexed by how old the reader was, which is the
one question no competitor can answer, and an outside review looking at the
built screen called it the strongest surface in the product.

The risk the original verdict named does not go away and is worth restating:
on your own birthday you do not want to browse other dates. That is handled,
and was already handled, by `FR-033`: inside the birthday window the app opens
on Mine rather than on today's page. The second risk is real and unhandled: a
third tab that is genuinely good is exactly the kind of thing that quietly
becomes what the app is about, and this app is about the people you know. The
answer to that is the measurement in the next section rather than an argument
here. If people open Today and never add a person, the verdict comes back.

**The suggested public figures stay on the empty People tab.** The original
reason had two halves. The first, that following people spends the sixty four
notification slots that should go to somebody's mother, is already solved:
`NotificationPlanner` puts people you know ahead of people you follow whatever
the dates, with a test that follows eighty four people across January and
February and checks that a friend in December still keeps both of her
reminders. The second half, that a list of strangers teaches the wrong lesson
about what the app is for, still stands, and it is weaker than the problem it
was competing with. An empty People tab with nothing on it but an instruction
is where this app dies, and one tap on a real name is a better first move than
no move at all.

**Discovery went behind the menu, September 6.** The ask was a three section
People tab with the carousels in the middle of it. That is the arrangement this
document argues against: the tab has one job, getting real people into it, and
a permanent module of strangers in the middle of it teaches the opposite. So
the carousels live inside the follow sheet, which is reached from "Add someone"
and is only opened by somebody who has already decided they want a public
figure. Same feature, same data, none of the teaching.

Two carousels, and neither is called trending, because nothing in the data
supports that word. There is no time series anywhere, only a monthly pageview
figure, so "trending" would be a claim we cannot make. They are "birthdays this
week", which is real, computed from the calendar and the most useful thing this
screen can say, and "born around your year", which already existed.

**What did not change.** Everything else in the table, and items 1 through 4 of
the build order. The trimming of Mine in item 3 is smaller than it reads: the
table demotes most of what it lists rather than removing it, and only the
birthstone and the flower are actually deleted. It is ordering work.

## What is not being decided here

The five year question, the catalog, the video plan, what the web pages should
become. None of that is in this document on purpose. The claim is narrower:
if the five minutes above are built and the loop measured, the app has earned
the right to have those conversations. If they are not, none of those
conversations matter, because nobody will still have the app installed to
benefit from the answers.

## The order to build it

1. The People screen shown once after the first share, with the sender card
   and the paste box. Smallest change, biggest effect on activation.
2. The reminder row on the first added person. Decided and built.
3. Mine trimmed to five things above the fold.
4. The one tap "today" entry from a link.
5. ~~Today becomes a screen reached from a person rather than a tab.~~ **Dropped
   September 6.** Today stays a tab. The reasoning is in the note under the
   table above.

Measure after each: year entered, one person added, permission granted,
messages sent per reminder. Four numbers. Not twenty.
