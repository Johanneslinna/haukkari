begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

select has_index(
  'public',
  'plan_versions',
  'plan_versions_weekly_materialization_unique',
  'ei-tyhjällä viikkoavaimella on tietokannan yksikäsitteisyysraja'
);

select has_index(
  'public',
  'training_plans',
  'training_plans_one_active_per_user',
  'käyttäjällä voi olla enintään yksi aktiivinen suunnitelma'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'materialize_weekly_training_plan'
  ),
  1,
  'atominen viikkomaterialisointi-RPC on asennettu'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'weekly-a@example.invalid',
    extensions.crypt('TestPassword123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'weekly-b@example.invalid',
    extensions.crypt('TestPassword123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

insert into public.goal_profiles (id, user_id, primary_goal)
values
  (
    '33333333-0000-4000-8000-000000000001',
    '33333333-3333-4333-8333-333333333333',
    'MAX_STRENGTH'
  ),
  (
    '44444444-0000-4000-8000-000000000001',
    '44444444-4444-4444-8444-444444444444',
    'MAX_STRENGTH'
  );

insert into public.goal_periods (id, user_id, goal_profile_id, starts_on, status)
values
  (
    '33333333-0000-4000-8000-000000000002',
    '33333333-3333-4333-8333-333333333333',
    '33333333-0000-4000-8000-000000000001',
    '2026-08-01', 'ACTIVE'
  ),
  (
    '44444444-0000-4000-8000-000000000002',
    '44444444-4444-4444-8444-444444444444',
    '44444444-0000-4000-8000-000000000001',
    '2026-08-01', 'ACTIVE'
  );

insert into public.plan_versions (
  id, user_id, goal_period_id, version_number, effective_from, change_reason, snapshot
) values (
  '44444444-0000-4000-8000-000000000003',
  '44444444-4444-4444-8444-444444444444',
  '44444444-0000-4000-8000-000000000002',
  1, '2026-08-24', 'INITIAL', '{"legacy":true}'
);

insert into public.training_plans (
  id, user_id, plan_version_id, week_count, status, plan
) values (
  '44444444-0000-4000-8000-000000000004',
  '44444444-4444-4444-8444-444444444444',
  '44444444-0000-4000-8000-000000000003',
  1, 'ACTIVE', '{"owner":"B"}'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select reason_code
    from public.materialize_weekly_training_plan(
      '33333333-0000-4000-8000-000000000002',
      '33333333-0000-4000-8000-000000000003',
      '33333333-0000-4000-8000-000000000004',
      '2026-08-24',
      'local-calendar-1.0.0',
      'adult-strength-week-1.0.0',
      'weekly:33333333-0000-4000-8000-000000000002:2026-08-24:local-calendar-1.0.0:adult-strength-week-1.0.0',
      '{"writer":"first","sessions":[]}',
      '{"plan":{"writer":"first","sessions":[]},"materialization":{}}'
    )
  ),
  'NEW_CANONICAL_WEEK_CREATED',
  'ensimmäinen saman viikon kirjoitus luo kanonisen suunnitelman'
);

select is(
  (
    select reason_code
    from public.materialize_weekly_training_plan(
      '33333333-0000-4000-8000-000000000002',
      '33333333-0000-4000-8000-000000000005',
      '33333333-0000-4000-8000-000000000006',
      '2026-08-24',
      'local-calendar-1.0.0',
      'adult-strength-week-1.0.0',
      'weekly:33333333-0000-4000-8000-000000000002:2026-08-24:local-calendar-1.0.0:adult-strength-week-1.0.0',
      '{"writer":"second","sessions":[]}',
      '{"plan":{"writer":"second","sessions":[]},"materialization":{}}'
    )
  ),
  'EXISTING_CANONICAL_WEEK_RETURNED',
  'toinen saman viikon kirjoitus saa olemassa olevan kanonisen viikon'
);

select is(
  (
    select plan_version ->> 'id'
    from public.materialize_weekly_training_plan(
      '33333333-0000-4000-8000-000000000002',
      '33333333-0000-4000-8000-000000000005',
      '33333333-0000-4000-8000-000000000006',
      '2026-08-24',
      'local-calendar-1.0.0',
      'adult-strength-week-1.0.0',
      'weekly:33333333-0000-4000-8000-000000000002:2026-08-24:local-calendar-1.0.0:adult-strength-week-1.0.0',
      '{"writer":"second","sessions":[]}',
      '{"plan":{"writer":"second","sessions":[]},"materialization":{}}'
    )
  ),
  '33333333-0000-4000-8000-000000000003',
  'idempotentti uudelleenajo palauttaa alkuperäisen version tunnisteen'
);

select is(
  (
    select count(*)::integer
    from public.plan_versions
    where user_id = '33333333-3333-4333-8333-333333333333'
      and effective_from = '2026-08-24'
  ),
  1,
  'sama viikko tuottaa yhden version'
);

select is(
  (
    select count(*)::integer
    from public.training_plans
    where user_id = '33333333-3333-4333-8333-333333333333'
  ),
  1,
  'sama viikko tuottaa yhden suunnitelman'
);

select is(
  (
    select plan ->> 'writer'
    from public.training_plans
    where id = '33333333-0000-4000-8000-000000000004'
  ),
  'first',
  'ensimmäinen hyväksytty payload jää kanoniseksi'
);

select is(
  (
    select reason_code
    from public.materialize_weekly_training_plan(
      '33333333-0000-4000-8000-000000000002',
      '33333333-0000-4000-8000-000000000007',
      '33333333-0000-4000-8000-000000000008',
      '2026-08-31',
      'local-calendar-1.0.0',
      'adult-strength-week-1.0.0',
      'weekly:33333333-0000-4000-8000-000000000002:2026-08-31:local-calendar-1.0.0:adult-strength-week-1.0.0',
      '{"writer":"newer","sessions":[]}',
      '{"plan":{"writer":"newer","sessions":[]},"materialization":{}}'
    )
  ),
  'NEW_CANONICAL_WEEK_CREATED',
  'uudempi viikko luo uuden kanonisen suunnitelman'
);

select is(
  (
    select previous_plan_version_id::text
    from public.plan_versions
    where id = '33333333-0000-4000-8000-000000000007'
  ),
  '33333333-0000-4000-8000-000000000003',
  'uusi viikko käyttää uutta versiota ja viittaa vanhaan versioon'
);

select is(
  (
    select count(*)::integer
    from public.plan_versions
    where user_id = '33333333-3333-4333-8333-333333333333'
  ),
  2,
  'vanha ja uusi versio säilyvät'
);

select is(
  (select status from public.training_plans where id = '33333333-0000-4000-8000-000000000004'),
  'ARCHIVED',
  'uusi viikko arkistoi vanhan aktiivisen suunnitelman'
);

select is(
  (select status from public.training_plans where id = '33333333-0000-4000-8000-000000000008'),
  'ACTIVE',
  'uudempi viikko jää aktiiviseksi'
);

select is(
  (
    select count(*)::integer
    from public.training_plans
    where id = '33333333-0000-4000-8000-000000000004'
  ),
  1,
  'arkistoitu vanha viikko on edelleen luettavissa'
);

select is(
  (
    select reason_code
    from public.materialize_weekly_training_plan(
      '33333333-0000-4000-8000-000000000002',
      '33333333-0000-4000-8000-000000000009',
      '33333333-0000-4000-8000-000000000010',
      '2026-08-24',
      'local-calendar-1.0.0',
      'adult-strength-week-1.0.1',
      'weekly:33333333-0000-4000-8000-000000000002:2026-08-24:local-calendar-1.0.0:adult-strength-week-1.0.1',
      '{"writer":"older-late","sessions":[]}',
      '{"plan":{"writer":"older-late","sessions":[]},"materialization":{}}'
    )
  ),
  'OLDER_WEEK_MATERIALIZED_ARCHIVED',
  'myöhemmin saapuva vanhempi viikko luodaan arkistoiduksi'
);

select is(
  (select status from public.training_plans where id = '33333333-0000-4000-8000-000000000008'),
  'ACTIVE',
  'vanhemman viikon pyyntö ei syrjäytä uudempaa aktiivista viikkoa'
);

select is(
  (
    select count(*)::integer
    from public.training_plans
    where user_id = '33333333-3333-4333-8333-333333333333'
      and deleted_at is null
      and status = 'ACTIVE'
  ),
  1,
  'kummassakin viikkojärjestyksessä käyttäjällä on yksi aktiivinen suunnitelma'
);

select throws_ok(
  $$select * from public.materialize_weekly_training_plan(
    '33333333-0000-4000-8000-000000000002',
    '33333333-0000-4000-8000-000000000011',
    '33333333-0000-4000-8000-000000000008',
    '2026-09-07',
    'local-calendar-1.0.0',
    'adult-strength-week-1.0.0',
    'weekly:33333333-0000-4000-8000-000000000002:2026-09-07:local-calendar-1.0.0:adult-strength-week-1.0.0',
    '{"writer":"must-fail","sessions":[]}',
    '{"plan":{"writer":"must-fail","sessions":[]},"materialization":{}}'
  )$$,
  '23505',
  'duplicate key value violates unique constraint "training_plans_pkey"',
  'kesken transaktion epäonnistuva uuden viikon luonti palautetaan kokonaan'
);

select is(
  (
    select count(*)::integer
    from public.plan_versions
    where id = '33333333-0000-4000-8000-000000000011'
  ),
  0,
  'epäonnistunut transaktio ei jätä osittaista plan_version-riviä'
);

select is(
  (select status from public.training_plans where id = '33333333-0000-4000-8000-000000000008'),
  'ACTIVE',
  'epäonnistunut uusi viikko säilyttää vanhan aktiivisen suunnitelman'
);

insert into public.plan_versions (
  id, user_id, goal_period_id, version_number, effective_from, change_reason, snapshot
) values (
  '33333333-0000-4000-8000-000000000012',
  '33333333-3333-4333-8333-333333333333',
  '33333333-0000-4000-8000-000000000002',
  4, '2026-09-14', 'ACTIVE_INDEX_REGRESSION', '{}'
);

select throws_ok(
  $$insert into public.training_plans (
    id, user_id, plan_version_id, week_count, status, plan
  ) values (
    '33333333-0000-4000-8000-000000000015',
    '33333333-3333-4333-8333-333333333333',
    '33333333-0000-4000-8000-000000000012',
    1, 'ACTIVE', '{}'
  )$$,
  '23505',
  'duplicate key value violates unique constraint "training_plans_one_active_per_user"',
  'tietokanta estää toisen aktiivisen suunnitelman myös RPC:n ulkopuolella'
);

select throws_ok(
  $$select * from public.materialize_weekly_training_plan(
    '44444444-0000-4000-8000-000000000002',
    '33333333-0000-4000-8000-000000000013',
    '33333333-0000-4000-8000-000000000014',
    '2026-08-31',
    'local-calendar-1.0.0',
    'adult-strength-week-1.0.0',
    'weekly:44444444-0000-4000-8000-000000000002:2026-08-31:local-calendar-1.0.0:adult-strength-week-1.0.0',
    '{"sessions":[]}',
    '{"plan":{"sessions":[]},"materialization":{}}'
  )$$,
  'P0001',
  'WEEKLY_MATERIALIZATION_GOAL_PERIOD_NOT_OWNED',
  'käyttäjä ei voi materialisoida toisen käyttäjän tavoitejaksoa'
);

select is(
  (
    select count(*)::integer
    from public.training_plans
    where user_id = '44444444-4444-4444-8444-444444444444'
  ),
  0,
  'RLS estää toisen käyttäjän suunnitelmien lukemisen'
);

select lives_ok(
  $$update public.training_plans
    set status = 'ARCHIVED'
    where user_id = '44444444-4444-4444-8444-444444444444'$$,
  'RLS piilottaa toisen käyttäjän rivin arkistointiyritykseltä'
);

reset role;

select is(
  (
    select status
    from public.training_plans
    where id = '44444444-0000-4000-8000-000000000004'
  ),
  'ACTIVE',
  'toisen käyttäjän aktiivinen suunnitelma ei muuttunut'
);

select * from finish();
rollback;
