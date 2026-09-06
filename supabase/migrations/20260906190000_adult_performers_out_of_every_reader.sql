-- Adult performers are scored to zero and still reachable. This closes that.
--
-- 20260906130000 added notable_people.adult_content and made the importer set
-- it, and it forces notability_score to zero so nobody described that way can
-- open a date page. That fixed the page it was written about and it fixed
-- nothing else, because a score only decides an order. Every reader that asks
-- for people by some other rule still gets them, and on September 6 the People
-- tab opened with one of them as the card for today, at full size, under the
-- word TODAY.
--
-- The follow sheet is the path that finds them. Its two lists ask for
-- birthdays this week and for people born around the reader's year, filtered
-- on monthly views and on having a social account, and neither of those asks
-- anything about the score. The website's date pages and the day page in the
-- application read the same table under the same policy.
--
-- So the filter goes where the last migration already said filters belong, in
-- the read policy rather than in each reader, and for the same reason it gave:
-- there are several readers, a filter each one has to remember to apply is a
-- filter one of them will forget, and one of them already did. Row level
-- security applies to the anonymous key both the application and the website
-- ship, and to nothing the service role does, so the importer still sees every
-- row, still scores it, and still sets the column.
--
-- What this does not fix, and it is worth writing down rather than discovering
-- later: the rule reads Wikidata's one line description, so it catches people
-- Wikidata describes that way and nobody else. A creator whose description
-- says "social media personality" is not caught by any list of words, because
-- the words are not there. That is a limit of the approach and not a bug in
-- it, and closing it needs a different mechanism, whether that is a blocklist
-- of identifiers or a judgement made once per person and stored.
--
-- Reversible by one statement, which is the previous policy body.

drop policy if exists read_notable_people on notable_people;

create policy read_notable_people on notable_people
  for select using (not adult_content);

comment on column notable_people.adult_content is
  'Their Wikidata description marks them as an adult performer. Forces notability_score to zero, and since 20260906190000 also hides the row from every anonymous reader through the read policy on this table. Set by the same rule in worker/src/notability.ts, so a re-import keeps it.';
