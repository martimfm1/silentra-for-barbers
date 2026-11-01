-- Client-specific monthly plans and payment tracking.
-- A plan belongs to exactly one customer in one barbershop. Usage is derived from
-- completed appointments in the current billing cycle, avoiding duplicated counters.

create table if not exists public.client_plans (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  monthly_price numeric(10,2) not null check (monthly_price >= 0),
  included_appointments integer not null check (included_appointments between 1 and 100),
  service_ids uuid[] not null default '{}'::uuid[],
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, barbershop_id, client_id),
  check (cardinality(service_ids) <= 50)
);

create unique index if not exists client_plans_one_active_per_client_idx
  on public.client_plans (barbershop_id, client_id)
  where status = 'active';

create index if not exists client_plans_client_history_idx
  on public.client_plans (barbershop_id, client_id, created_at desc);

create table if not exists public.client_plan_payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  barbershop_id uuid not null,
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  payment_method text check (payment_method is null or payment_method in ('cash', 'mbway', 'transfer', 'card', 'other')),
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (plan_id, period_start),
  foreign key (plan_id, barbershop_id, client_id)
    references public.client_plans (id, barbershop_id, client_id)
    on delete cascade
);

create index if not exists client_plan_payments_client_history_idx
  on public.client_plan_payments (barbershop_id, client_id, period_start desc);

alter table public.client_plans enable row level security;
alter table public.client_plan_payments enable row level security;

revoke all on table public.client_plans from anon, authenticated;
revoke all on table public.client_plan_payments from anon, authenticated;
grant select, insert, update, delete on table public.client_plans to authenticated;
grant select, insert, update, delete on table public.client_plan_payments to authenticated;
grant all privileges on table public.client_plans to service_role;
grant all privileges on table public.client_plan_payments to service_role;

create policy client_plans_tenant_select
  on public.client_plans for select to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plans.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plans.client_id
      and client.barbershop_id = client_plans.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plans_tenant_insert
  on public.client_plans for insert to authenticated
  with check (
    barbershop_id = get_my_barbershop_id()::uuid
    and created_by = (select auth.uid())
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plans.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plans.client_id
      and client.barbershop_id = client_plans.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plans_tenant_update
  on public.client_plans for update to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plans.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plans.client_id
      and client.barbershop_id = client_plans.barbershop_id
      and client.role = 'client'
  )
  )
  with check (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plans.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plans.client_id
      and client.barbershop_id = client_plans.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plans_tenant_delete
  on public.client_plans for delete to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plans.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plans.client_id
      and client.barbershop_id = client_plans.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plan_payments_tenant_select
  on public.client_plan_payments for select to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plan_payments.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plan_payments.client_id
      and client.barbershop_id = client_plan_payments.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plan_payments_tenant_insert
  on public.client_plan_payments for insert to authenticated
  with check (
    barbershop_id = get_my_barbershop_id()::uuid
    and (created_by is null or created_by = (select auth.uid()))
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plan_payments.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plan_payments.client_id
      and client.barbershop_id = client_plan_payments.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plan_payments_tenant_update
  on public.client_plan_payments for update to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plan_payments.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plan_payments.client_id
      and client.barbershop_id = client_plan_payments.barbershop_id
      and client.role = 'client'
  )
  )
  with check (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plan_payments.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plan_payments.client_id
      and client.barbershop_id = client_plan_payments.barbershop_id
      and client.role = 'client'
  )
  );

create policy client_plan_payments_tenant_delete
  on public.client_plan_payments for delete to authenticated
  using (
    barbershop_id = get_my_barbershop_id()::uuid
    and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_plan_payments.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
    and exists (
    select 1
    from public.users client
    where client.id = client_plan_payments.client_id
      and client.barbershop_id = client_plan_payments.barbershop_id
      and client.role = 'client'
  )
  );
