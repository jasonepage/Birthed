-- Does it look like history. docs/the-wall.md section 29.
--
-- The database already holds 19,750 rows in historical_events, from the year 4
-- to 2026, one for every thing still listed under a date. That is not a list of
-- news, it is a list of what survived. This migration gives the wall somewhere
-- to keep the arithmetic that scores today's stories against it.
--
-- Three things land here and nothing is computed by this file:
--
--   the vectors, in their own tables, because no page ever reads them and
--   384 floats a row next to the story would be paid for on every wall read;
--
--   the verdict columns, on wall_stories, because every one of them is drawn
--   on a tile or a feed row and they must come back in the one request the
--   page already makes;
--
--   nothing else. The worker fills all of it.
--
-- The outlet's own headline is not touched and is never overwritten. It is
-- what the checker matches the source page against and it is what the receipt
-- shows. `sentence` sits beside it.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- The vectors
-- ---------------------------------------------------------------------------

-- 384 is all-MiniLM-L6-v2, which the worker runs on its own machine. Changing
-- the model means changing this number and re-embedding both tables, so the
-- model that wrote a vector is kept beside it.
create table historical_event_vectors (
  event_id bigint primary key references historical_events(id) on delete cascade,
  embedding extensions.vector(384) not null,
  model text not null,
  embedded_at timestamptz not null default now()
);

create table wall_story_vectors (
  story_id uuid primary key references wall_stories(id) on delete cascade,
  embedding extensions.vector(384) not null,
  model text not null,
  embedded_at timestamptz not null default now()
);

-- Cosine, because the embeddings are normalised and the question is about
-- direction: is this the same kind of thing, not is it the same size of thing.
create index historical_event_vectors_near
  on historical_event_vectors using hnsw (embedding extensions.vector_cosine_ops);
create index wall_story_vectors_near
  on wall_story_vectors using hnsw (embedding extensions.vector_cosine_ops);

-- Nobody reads these but the worker, which carries the service role key and
-- is not subject to row level security. Enabled with no policy means anon and
-- authenticated get nothing, which is the intent.
alter table historical_event_vectors enable row level security;
alter table wall_story_vectors enable row level security;

-- ---------------------------------------------------------------------------
-- What the page reads
-- ---------------------------------------------------------------------------

alter table wall_stories
  -- One plain sentence saying what happened, in this site's voice rather than
  -- the outlet's. Null until the worker writes one, and every drawing of it
  -- falls back to the headline.
  add column sentence text,
  add column sentence_model text,
  add column sentence_at timestamptz,

  -- Mean similarity to the nearest historical events, 0 to 1. How much this
  -- story rhymes with the things that lasted.
  add column lasting numeric,

  -- The single nearest one, which the tile shows. Not a foreign key with a
  -- cascade: an event being suppressed later must not delete a story.
  add column rhyme_event_id bigint references historical_events(id) on delete set null,
  add column rhyme_similarity numeric,

  -- PageRank over the day's own graph: how much the day revolved around this.
  add column centrality numeric,

  -- lasts, fades or unclear, and why, from the one model call.
  add column verdict text,
  add column verdict_reason text,

  add column sensed_at timestamptz;

alter table wall_stories
  add constraint wall_stories_verdict_known
  check (verdict is null or verdict in ('lasts', 'fades', 'unclear'));

alter table wall_stories
  add constraint wall_stories_lasting_range
  check (lasting is null or (lasting >= 0 and lasting <= 1));

-- The feed and the board order by these, per date.
create index wall_stories_lasting on wall_stories (wall_date, lasting desc nulls last);
create index wall_stories_centrality on wall_stories (wall_date, centrality desc nulls last);

-- What the worker asks for on every tick: the day's stories with no vector yet.
create index wall_stories_unsensed on wall_stories (wall_date) where sensed_at is null;
