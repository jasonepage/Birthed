-- Owners for the outlets the wider feed list brings in.
--
-- worker/src/wall/news.ts grew from six feeds to fourteen so a wall carries a
-- whole day rather than one desk's version of it. Two sources count as
-- independent only when their owners differ, and a domain missing from this
-- table is treated as its own owner, so without these rows Variety and
-- Billboard would look independent of each other when Penske owns both. That
-- would let one company's two mastheads carry a story to the reported tier on
-- their own, which is the exact thing the tier is meant to refuse.

insert into wall_outlet_owners (domain, owner) values
  ('variety.com',        'Penske Media'),
  ('billboard.com',      'Penske Media'),
  ('rollingstone.com',   'Penske Media'),
  ('hollywoodreporter.com', 'Penske Media'),
  ('deadline.com',       'Penske Media'),
  ('polygon.com',        'Vox Media'),
  ('sbnation.com',       'Vox Media'),
  ('eater.com',          'Vox Media'),
  ('pitchfork.com',      'Advance Publications'),
  ('arstechnica.com',    'Advance Publications'),
  ('gq.com',             'Advance Publications'),
  ('ign.com',            'Ziff Davis'),
  ('mashable.com',       'Ziff Davis'),
  ('pcmag.com',          'Ziff Davis'),
  ('kotaku.com',         'Keleops Media'),
  ('theverge.com',       'Vox Media'),
  ('vulture.com',        'Vox Media'),
  ('nme.com',            'Caldecott Music Group'),
  ('pitchfork.co.uk',    'Advance Publications'),
  ('gamespot.com',       'Fandom'),
  ('giantbomb.com',      'Fandom')
on conflict (domain) do update set owner = excluded.owner, updated_at = now();
