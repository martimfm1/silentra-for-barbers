-- Persist business closing summaries for dashboard popups and report history.
-- A report is an immutable snapshot for one tenant and one closed period.
create table if not exists public.barbershop_period_reports (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  period_type text not null check (period_type in ('day', 'week', 'month')),
  period_start date not null,
  period_end date not null,
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint barbershop_period_reports_valid_period
    check (period_end >= period_start),
  constraint barbershop_period_reports_unique_period
    unique (barbershop_id, period_type, period_start)
);

create index if not exists barbershop_period_reports_tenant_period_idx
  on public.barbershop_period_reports (barbershop_id, period_start desc);

alter table public.barbershop_period_reports enable row level security;

-- Access is mediated by tenant-authorized server routes with the service role.
-- Browser roles have no direct privileges on these financial snapshots.
revoke all on public.barbershop_period_reports from anon, authenticated;
grant all on public.barbershop_period_reports to service_role;
