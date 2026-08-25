begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(array[
        'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
        'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
        'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
        'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
        'competition_events', 'baseline_tests', 'reassessments', 'reminders',
        'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
      ])
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  25,
  'RLS ja FORCE RLS ovat käytössä kaikissa käyttäjätauluissa'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
        'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
        'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
        'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
        'competition_events', 'baseline_tests', 'reassessments', 'reminders',
        'push_subscriptions', 'sync_devices', 'sync_conflicts', 'sync_operations'
      ])
  ),
  100,
  'jokaisella käyttäjätaululla on neljä operaatiokohtaista käytäntöä'
);

select is(
  (select public from storage.buckets where id = 'progress-photos'),
  false,
  'kehityskuvien bucket ei ole julkinen'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'progress_photos_%_own'),
  4,
  'kehityskuvilla on neljä omistajakohtaista käytäntöä'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'a@example.invalid', extensions.crypt('TestPassword123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'b@example.invalid', extensions.crypt('TestPassword123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.workout_logs (id, user_id, performed_at, notes)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now(), 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', now(), 'B');

insert into public.goal_profiles (id, user_id, primary_goal)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'GENERAL_FITNESS'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'ENDURANCE');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'käyttäjä A näkee vain oman profiilinsa'
);

select is(
  (select user_id::text from public.profiles limit 1),
  '11111111-1111-4111-8111-111111111111',
  'käyttäjä A ei lue käyttäjän B profiilia suoralla kyselyllä'
);

select lives_ok(
  $$insert into public.body_metrics (user_id, measured_on, weight_kg) values ('11111111-1111-4111-8111-111111111111', current_date, 60)$$,
  'käyttäjä A voi luoda oman rivin'
);

select throws_ok(
  $$insert into public.body_metrics (user_id, measured_on, weight_kg) values ('22222222-2222-4222-8222-222222222222', current_date, 70)$$,
  '42501',
  'new row violates row-level security policy for table "body_metrics"',
  'käyttäjä A ei voi luoda riviä käyttäjälle B'
);

select lives_ok(
  $$update public.workout_logs set notes = 'murrettu' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'käyttäjän B suora päivitys ei paljasta riviä käyttäjälle A'
);

select lives_ok(
  $$delete from public.workout_logs where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'käyttäjän B suora poisto ei paljasta riviä käyttäjälle A'
);

select throws_ok(
  $$update public.workout_logs set user_id = '22222222-2222-4222-8222-222222222222' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  'user_id cannot be changed',
  'omistajuutta ei voi vaihtaa API-päivityksellä'
);

select throws_ok(
  $$insert into public.goal_periods (user_id, goal_profile_id, starts_on) values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000002', current_date)$$,
  '23503',
  'insert or update on table "goal_periods" violates foreign key constraint "goal_periods_goal_profile_fk"',
  'käyttäjä A ei voi viitata käyttäjän B tietueeseen'
);

reset role;

select is(
  (select notes from public.workout_logs where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'B',
  'käyttäjän B riviä ei päivitetty'
);

select is(
  (select count(*)::integer from public.workout_logs where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'käyttäjän B riviä ei poistettu'
);

select * from finish();
rollback;
