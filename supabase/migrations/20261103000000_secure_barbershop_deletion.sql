begin;

-- A barbershop can be removed without deleting a user's Silentra account.
-- Users may also be customers of other barbershops, so detach their profile.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and confrelid = 'public.barbershops'::regclass
      and contype = 'f'
  loop
    execute format('alter table public.users drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.users
  add constraint users_barbershop_id_fkey
  foreign key (barbershop_id)
  references public.barbershops(id)
  on delete set null;

create table if not exists public.barbershop_deletion_verifications (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists barbershop_deletion_verifications_lookup_idx
  on public.barbershop_deletion_verifications(barbershop_id, user_id, created_at desc)
  where consumed_at is null;

alter table public.barbershop_deletion_verifications enable row level security;
revoke all on table public.barbershop_deletion_verifications from public, anon, authenticated;
grant all on table public.barbershop_deletion_verifications to service_role;

create or replace function public.verify_barbershop_deletion_code(
  p_barbershop_id uuid,
  p_actor_user_id uuid,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_verification public.barbershop_deletion_verifications;
begin
  select created_by into v_created_by
  from public.barbershops
  where id = p_barbershop_id;

  if not found or v_created_by is distinct from p_actor_user_id then
    return 'BARBERSHOP_ACCESS_DENIED';
  end if;

  select * into v_verification
  from public.barbershop_deletion_verifications
  where barbershop_id = p_barbershop_id
    and user_id = p_actor_user_id
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found or v_verification.expires_at <= now() then
    return 'CODE_INVALID_OR_EXPIRED';
  end if;

  if v_verification.attempts >= 5 then
    return 'CODE_LOCKED';
  end if;

  if v_verification.code_hash <> p_code_hash then
    update public.barbershop_deletion_verifications
    set attempts = least(attempts + 1, 5)
    where id = v_verification.id;
    return case when v_verification.attempts + 1 >= 5
      then 'CODE_LOCKED'
      else 'CODE_INVALID'
    end;
  end if;

  return 'OK';
end;
$$;

create or replace function public.delete_barbershop_after_verification(
  p_barbershop_id uuid,
  p_actor_user_id uuid,
  p_code_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verification public.barbershop_deletion_verifications;
  v_result text;
begin
  v_result := public.verify_barbershop_deletion_code(
    p_barbershop_id, p_actor_user_id, p_code_hash
  );

  if v_result <> 'OK' then
    return v_result;
  end if;

  select * into v_verification
  from public.barbershop_deletion_verifications
  where barbershop_id = p_barbershop_id
    and user_id = p_actor_user_id
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return 'CODE_INVALID_OR_EXPIRED';
  end if;

  update public.barbershop_deletion_verifications
  set consumed_at = now()
  where id = v_verification.id;

  -- These documents have a RESTRICT relationship to the tenant and must be
  -- removed explicitly before the tenant's cascading delete.
  delete from public.billing_documents
  where barbershop_id = p_barbershop_id;

  delete from public.subscriptions
  where barbershop_id = p_barbershop_id;

  -- Preserve Silentra accounts (including customers shared across tenants).
  update public.users
  set barbershop_id = null
  where barbershop_id = p_barbershop_id;

  delete from public.audit_logs
  where metadata ->> 'barbershop_id' = p_barbershop_id::text;

  delete from public.barbershops
  where id = p_barbershop_id
    and created_by = p_actor_user_id;

  if not found then
    raise exception 'BARBERSHOP_DELETE_FAILED';
  end if;

  return 'DELETED';
end;
$$;

revoke all on function public.verify_barbershop_deletion_code(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.delete_barbershop_after_verification(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_barbershop_deletion_code(uuid, uuid, text) to service_role;
grant execute on function public.delete_barbershop_after_verification(uuid, uuid, text) to service_role;

commit;
