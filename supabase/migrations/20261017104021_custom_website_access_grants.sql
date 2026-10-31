-- Website service access for Free/Pro customers who have purchased the custom-site service.
-- Enterprise access is included at the Enterprise rate; this table records explicit grants for other plans.
create table if not exists public.custom_website_access_grants (
  barbershop_id uuid primary key references public.barbershops(id) on delete cascade,
  granted_by_user_id uuid not null references auth.users(id),
  plan_at_grant text not null check (plan_at_grant in ('free', 'pro')),
  setup_fee_eur numeric(8,2) not null default 150.00 check (setup_fee_eur >= 0),
  monthly_fee_eur numeric(8,2) not null check (monthly_fee_eur >= 0),
  reason text not null check (length(trim(reason)) between 3 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_website_access_grants_active_idx
  on public.custom_website_access_grants (active, created_at desc);

alter table public.custom_website_access_grants enable row level security;
revoke all on public.custom_website_access_grants from anon, authenticated;
grant all on public.custom_website_access_grants to service_role;

create or replace function public.set_custom_website_access_grant_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists custom_website_access_grants_updated_at on public.custom_website_access_grants;
create trigger custom_website_access_grants_updated_at
before update on public.custom_website_access_grants
for each row execute function public.set_custom_website_access_grant_updated_at();
