-- Five date pages opened with a serial killer or a dictator.
--
-- November 24 led with Ted Bundy. November 12 with Charles Manson. August 27
-- with Ed Gein. March 17 with John Wayne Gacy. July 29 with Benito Mussolini.
-- Each was the first row under a heading reading "The people most looked up on
-- this day", on the page the site asks Google to rank, seen by somebody who
-- came to look up their own birthday.
--
-- The cause is written down twice in this repository already and was fixed in
-- neither of the places that needed it. notability_score is attention, infamy
-- is attention, and DayLine.swift says exactly that: it is why the names came
-- off the app's celebration screens. 20260906130000 said the same thing about
-- adult performers and fixed only them. Nobody carried either fix to the list
-- itself.
--
-- Same shape as adult_content, deliberately, so there is one mechanism and not
-- two: a column set by a rule that also lives in the importer so a re-import
-- keeps it, and a read policy so no individual reader has to remember.
--
-- **This is a floor and not a solution, and that matters more than the fix.**
-- Screening.swift already explains why. An event's sentence describes the
-- thing being refused; a person's description does not. Wikidata calls Bashar
-- al-Assad a politician and Andrew Tate a businessman, and no list of words
-- reaches either. What actually solves it is the page not leading with a
-- ranked list of names, which is the change this lands beside.
--
-- The bare word "criminal" is deliberately absent. It was in the first draft
-- and a test caught it hiding "American criminal defense attorney". Removing
-- it costs nothing here: all five are still caught, Manson by "cult leader".
-- "war criminal" stays, because that phrase means one thing.

alter table notable_people
  add column if not exists violence_content boolean not null default false;

comment on column notable_people.violence_content is
  'Their Wikidata description says they are known for harming people: serial killer, murderer, terrorist, war criminal, dictator, cult leader and so on. Forces notability_score to zero and hides the row from every anonymous reader. Set by the same rule in worker/src/notability.ts, so a re-import keeps it. It only catches people whose description says what they did, which is a floor and not a solution.';

create index if not exists notable_people_violence_content_idx
  on notable_people (violence_content) where violence_content;

-- The same terms as isViolentNotoriety in worker/src/notability.ts. These two
-- lists are meant to agree, and Screening.swift is the standing warning about
-- what happens when one list lives in two files: the Swift copy and the
-- TypeScript copy had already drifted apart before anybody noticed.
update notable_people
set violence_content = true
where short_description ~* '(serial killer|serial murderer|murderer|mass murderer|spree killer|mass shooter|school shooter|killer|terrorist|war criminal|genocide|dictator|nazi|rapist|child abuser|sex offender|cult leader|assassin|mobster|gangster|crime boss|mafia|kidnapper|arsonist|torturer|slave trader)';

update notable_people
set notability_score = 0
where violence_content and notability_score <> 0;

-- One policy, both screens, so no reader can be handed either.
drop policy if exists read_notable_people on notable_people;

create policy read_notable_people on notable_people
  for select using (not adult_content and not violence_content);
