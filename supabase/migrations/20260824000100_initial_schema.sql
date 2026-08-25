create extension if not exists pgcrypto with schema extensions;

create type public.goal_type as enum (
  'BODY_RECOMPOSITION',
  'FAT_LOSS',
  'MUSCLE_GAIN',
  'MAX_STRENGTH',
  'ENDURANCE',
  'SPEED_POWER',
  'GENERAL_FITNESS',
  'POSTURE_MOBILITY',
  'SPORT_PERFORMANCE'
);

create type public.readiness_state as enum (
  'GREEN',
  'YELLOW',
  'ORANGE_RECOVERY',
  'RED_STOP'
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_fi text not null,
  category text not null,
  equipment text[] not null default '{}',
  instructions_fi text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'fi-FI' check (locale = 'fi-FI'),
  timezone text not null default 'Europe/Helsinki',
  birth_date date,
  height_cm numeric(5,2) check (height_cm between 80 and 250),
  weight_kg numeric(6,2) check (weight_kg between 20 and 400),
  onboarding_completed boolean not null default false,
  sensitive_data_consent_at timestamptz,
  app_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1 check (version > 0)
);

create table public.health_screenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  screened_on date not null default current_date,
  status text not null check (status in ('CLEAR', 'NEEDS_REVIEW', 'HIGH_INTENSITY_BLOCKED')),
  answers jsonb not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.goal_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_goal public.goal_type not null,
  secondary_goals public.goal_type[] not null default '{}'
    check (cardinality(secondary_goals) <= 2),
  target_date date,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.goal_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_profile_id uuid not null,
  starts_on date not null,
  ends_on date,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_period_id uuid not null,
  previous_plan_version_id uuid,
  version_number integer not null check (version_number > 0),
  effective_from date not null,
  change_reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, goal_period_id, version_number)
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_version_id uuid not null,
  week_count integer not null check (week_count between 1 and 104),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  plan jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, plan_version_id)
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  workout_type text not null,
  template jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_plan_id uuid,
  workout_template_id uuid,
  scheduled_for timestamptz not null,
  title text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  intensity text not null check (intensity in ('EASY', 'MODERATE', 'HARD', 'RECOVERY')),
  status text not null default 'PLANNED' check (status in ('PLANNED', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
  variants jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid references public.exercises(id),
  ordinal integer not null check (ordinal > 0),
  prescription jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, workout_id, ordinal)
);

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  readiness public.readiness_state not null,
  answers jsonb not null,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, checkin_date)
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid,
  performed_at timestamptz not null,
  duration_minutes integer check (duration_minutes between 0 and 600),
  rpe numeric(3,1) check (rpe between 0 and 10),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.exercise_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_log_id uuid not null,
  workout_exercise_id uuid,
  ordinal integer not null check (ordinal > 0),
  repetitions integer check (repetitions >= 0),
  load_kg numeric(7,2) check (load_kg >= 0),
  rir numeric(3,1) check (rir between 0 and 10),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, workout_log_id, ordinal)
);

create table public.run_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_log_id uuid,
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  distance_m integer not null check (distance_m > 0),
  average_heart_rate integer check (average_heart_rate between 30 and 250),
  rpe numeric(3,1) check (rpe between 0 and 10),
  route_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, workout_log_id)
);

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  tracking_mode text not null check (tracking_mode in ('PORTIONS', 'CALORIES')),
  energy_kcal integer check (energy_kcal >= 0),
  protein_g numeric(7,2) check (protein_g >= 0),
  carbohydrate_g numeric(7,2) check (carbohydrate_g >= 0),
  fat_g numeric(7,2) check (fat_g >= 0),
  meals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6,2) check (weight_kg between 20 and 400),
  waist_cm numeric(6,2) check (waist_cm between 30 and 250),
  body_fat_percent numeric(5,2) check (body_fat_percent between 1 and 70),
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.sport_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_code text not null,
  subtype text,
  priority text not null default 'SUPPORT' check (priority in ('PRIMARY', 'SUPPORT')),
  experience_years numeric(4,1) check (experience_years >= 0),
  demand_profile jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.fixed_sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_profile_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  rpe numeric(3,1) check (rpe between 0 and 10),
  coach_defined boolean not null default false,
  session_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.competition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_profile_id uuid,
  name text not null,
  starts_at timestamptz not null,
  priority text not null check (priority in ('A', 'B', 'TRAINING')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.baseline_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tested_on date not null,
  test_type text not null,
  result jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.reassessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessed_on date not null,
  result jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  channel text not null default 'IN_APP' check (channel in ('IN_APP', 'PUSH', 'CALENDAR')),
  local_time time not null,
  timezone text not null,
  weekdays smallint[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, endpoint)
);

create table public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  display_name text not null,
  last_pulled_at timestamptz,
  last_pulled_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0),
  unique (user_id, device_key)
);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_table text not null,
  entity_id uuid not null,
  local_version integer not null,
  remote_version integer not null,
  local_snapshot jsonb not null,
  remote_snapshot jsonb not null,
  resolution jsonb,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

create table public.sync_operations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  base_version integer,
  payload jsonb not null,
  applied_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, version integer not null default 1 check (version > 0)
);

do $constraints$
declare
  table_name text;
  owned_tables constant text[] := array[
    'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
    'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
    'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
    'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
    'competition_events', 'baseline_tests', 'reassessments', 'reminders',
    'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
  ];
begin
  foreach table_name in array owned_tables loop
    execute format(
      'alter table public.%I add constraint %I unique (id, user_id)',
      table_name,
      table_name || '_id_user_id_key'
    );
  end loop;
end
$constraints$;

alter table public.goal_periods add constraint goal_periods_goal_profile_fk
  foreign key (goal_profile_id, user_id) references public.goal_profiles(id, user_id);
alter table public.plan_versions add constraint plan_versions_goal_period_fk
  foreign key (goal_period_id, user_id) references public.goal_periods(id, user_id);
alter table public.plan_versions add constraint plan_versions_previous_fk
  foreign key (previous_plan_version_id, user_id) references public.plan_versions(id, user_id);
alter table public.training_plans add constraint training_plans_version_fk
  foreign key (plan_version_id, user_id) references public.plan_versions(id, user_id);
alter table public.workouts add constraint workouts_plan_fk
  foreign key (training_plan_id, user_id) references public.training_plans(id, user_id);
alter table public.workouts add constraint workouts_template_fk
  foreign key (workout_template_id, user_id) references public.workout_templates(id, user_id);
alter table public.workout_exercises add constraint workout_exercises_workout_fk
  foreign key (workout_id, user_id) references public.workouts(id, user_id);
alter table public.workout_logs add constraint workout_logs_workout_fk
  foreign key (workout_id, user_id) references public.workouts(id, user_id);
alter table public.exercise_set_logs add constraint exercise_set_logs_log_fk
  foreign key (workout_log_id, user_id) references public.workout_logs(id, user_id);
alter table public.exercise_set_logs add constraint exercise_set_logs_exercise_fk
  foreign key (workout_exercise_id, user_id) references public.workout_exercises(id, user_id);
alter table public.run_logs add constraint run_logs_workout_log_fk
  foreign key (workout_log_id, user_id) references public.workout_logs(id, user_id);
alter table public.fixed_sport_sessions add constraint fixed_sessions_profile_fk
  foreign key (sport_profile_id, user_id) references public.sport_profiles(id, user_id);
alter table public.competition_events add constraint competitions_profile_fk
  foreign key (sport_profile_id, user_id) references public.sport_profiles(id, user_id);
alter table public.sync_operations add constraint sync_operations_device_fk
  foreign key (device_id, user_id) references public.sync_devices(id, user_id);

create or replace function public.protect_user_owned_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  if new.version is distinct from old.version then
    raise exception 'version must match the stored version' using errcode = '40001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_exercise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger exercises_touch before update on public.exercises
for each row execute function public.touch_exercise();

do $triggers$
declare
  table_name text;
  owned_tables constant text[] := array[
    'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
    'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
    'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
    'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
    'competition_events', 'baseline_tests', 'reassessments', 'reminders',
    'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
  ];
begin
  foreach table_name in array owned_tables loop
    execute format(
      'create trigger protect_owned_row before update on public.%I '
      'for each row execute function public.protect_user_owned_row()',
      table_name
    );
  end loop;
end
$triggers$;

create or replace function public.reject_plan_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['updated_at', 'deleted_at', 'version'])
     is distinct from
     (to_jsonb(old) - array['updated_at', 'deleted_at', 'version']) then
    raise exception 'plan versions are immutable' using errcode = '23000';
  end if;
  return new;
end;
$$;

create trigger reject_plan_version_mutation
before update on public.plan_versions
for each row execute function public.reject_plan_version_mutation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $indexes$
declare
  table_name text;
  owned_tables constant text[] := array[
    'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
    'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
    'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
    'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
    'competition_events', 'baseline_tests', 'reassessments', 'reminders',
    'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
  ];
begin
  foreach table_name in array owned_tables loop
    execute format('create index %I on public.%I (user_id)', table_name || '_user_idx', table_name);
    execute format(
      'create index %I on public.%I (user_id, updated_at, id)',
      table_name || '_sync_cursor_idx', table_name
    );
    execute format(
      'create index %I on public.%I (user_id, deleted_at) where deleted_at is not null',
      table_name || '_deleted_idx', table_name
    );
  end loop;
end
$indexes$;

create index workouts_scheduled_idx on public.workouts (user_id, scheduled_for);
create index workout_logs_performed_idx on public.workout_logs (user_id, performed_at);
create index run_logs_started_idx on public.run_logs (user_id, started_at);
create index nutrition_logs_logged_idx on public.nutrition_logs (user_id, logged_at);
create index body_metrics_date_idx on public.body_metrics (user_id, measured_on);
create index competitions_starts_idx on public.competition_events (user_id, starts_at);
create index fixed_sessions_starts_idx on public.fixed_sport_sessions (user_id, starts_at);

alter table public.exercises enable row level security;
alter table public.exercises force row level security;
create policy exercises_authenticated_read on public.exercises
for select to authenticated using (true);

do $rls$
declare
  table_name text;
  owned_tables constant text[] := array[
    'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
    'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
    'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
    'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
    'competition_events', 'baseline_tests', 'reassessments', 'reminders',
    'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
  ];
begin
  foreach table_name in array owned_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
      table_name || '_delete_own', table_name
    );
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$rls$;

revoke all on public.exercises from anon;
grant select on public.exercises to authenticated;
revoke execute on function public.protect_user_owned_row() from public, anon, authenticated;
revoke execute on function public.touch_exercise() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false;

create policy progress_photos_select_own on storage.objects
for select to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy progress_photos_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy progress_photos_update_own on storage.objects
for update to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy progress_photos_delete_own on storage.objects
for delete to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
