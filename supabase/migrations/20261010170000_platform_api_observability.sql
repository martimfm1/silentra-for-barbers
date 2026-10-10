create table if not exists public.platform_api_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  route text not null,
  method text not null,
  status_code integer not null check (status_code between 100 and 599),
  duration_ms integer not null check (duration_ms >= 0),
  level text not null check (level in ('info', 'warn', 'error')),
  error_code text,
  environment text not null default 'production',
  region text,
  created_at timestamptz not null default now()
);

comment on table public.platform_api_logs is
  'Private HTTP request telemetry for the Silentra Admin API health dashboard. Never store request bodies or personal data.';

create index if not exists platform_api_logs_created_at_idx
  on public.platform_api_logs (created_at desc);
create index if not exists platform_api_logs_route_created_at_idx
  on public.platform_api_logs (route, created_at desc);
create index if not exists platform_api_logs_status_created_at_idx
  on public.platform_api_logs (status_code, created_at desc);

alter table public.platform_api_logs enable row level security;
revoke all on table public.platform_api_logs from anon, authenticated;
grant select, insert on table public.platform_api_logs to service_role;
