alter table public.exercises
  add column if not exists content_release_id text,
  add column if not exists content_version text,
  add column if not exists definition jsonb not null default '{}'::jsonb;

comment on column public.exercises.content_release_id is
  'Versionoidun, muuttumattoman harjoitussisältöjulkaisun tunniste.';
comment on column public.exercises.content_version is
  'Harjoitemäärittelyn semanttinen versio.';
comment on column public.exercises.definition is
  'Julkaistusta offline-sisältöpaketista generoitu täydellinen harjoitemäärittely.';
