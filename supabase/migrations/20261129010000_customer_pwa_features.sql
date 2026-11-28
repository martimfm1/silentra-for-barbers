begin;

create table if not exists public.customer_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_notification_subscriptions_email_endpoint_uidx
  on public.customer_notification_subscriptions (email, endpoint);
create index if not exists customer_notification_subscriptions_email_updated_idx
  on public.customer_notification_subscriptions (email, updated_at desc);

create table if not exists public.customer_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  token_hash text not null unique,
  version integer not null default 1 check (version >= 1),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_notification_subscriptions enable row level security;
alter table public.customer_calendar_feeds enable row level security;

revoke all on table public.customer_notification_subscriptions from public, anon, authenticated;
revoke all on table public.customer_calendar_feeds from public, anon, authenticated;
grant all on table public.customer_notification_subscriptions to service_role;
grant all on table public.customer_calendar_feeds to service_role;

comment on table public.customer_notification_subscriptions is
  'Opt-in Web Push subscriptions for email-verified customer booking portal sessions.';
comment on table public.customer_calendar_feeds is
  'Revocable, read-only iCalendar feed credentials for email-verified customers.';

commit;
