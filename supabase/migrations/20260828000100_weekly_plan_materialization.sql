create or replace function public.assert_weekly_materialization_preconditions()
returns void
language plpgsql
set search_path = ''
as $$
declare
  duplicate_idempotency_groups bigint;
  multiple_active_users bigint;
begin
  select count(*)
  into duplicate_idempotency_groups
  from (
    select
      user_id,
      snapshot #>> '{materialization,idempotencyKey}' as idempotency_key
    from public.plan_versions
    where deleted_at is null
      and change_reason = 'WEEKLY_MATERIALIZATION'
      and nullif(btrim(snapshot #>> '{materialization,idempotencyKey}'), '') is not null
    group by user_id, snapshot #>> '{materialization,idempotencyKey}'
    having count(*) > 1
  ) conflicts;

  if duplicate_idempotency_groups > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'WEEKLY_MATERIALIZATION_PRECONDITION_DUPLICATE_IDEMPOTENCY_KEY conflict_groups=%s',
        duplicate_idempotency_groups
      );
  end if;

  select count(*)
  into multiple_active_users
  from (
    select user_id
    from public.training_plans
    where deleted_at is null and status = 'ACTIVE'
    group by user_id
    having count(*) > 1
  ) conflicts;

  if multiple_active_users > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        'WEEKLY_MATERIALIZATION_PRECONDITION_MULTIPLE_ACTIVE_PLANS conflict_users=%s',
        multiple_active_users
      );
  end if;
end;
$$;

revoke all on function public.assert_weekly_materialization_preconditions() from public;
revoke all on function public.assert_weekly_materialization_preconditions() from anon;
revoke all on function public.assert_weekly_materialization_preconditions() from authenticated;

select public.assert_weekly_materialization_preconditions();

create unique index plan_versions_weekly_materialization_unique
  on public.plan_versions (
    user_id,
    (snapshot #>> '{materialization,idempotencyKey}')
  )
  where deleted_at is null
    and change_reason = 'WEEKLY_MATERIALIZATION'
    and nullif(btrim(snapshot #>> '{materialization,idempotencyKey}'), '') is not null;

comment on index public.plan_versions_weekly_materialization_unique is
  'Yksi viikkomaterialisointi käyttäjän ja versionoidun, ei-tyhjän idempotenssiavaimen yhdistelmälle.';

create unique index training_plans_one_active_per_user
  on public.training_plans (user_id)
  where deleted_at is null and status = 'ACTIVE';

comment on index public.training_plans_one_active_per_user is
  'Yhdellä käyttäjällä voi olla enintään yksi poistamaton aktiivinen harjoitussuunnitelma.';

create or replace function public.materialize_weekly_training_plan(
  p_goal_period_id uuid,
  p_plan_version_id uuid,
  p_training_plan_id uuid,
  p_week_anchor_date date,
  p_calendar_policy_version text,
  p_strength_week_policy_version text,
  p_idempotency_key text,
  p_plan jsonb,
  p_snapshot jsonb
)
returns table (
  reason_code text,
  plan_version jsonb,
  training_plan jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
  expected_idempotency_key text;
  existing_plan_version_id uuid;
  existing_training_plan_id uuid;
  active_effective_from date;
  previous_plan_version_id uuid;
  next_version_number integer;
  created_plan_status text;
  canonical_snapshot jsonb;
begin
  if request_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_AUTH_REQUIRED';
  end if;

  if p_plan_version_id is null or p_training_plan_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_IDENTIFIERS_REQUIRED';
  end if;

  if jsonb_typeof(p_plan) <> 'object'
    or jsonb_typeof(p_snapshot) <> 'object'
    or jsonb_typeof(p_snapshot -> 'materialization') <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_PAYLOAD_INVALID';
  end if;

  if nullif(btrim(p_calendar_policy_version), '') is null
    or nullif(btrim(p_strength_week_policy_version), '') is null then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_POLICY_VERSION_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.goal_periods gp
    where gp.id = p_goal_period_id
      and gp.user_id = request_user_id
      and gp.deleted_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_GOAL_PERIOD_NOT_OWNED';
  end if;

  expected_idempotency_key := concat_ws(
    ':',
    'weekly',
    p_goal_period_id::text,
    p_week_anchor_date::text,
    p_calendar_policy_version,
    p_strength_week_policy_version
  );
  if p_idempotency_key is distinct from expected_idempotency_key then
    raise exception using
      errcode = 'P0001',
      message = 'WEEKLY_MATERIALIZATION_IDEMPOTENCY_KEY_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(request_user_id::text, 0)
  );

  select pv.id
  into existing_plan_version_id
  from public.plan_versions pv
  where pv.user_id = request_user_id
    and pv.goal_period_id = p_goal_period_id
    and pv.deleted_at is null
    and pv.change_reason = 'WEEKLY_MATERIALIZATION'
    and (
      pv.snapshot #>> '{materialization,idempotencyKey}' = p_idempotency_key
      or (
        pv.snapshot #>> '{materialization,weekAnchorDate}' = p_week_anchor_date::text
        and pv.snapshot #>> '{materialization,calendarPolicyVersion}' = p_calendar_policy_version
        and pv.snapshot #>> '{materialization,strengthWeekPolicyVersion}' = p_strength_week_policy_version
      )
    )
  order by pv.created_at, pv.id
  limit 1
  for update;

  if existing_plan_version_id is not null then
    select tp.id
    into existing_training_plan_id
    from public.training_plans tp
    where tp.user_id = request_user_id
      and tp.plan_version_id = existing_plan_version_id
      and tp.deleted_at is null
    order by tp.created_at, tp.id
    limit 1
    for update;

    if existing_training_plan_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'WEEKLY_MATERIALIZATION_CANONICAL_PLAN_INCOMPLETE';
    end if;

    return query
    select
      'EXISTING_CANONICAL_WEEK_RETURNED'::text,
      to_jsonb(pv),
      to_jsonb(tp)
    from public.plan_versions pv
    join public.training_plans tp
      on tp.id = existing_training_plan_id
      and tp.user_id = request_user_id
    where pv.id = existing_plan_version_id
      and pv.user_id = request_user_id;
    return;
  end if;

  select pv.effective_from
  into active_effective_from
  from public.training_plans tp
  join public.plan_versions pv
    on pv.id = tp.plan_version_id and pv.user_id = tp.user_id
  where tp.user_id = request_user_id
    and tp.deleted_at is null
    and tp.status = 'ACTIVE'
  order by pv.effective_from desc, tp.created_at desc, tp.id desc
  limit 1
  for update of tp;

  select pv.id
  into previous_plan_version_id
  from public.plan_versions pv
  where pv.user_id = request_user_id
    and pv.goal_period_id = p_goal_period_id
    and pv.deleted_at is null
    and pv.effective_from < p_week_anchor_date
  order by pv.effective_from desc, pv.version_number desc, pv.id desc
  limit 1;

  select coalesce(max(pv.version_number), 0) + 1
  into next_version_number
  from public.plan_versions pv
  where pv.user_id = request_user_id
    and pv.goal_period_id = p_goal_period_id;

  canonical_snapshot := p_snapshot || jsonb_build_object(
    'plan', p_plan,
    'materialization',
      (p_snapshot -> 'materialization') || jsonb_build_object(
        'idempotencyKey', p_idempotency_key,
        'trainingPlanId', p_training_plan_id,
        'weekAnchorDate', p_week_anchor_date::text,
        'calendarPolicyVersion', p_calendar_policy_version,
        'strengthWeekPolicyVersion', p_strength_week_policy_version
      )
  );

  insert into public.plan_versions (
    id,
    user_id,
    goal_period_id,
    previous_plan_version_id,
    version_number,
    effective_from,
    change_reason,
    snapshot
  ) values (
    p_plan_version_id,
    request_user_id,
    p_goal_period_id,
    previous_plan_version_id,
    next_version_number,
    p_week_anchor_date,
    'WEEKLY_MATERIALIZATION',
    canonical_snapshot
  );

  if active_effective_from is null or active_effective_from <= p_week_anchor_date then
    update public.training_plans
    set status = 'ARCHIVED'
    where user_id = request_user_id
      and deleted_at is null
      and status = 'ACTIVE';
    created_plan_status := 'ACTIVE';
  else
    created_plan_status := 'ARCHIVED';
  end if;

  insert into public.training_plans (
    id,
    user_id,
    plan_version_id,
    week_count,
    status,
    plan
  ) values (
    p_training_plan_id,
    request_user_id,
    p_plan_version_id,
    1,
    created_plan_status,
    p_plan
  );

  return query
  select
    case
      when created_plan_status = 'ACTIVE' then 'NEW_CANONICAL_WEEK_CREATED'
      else 'OLDER_WEEK_MATERIALIZED_ARCHIVED'
    end::text,
    to_jsonb(pv),
    to_jsonb(tp)
  from public.plan_versions pv
  join public.training_plans tp
    on tp.id = p_training_plan_id and tp.user_id = request_user_id
  where pv.id = p_plan_version_id
    and pv.user_id = request_user_id;
end;
$$;

revoke all on function public.materialize_weekly_training_plan(
  uuid, uuid, uuid, date, text, text, text, jsonb, jsonb
) from public;
revoke all on function public.materialize_weekly_training_plan(
  uuid, uuid, uuid, date, text, text, text, jsonb, jsonb
) from anon;
grant execute on function public.materialize_weekly_training_plan(
  uuid, uuid, uuid, date, text, text, text, jsonb, jsonb
) to authenticated;

comment on function public.materialize_weekly_training_plan(
  uuid, uuid, uuid, date, text, text, text, jsonb, jsonb
) is 'Materialisoi käyttäjän viikkosuunnitelman atomisesti. Ensimmäinen saman idempotenssiavaimen kirjoitus jää kanoniseksi.';
