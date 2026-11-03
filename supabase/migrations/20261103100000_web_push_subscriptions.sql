begin;

delete from public.notification_subscriptions where user_id is null;

with ranked as (
  select id, row_number() over (
    partition by endpoint
    order by updated_at desc nulls last, created_at desc nulls last, id desc
  ) as position
  from public.notification_subscriptions
)
delete from public.notification_subscriptions subscriptions
using ranked
where subscriptions.id = ranked.id and ranked.position > 1;

alter table public.notification_subscriptions alter column user_id set not null;
create unique index if not exists notification_subscriptions_endpoint_uidx
  on public.notification_subscriptions (endpoint);
create index if not exists notification_subscriptions_user_updated_idx
  on public.notification_subscriptions (user_id, updated_at desc);

alter table public.notification_subscriptions enable row level security;
revoke all on table public.notification_subscriptions from public, anon, authenticated;
grant all on table public.notification_subscriptions to service_role;

commit;
