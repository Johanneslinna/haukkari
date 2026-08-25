create table public.training_content_releases (
  release_id text primary key,
  semantic_version text not null,
  status text not null check (status in ('DRAFT', 'INTERNAL_BETA', 'PUBLIC', 'RETIRED')),
  content_digest text not null,
  published_at timestamptz not null,
  immutable boolean not null default true check (immutable),
  created_at timestamptz not null default now()
);

create table public.exercise_definitions (
  content_release_id text not null references public.training_content_releases(release_id),
  exercise_code text not null,
  definition_version text not null,
  name_fi text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  primary key (content_release_id, exercise_code, definition_version)
);

comment on table public.training_content_releases is
  'Muuttumattomien harjoitussisältöjulkaisujen rekisteri ja kanoninen SHA-256-tiiviste.';
comment on table public.exercise_definitions is
  'Julkaisukohtaiset harjoitemäärittelyt. Samasta harjoitekoodista voi säilyä useita versioita.';

create or replace function public.reject_immutable_training_content_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'published training content is immutable' using errcode = '23000';
end;
$$;

create trigger reject_training_content_release_update
before update or delete on public.training_content_releases
for each row execute function public.reject_immutable_training_content_mutation();

create trigger reject_exercise_definition_update
before update or delete on public.exercise_definitions
for each row execute function public.reject_immutable_training_content_mutation();

alter table public.training_content_releases enable row level security;
alter table public.training_content_releases force row level security;
create policy training_content_releases_authenticated_read
on public.training_content_releases for select to authenticated using (true);

alter table public.exercise_definitions enable row level security;
alter table public.exercise_definitions force row level security;
create policy exercise_definitions_authenticated_read
on public.exercise_definitions for select to authenticated using (true);

revoke all on public.training_content_releases from anon;
revoke all on public.exercise_definitions from anon;
grant select on public.training_content_releases to authenticated;
grant select on public.exercise_definitions to authenticated;
