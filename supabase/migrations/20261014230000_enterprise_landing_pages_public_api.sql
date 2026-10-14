begin;

create table if not exists public.barbershop_landing_pages (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null unique references public.barbershops(id) on delete cascade,
  status text not null default 'suspended'
    check (status in ('active', 'suspended')),
  template_version smallint not null default 1 check (template_version > 0),
  provisioned_at timestamptz not null default now(),
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists barbershop_landing_pages_status_idx
  on public.barbershop_landing_pages(status, updated_at desc);

alter table public.barbershop_landing_pages enable row level security;
revoke all on table public.barbershop_landing_pages from public, anon, authenticated;
grant all on table public.barbershop_landing_pages to service_role;

comment on table public.barbershop_landing_pages is
  'Server-managed Enterprise landing-page entitlements. Rendered from the barbershop public profile and service catalogue; clients cannot self-provision or publish pages.';
comment on column public.barbershop_landing_pages.status is
  'Active only while the effective Enterprise entitlement is active. Public handlers also re-check the resolved plan.';
comment on column public.barbershop_landing_pages.template_version is
  'Version of the managed landing-page template used for rendering.';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.sync_barbershop_landing_page_entitlement(
  p_barbershop_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_plan text := 'free';
begin
  if p_barbershop_id is null then
    return;
  end if;

  select a.plan::text
    into v_effective_plan
  from public.barbershop_plan_assignments as a
  where a.barbershop_id = p_barbershop_id
    and (a.expires_at is null or a.expires_at > pg_catalog.now())
  limit 1;

  if not found then
    select case
      when s.status in ('active', 'trialing')
       and (
         case
           when s.plan_override::text in ('pro', 'enterprise')
             then s.plan_override::text
           else s.plan::text
         end
       ) = 'enterprise'
      then 'enterprise'
      else 'free'
    end
      into v_effective_plan
    from public.subscriptions as s
    where s.barbershop_id = p_barbershop_id
    order by s.updated_at desc, s.created_at desc
    limit 1;

    if not found then
      v_effective_plan := 'free';
    end if;
  end if;

  if v_effective_plan = 'enterprise' then
    insert into public.barbershop_landing_pages (
      barbershop_id, status, template_version, suspended_reason,
      provisioned_at, created_at, updated_at
    )
    values (
      p_barbershop_id, 'active', 1, null,
      pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    )
    on conflict (barbershop_id) do update
      set status = 'active',
          suspended_reason = null,
          updated_at = pg_catalog.now();
  else
    update public.barbershop_landing_pages
       set status = 'suspended',
           suspended_reason = 'enterprise_entitlement_inactive',
           updated_at = pg_catalog.now()
     where barbershop_id = p_barbershop_id
       and (
         status <> 'suspended'
         or suspended_reason is distinct from 'enterprise_entitlement_inactive'
       );
  end if;
end;
$$;

create or replace function private.trg_sync_barbershop_landing_page_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_barbershop_landing_page_entitlement(old.barbershop_id);
    return old;
  end if;

  perform private.sync_barbershop_landing_page_entitlement(new.barbershop_id);

  if tg_op = 'UPDATE'
     and new.barbershop_id is distinct from old.barbershop_id then
    perform private.sync_barbershop_landing_page_entitlement(old.barbershop_id);
  end if;

  return new;
end;
$$;

create or replace function private.trg_sync_barbershop_landing_page_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_barbershop_landing_page_entitlement(old.barbershop_id);
    return old;
  end if;

  perform private.sync_barbershop_landing_page_entitlement(new.barbershop_id);

  if tg_op = 'UPDATE'
     and new.barbershop_id is distinct from old.barbershop_id then
    perform private.sync_barbershop_landing_page_entitlement(old.barbershop_id);
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_sync_landing_page_entitlement
  on public.subscriptions;
create trigger subscriptions_sync_landing_page_entitlement
  after insert or update or delete on public.subscriptions
  for each row
  execute function private.trg_sync_barbershop_landing_page_from_subscription();

drop trigger if exists barbershop_plan_assignments_sync_landing_page_entitlement
  on public.barbershop_plan_assignments;
create trigger barbershop_plan_assignments_sync_landing_page_entitlement
  after insert or update or delete on public.barbershop_plan_assignments
  for each row
  execute function private.trg_sync_barbershop_landing_page_from_assignment();

revoke all on function private.sync_barbershop_landing_page_entitlement(uuid)
  from public, anon, authenticated;
grant execute on function private.sync_barbershop_landing_page_entitlement(uuid)
  to service_role;
revoke all on function private.trg_sync_barbershop_landing_page_from_subscription()
  from public, anon, authenticated;
revoke all on function private.trg_sync_barbershop_landing_page_from_assignment()
  from public, anon, authenticated;

-- Existing Enterprise tenants receive the same benefit during the migration.
do $$
declare
  v_barbershop_id uuid;
begin
  for v_barbershop_id in select id from public.barbershops
  loop
    perform private.sync_barbershop_landing_page_entitlement(v_barbershop_id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
