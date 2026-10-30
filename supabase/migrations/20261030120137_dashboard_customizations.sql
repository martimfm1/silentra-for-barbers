begin;

create table if not exists public.barbershop_dashboard_customizations (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'A minha dashboard',
  config jsonb not null default jsonb_build_object(
    'shortcuts', jsonb_build_array('new-booking', 'clients', 'services', 'team', 'analytics'),
    'sections', jsonb_build_object(
      'quickActions', true,
      'metrics', true,
      'nextAppointment', true,
      'activityChart', true,
      'upcomingAppointments', true
    ),
    'accentColor', '#34d399'
  ),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_customizations_name_length check (char_length(btrim(name)) between 1 and 48),
  constraint dashboard_customizations_config_object check (jsonb_typeof(config) = 'object')
);

create index if not exists barbershop_dashboard_customizations_owner_idx
  on public.barbershop_dashboard_customizations (barbershop_id, user_id, updated_at desc);

create unique index if not exists barbershop_dashboard_customizations_active_idx
  on public.barbershop_dashboard_customizations (barbershop_id, user_id)
  where is_active = true;

create unique index if not exists barbershop_dashboard_customizations_name_idx
  on public.barbershop_dashboard_customizations (barbershop_id, user_id, lower(name));

alter table public.barbershop_dashboard_customizations enable row level security;

drop policy if exists "Users read their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users read their dashboard customizations"
  on public.barbershop_dashboard_customizations
  for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
        and u.role not in ('client', 'customer')
    )
  );

drop policy if exists "Users create their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users create their dashboard customizations"
  on public.barbershop_dashboard_customizations
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
        and u.role not in ('client', 'customer')
    )
  );

drop policy if exists "Users update their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users update their dashboard customizations"
  on public.barbershop_dashboard_customizations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
        and u.role not in ('client', 'customer')
    )
  );

drop policy if exists "Users delete their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users delete their dashboard customizations"
  on public.barbershop_dashboard_customizations
  for delete to authenticated
  using (auth.uid() = user_id);

-- Supabase no longer exposes newly-created public tables to the Data API by default.
grant select, insert, update, delete on public.barbershop_dashboard_customizations to authenticated;
grant all on public.barbershop_dashboard_customizations to service_role;

insert into public.barbershop_dashboard_customizations (
  barbershop_id, user_id, name, config, is_active
)
select
  u.barbershop_id,
  u.id,
  'A minha dashboard',
  jsonb_build_object(
    'shortcuts', jsonb_build_array('new-booking', 'clients', 'services', 'team', 'analytics'),
    'sections', jsonb_build_object(
      'quickActions', true,
      'metrics', true,
      'nextAppointment', true,
      'activityChart', true,
      'upcomingAppointments', true
    ),
    'accentColor', '#34d399'
  ),
  true
from public.users u
where u.barbershop_id is not null
  and u.role not in ('client', 'customer')
on conflict (barbershop_id, user_id, (lower(name))) do nothing;

commit;
