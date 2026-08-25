alter table public.push_subscriptions
drop constraint if exists push_subscriptions_user_id_endpoint_key;

create unique index push_subscriptions_active_endpoint_key
on public.push_subscriptions (user_id, endpoint)
where deleted_at is null;

