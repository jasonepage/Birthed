# Internet culture on a date page

What a good row is, and the two rules that stop this becoming the thing it
would be easiest for it to become.

## Why bother

The site already answers "what happened on this date." The thing it could own
that nothing else does is narrower and better: **prove the thing you half
remember was real, and say exactly when it was.**

That is a real search. People type "what year was the dress" and "when did
vine actually shut down" and "what was that video with the kid at the
dentist." The answers are scattered across Know Your Meme, Reddit threads and
half-deleted archives, and none of it is indexed by date. A date indexed,
sourced timeline of internet culture does not exist. That is worth building.

## The problem

A meme does not have a date. It has a spread. Know Your Meme gives an origin
that is often approximate and sometimes argued over, and a lot of things have
no first posting anybody can point at any more because the platform deleted
it.

Birthed's only real promise is that it does not lie. Printing 14 February 2016
for a meme that drifted through that spring would break that promise worse
than having no row at all. Absent beats wrong, same as everywhere else here.

## Rule one: file the event, not the meme

Every row is **a thing that happened at a timestamp, which later became a
meme.** That is datable, sourceable, and it is what people are actually
searching for.

Things that have a real date:

- a specific Vine or video being uploaded
- a tweet, which carries its own timestamp
- a platform launching, changing or shutting down
- a real world event that became a meme, like a dress photograph or a death
  at a zoo
- a game, console or app release

Things that do not, and are therefore not rows:

- "the year everyone said bruh"
- a format, a template, a reaction image with no traceable first post
- anything whose only date is a Know Your Meme "circa"

### Datable is not the same as relevant

This rule used to end at the list above, and it listed album and film releases
among the things with real dates. They do have real dates. That was never the
question, and reading the two tests as one is what put three album releases and
two film releases on a single date the first time a generator was pointed at
this specification.

An album coming out is not internet culture. Nor is a film opening, a single, a
tour, a trailer or an awards show. Every date has several, they are what a
Wikipedia date page is already full of, and they are the filler this site
exists to replace. A row that clears rule one can still fail here.

One way such a thing gets in, and it changes what the row is about: if the
internet itself did something with it, the row is about what the internet did
and is dated to that.

- "OK Go released a single" is a release calendar entry.
- "The OK Go treadmill video was the thing everybody was sending each other" is
  internet culture, and its date is the upload, not the single.

The test, applied to every row: **if this exact sentence could sit on a
Wikipedia date page without looking out of place, it does not belong here.**
That is the whole differentiator. A row that fails it is not a small loss of
quality, it is the site being the thing it was built not to be.

## Rule two: say which kind of date it is

Every row carries a short qualifier, and it is not a hedge, it is the
interesting part:

- **posted** — the upload timestamp, exact
- **happened** — the event itself
- **went viral** — the week it broke out, when that is documented and the
  posting is not
- **ended** — a shutdown, a deletion, a ban

"This is when it spread, not when it was posted" is a more honest sentence
than any competitor writes, and it is also a better one to read. The
limitation is the differentiator. Do not hide it.

## Rule three: the age label is the payload

The app already works out "You were 11." Nothing else pairs internet history
with how old the reader was when it happened, and that pairing is the whole
emotional charge:

> Vine shut down. You were 14.

Write every row so that line lands under it. Short, concrete, no wind up.

## Rule four: do not explain the joke

Wikipedia's sentences are a large part of why a stranger called this site
generated after a minute. Internet rows must not sound like Wikipedia, and
must not sound like a listicle either.

Name the thing, say what happened, stop. A reader who was there does not need
it explained, and a reader who was not is better served by the link than by a
paragraph of an adult describing a joke.

Bad: "The video, which featured a young boy in a state of post anaesthetic
confusion, became a viral sensation and is widely regarded as an early
milestone in the history of internet virality."

Better: "David went to the dentist. His dad filmed the drive home."

## Rule five: thin years stay thin

Vine ran 2013 to 2016. TikTok arrived outside the United States in 2017 and
inside it in 2018. So internet rows cluster in about fifteen years, and 1974
gets almost none.

That is correct and it should not be padded. A date page with three internet
rows and forty other things is a good page. A date page with three real
internet rows and four invented ones is a dead site.

## What not to build

- No rankings. "The top ten memes of 2016" is content farm shape and reads
  as one instantly.
- No hosted clips. A link and a sentence. The licensing on any of this is
  somebody else's and the site has never needed the video.
- No "on this day in meme history" voice. That is a bot account.

## Sourcing

Same bar as the researched facts: a row survives only if the page it cites
says what the row says. For internet things that means, in order of
preference:

1. the post itself, when it still exists and shows its timestamp
2. an archive of it that shows the timestamp
3. a news report published within days, which dates the spread even when the
   posting is gone
4. Know Your Meme, only for a row whose qualifier is "went viral", never for
   one claiming an exact posting date

## Where it goes

`cultural_events` already takes this. `category` already allows `meme` and
`gaming`, and the date page already colours a row by its category, so a meme
row arrives with its own colour and needs no schema change at all.
