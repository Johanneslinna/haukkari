begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

drop index public.plan_versions_weekly_materialization_unique;
drop index public.training_plans_one_active_per_user;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated', 'authenticated', 'migration-conflict@example.invalid',
  extensions.crypt('TestPassword123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.goal_profiles (id, user_id, primary_goal)
values (
  '55555555-0000-4000-8000-000000000001',
  '55555555-5555-4555-8555-555555555555',
  'MAX_STRENGTH'
);

insert into public.goal_periods (id, user_id, goal_profile_id, starts_on, status)
values (
  '55555555-0000-4000-8000-000000000002',
  '55555555-5555-4555-8555-555555555555',
  '55555555-0000-4000-8000-000000000001',
  '2026-08-01', 'ACTIVE'
);

insert into public.plan_versions (
  id, user_id, goal_period_id, version_number, effective_from, change_reason, snapshot
) values
  (
    '55555555-0000-4000-8000-000000000003',
    '55555555-5555-4555-8555-555555555555',
    '55555555-0000-4000-8000-000000000002',
    1, '2026-08-24', 'WEEKLY_MATERIALIZATION',
    '{"marker":"first","materialization":{"idempotencyKey":"weekly:duplicate"}}'
  ),
  (
    '55555555-0000-4000-8000-000000000004',
    '55555555-5555-4555-8555-555555555555',
    '55555555-0000-4000-8000-000000000002',
    2, '2026-08-24', 'WEEKLY_MATERIALIZATION',
    '{"marker":"second","materialization":{"idempotencyKey":"weekly:duplicate"}}'
  );

select throws_ok(
  $$select public.assert_weekly_materialization_preconditions()$$,
  'P0001',
  'WEEKLY_MATERIALIZATION_PRECONDITION_DUPLICATE_IDEMPOTENCY_KEY conflict_groups=1',
  'migraatio keskeytyy vakaasti duplikaatti-idempotenssiavaimeen'
);

select is(
  (
    select count(*)::integer
    from public.plan_versions
    where user_id = '55555555-5555-4555-8555-555555555555'
      and snapshot #>> '{materialization,idempotencyKey}' = 'weekly:duplicate'
  ),
  2,
  'duplikaattitarkistus ei poista eikä yhdistä rivejä'
);

select is(
  (
    select string_agg(snapshot ->> 'marker', ',' order by snapshot ->> 'marker')
    from public.plan_versions
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  'first,second',
  'duplikaattitarkistus ei kirjoita vanhoja snapshotteja uudelleen'
);

delete from public.plan_versions
where id = '55555555-0000-4000-8000-000000000004';

insert into public.plan_versions (
  id, user_id, goal_period_id, version_number, effective_from, change_reason, snapshot
) values (
  '55555555-0000-4000-8000-000000000005',
  '55555555-5555-4555-8555-555555555555',
  '55555555-0000-4000-8000-000000000002',
  2, '2026-08-31', 'WEEKLY_MATERIALIZATION',
  '{"marker":"newer","materialization":{"idempotencyKey":"weekly:newer"}}'
);

insert into public.training_plans (
  id, user_id, plan_version_id, week_count, status, plan
) values
  (
    '55555555-0000-4000-8000-000000000006',
    '55555555-5555-4555-8555-555555555555',
    '55555555-0000-4000-8000-000000000003',
    1, 'ACTIVE', '{"marker":"old"}'
  ),
  (
    '55555555-0000-4000-8000-000000000007',
    '55555555-5555-4555-8555-555555555555',
    '55555555-0000-4000-8000-000000000005',
    1, 'ACTIVE', '{"marker":"new"}'
  );

select throws_ok(
  $$select public.assert_weekly_materialization_preconditions()$$,
  'P0001',
  'WEEKLY_MATERIALIZATION_PRECONDITION_MULTIPLE_ACTIVE_PLANS conflict_users=1',
  'migraatio keskeytyy vakaasti useaan vanhaan aktiiviseen suunnitelmaan'
);

select is(
  (
    select count(*)::integer
    from public.training_plans
    where user_id = '55555555-5555-4555-8555-555555555555'
      and status = 'ACTIVE'
  ),
  2,
  'aktiivisuustarkistus ei arvaa kanonista riviä eikä arkistoi mitään'
);

select is(
  (
    select string_agg(plan ->> 'marker', ',' order by plan ->> 'marker')
    from public.training_plans
    where user_id = '55555555-5555-4555-8555-555555555555'
  ),
  'new,old',
  'aktiivisuustarkistus ei muuta ristiriitaisten rivien sisältöä'
);

select * from finish();
rollback;
