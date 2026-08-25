create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table public.push_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  schedule_key text not null,
  created_at timestamptz not null default now(),
  unique (reminder_id, subscription_id, schedule_key)
);

alter table public.push_delivery_receipts enable row level security;
alter table public.push_delivery_receipts force row level security;
revoke all on public.push_delivery_receipts from anon, authenticated;

create or replace function public.dispatch_push_reminders()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'push_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 10000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_push_reminders() from public, anon, authenticated;

select cron.schedule(
  'treenikompassi-send-reminders',
  '* * * * *',
  'select public.dispatch_push_reminders()'
);

