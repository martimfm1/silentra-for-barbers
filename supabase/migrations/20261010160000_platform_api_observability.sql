-- Private operational request history for the Silentra platform admin.
-- Do not store request bodies, cookies, auth headers, IP addresses, or PII here.
create table if not exists public.platform_api_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  request_id uuid not null,
  method text not null,
  route text not null,
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  level text not null check (level in ('info', 'warn', 'error')),
  error_code text,
  message text not null
);

create index if not exists platform_api_logs_occurred_at_idx
  on public.platform_api_logs (occurred_at desc);

create index if not exists platform_api_logs_route_occurred_at_idx
  on public.platform_api_logs (route, occurred_at desc);

create index if not exists platform_api_logs_level_occurred_at_idx
  on public.platform_api_logs (level, occurred_at desc);

create index if not exists platform_api_logs_status_occurred_at_idx
  on public.platform_api_logs (status_code, occurred_at desc);

alter table public.platform_api_logs enable row level security;

revoke all on table public.platform_api_logs from public, anon, authenticated;
grant all on table public.platform_api_logs to service_role;
