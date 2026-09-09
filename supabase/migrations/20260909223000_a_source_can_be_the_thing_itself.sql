-- A source can be the thing itself, not a report of it.
--
-- docs/the-wall.md section 5 names three tiers, and the highest of them is
-- seen directly: video, a filing, a record, an official statement. tierFor in
-- worker/src/wall/pool.ts already takes that as its second argument, but
-- nothing in the schema records it, so the argument was always false and the
-- tier was unreachable. This is the column it was waiting for.
--
-- It is a judgement about the kind of source and it is never guessed from a
-- host name. A newspaper's page about a court filing is reporting; the filing
-- is the thing itself. The submitter says which, and a curator can correct it.
-- The checker reads it and never writes it.

alter table wall_sources
  add column is_primary_doc boolean not null default false;

comment on column wall_sources.is_primary_doc is
  'True when this source is the record itself rather than an account of it: video, a filing, a public record, an official statement. Set by a person, never inferred from the address, and only reaches the seen directly tier once its quotation verifies like any other source.';
