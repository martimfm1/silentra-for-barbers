-- Restore tenant-scoped internal notes for the standard clients database.
-- Notes are readable/writable only by authenticated staff of the owning barbershop.

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_notes_tenant_client_created_idx
  on public.client_notes (barbershop_id, client_id, created_at desc);

alter table public.client_notes enable row level security;

revoke all on table public.client_notes from anon, authenticated;
grant select, insert on table public.client_notes to authenticated;
grant all on table public.client_notes to service_role;

drop policy if exists client_notes_staff_select on public.client_notes;
drop policy if exists client_notes_staff_insert on public.client_notes;
drop policy if exists client_notes_staff_update on public.client_notes;
drop policy if exists client_notes_staff_delete on public.client_notes;
drop policy if exists client_notes_tenant_select on public.client_notes;
drop policy if exists client_notes_tenant_insert on public.client_notes;

create policy client_notes_tenant_select
on public.client_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_notes.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
);

create policy client_notes_tenant_insert
on public.client_notes
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.users actor
    where actor.id = (select auth.uid())
      and actor.barbershop_id = client_notes.barbershop_id
      and coalesce(lower(actor.role), 'barber') in (
        'owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'
      )
  )
  and exists (
    select 1
    from public.users client
    where client.id = client_notes.client_id
      and client.barbershop_id = client_notes.barbershop_id
      and client.role = 'client'
  )
);
