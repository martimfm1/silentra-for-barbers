begin;

alter table public.barbershop_invite_codes
  add column if not exists invite_method text not null default 'code',
  add column if not exists revoked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.barbershop_invite_codes'::regclass
      and conname = 'barbershop_invite_codes_method_check'
  ) then
    alter table public.barbershop_invite_codes
      add constraint barbershop_invite_codes_method_check
      check (invite_method in ('code', 'link', 'qr'));
  end if;
end;
$$;

create index if not exists barbershop_invite_codes_pending_idx
  on public.barbershop_invite_codes (barbershop_id, created_at desc)
  where used_at is null and revoked_at is null;

create or replace function public.create_barbershop_invite_v2(
  p_method text default 'code',
  p_expires_in_hours integer default 168
)
returns table (
  invite_id uuid,
  invite_value text,
  expires_at timestamptz,
  role text,
  method text
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user uuid := auth.uid();
  v_barbershop_id uuid;
  v_value text;
  v_suffix text;
  v_hash text;
  v_invite_id uuid;
  v_expires timestamptz;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_random_byte integer;
  v_index integer;
  v_plan text := 'free';
  v_professional_limit integer := 1;
  v_professional_count integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_method is null or p_method not in ('code', 'link', 'qr') then
    raise exception 'invalid_invite_method' using errcode = '22023';
  end if;

  if p_expires_in_hours is null or p_expires_in_hours not in (24, 72, 168) then
    raise exception 'invalid_invite_expiry' using errcode = '22023';
  end if;

  select u.barbershop_id
    into v_barbershop_id
  from public.users as u
  where u.id = v_user
    and u.role in ('owner', 'admin');

  if v_barbershop_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select coalesce(
    public.get_effective_billing_plan_for_barbershop(v_barbershop_id),
    'free'
  )
  into v_plan;

  v_professional_limit := case v_plan
    when 'free' then 1
    when 'pro' then 5
    when 'enterprise' then 2147483647
    else 1
  end;

  select count(*)::integer
    into v_professional_count
  from public.professionals as professional
  where professional.barbershop_id = v_barbershop_id
    and professional.active = true;

  if v_professional_count >= v_professional_limit then
    raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
  end if;

  v_expires := now() + make_interval(hours => p_expires_in_hours);

  loop
    if p_method = 'code' then
      v_suffix := '';
      for v_index in 1..12 loop
        v_random_byte := get_byte(gen_random_bytes(1), 0);
        v_suffix := v_suffix || substr(
          v_alphabet,
          (v_random_byte % length(v_alphabet)) + 1,
          1
        );
      end loop;
      v_value := 'BARB-' ||
        substr(v_suffix, 1, 4) || '-' ||
        substr(v_suffix, 5, 4) || '-' ||
        substr(v_suffix, 9, 4);
    else
      -- Link and QR invitations are bearer links backed by a 128-bit random token.
      v_value := 'SIL-' || upper(encode(gen_random_bytes(16), 'hex'));
    end if;

    v_hash := encode(digest(v_value, 'sha256'), 'hex');
    exit when not exists (
      select 1
      from public.barbershop_invite_codes as existing_invite
      where existing_invite.code_hash = v_hash
    );
  end loop;

  insert into public.barbershop_invite_codes (
    barbershop_id,
    code_hash,
    role,
    expires_at,
    created_by,
    invite_method
  )
  values (
    v_barbershop_id,
    v_hash,
    'barber',
    v_expires,
    v_user,
    p_method
  )
  returning id into v_invite_id;

  return query
    select v_invite_id, v_value, v_expires, 'barber'::text, p_method;
end;
$function$;

revoke all on function public.create_barbershop_invite_v2(text, integer)
  from public, anon, authenticated;
grant execute on function public.create_barbershop_invite_v2(text, integer)
  to authenticated;

-- Keep the old RPC signature working, but route it through the single invite
-- generator so all newly issued invitations share the same expiry and quota rules.
create or replace function public.create_barbershop_invite_code(p_role text default 'barber')
returns table (code text, expires_at timestamptz, role text)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_invite record;
begin
  if p_role is distinct from 'barber' then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select *
    into v_invite
  from public.create_barbershop_invite_v2('code', 168);

  return query
    select v_invite.invite_value, v_invite.expires_at, v_invite.role;
end;
$function$;

revoke all on function public.create_barbershop_invite_code(text)
  from public, anon, authenticated;
grant execute on function public.create_barbershop_invite_code(text)
  to authenticated;

create or replace function public.revoke_barbershop_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user uuid := auth.uid();
  v_barbershop_id uuid;
  v_role text;
  v_rows integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select u.barbershop_id, u.role
    into v_barbershop_id, v_role
  from public.users as u
  where u.id = v_user
    and u.role in ('owner', 'admin');

  if v_barbershop_id is null or v_role not in ('owner', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.barbershop_invite_codes as invite
  set revoked_at = now()
  where invite.id = p_invite_id
    and invite.barbershop_id = v_barbershop_id
    and invite.used_at is null
    and invite.revoked_at is null
    and invite.expires_at > now();

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'invite_not_revocable' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;

revoke all on function public.revoke_barbershop_invite(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_barbershop_invite(uuid)
  to authenticated;

create or replace function public.join_barbershop_with_invite(p_code text)
returns table (barbershop_id uuid, role text)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user uuid := auth.uid();
  v_input text;
  v_hash text;
  v_invite public.barbershop_invite_codes%rowtype;
  v_default_permissions jsonb := jsonb_build_object(
    'dashboard', true, 'agenda', true, 'clients', true, 'services', true,
    'team', false, 'messages', false, 'marketing', false, 'loyalty', false,
    'automations', false, 'analytics', false, 'qr', false, 'settings', false, 'billing', false
  );
  v_plan text := 'free';
  v_limit integer := 1;
  v_active_count integer := 0;
  v_existing_professional boolean := false;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  v_input := upper(regexp_replace(trim(coalesce(p_code, '')), '[[:space:]]+', '', 'g'));

  if v_input ~ '^BARB-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$'
    or v_input ~ '^BARB-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$' then
    null;
  elsif v_input ~ '^SIL-[0-9A-F]{32}$' then
    null;
  elsif v_input ~ '^[0-9A-F]{10}$' then
    null;
  else
    raise exception 'invalid_code' using errcode = '22023';
  end if;

  -- An owner with no barbershop association is an incomplete/orphaned
  -- onboarding profile, not an active shop owner. Let that profile join.
  -- Keep the single-shop ownership boundary for owners linked to a shop.
  if exists (
    select 1
    from public.users as u
    where u.id = v_user
      and u.role = 'owner'
      and u.barbershop_id is not null
  ) then
    raise exception 'owner_already_has_barbershop' using errcode = '42501';
  end if;

  v_hash := encode(digest(v_input, 'sha256'), 'hex');

  select *
    into v_invite
  from public.barbershop_invite_codes
  where code_hash = v_hash
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'invalid_or_expired_code' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.professionals as professional
    where professional.barbershop_id = v_invite.barbershop_id
      and professional.user_id = v_user
  ) into v_existing_professional;

  if not v_existing_professional then
    perform pg_advisory_xact_lock(hashtextextended(v_invite.barbershop_id::text, 0));

    select coalesce(public.get_effective_billing_plan_for_barbershop(v_invite.barbershop_id), 'free')
      into v_plan;

    v_limit := case v_plan
      when 'free' then 1
      when 'pro' then 5
      when 'enterprise' then 2147483647
      else 1
    end;

    select count(*)::integer
      into v_active_count
    from public.professionals as professional
    where professional.barbershop_id = v_invite.barbershop_id
      and professional.active = true;

    if v_active_count >= v_limit then
      raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
    end if;
  end if;

  perform set_config('app.silentra_invite_join', 'true', true);

  update public.users
  set barbershop_id = v_invite.barbershop_id,
      role = v_invite.role
  where id = v_user;

  if not found then
    raise exception 'user_profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.barbershop_member_permissions(user_id, barbershop_id, permissions, updated_at)
  values (v_user, v_invite.barbershop_id, v_default_permissions, now())
  on conflict (user_id) do update
    set barbershop_id = excluded.barbershop_id,
        permissions = excluded.permissions,
        updated_at = excluded.updated_at;

  perform public.sync_barber_professional(v_user, v_invite.barbershop_id, v_invite.role);

  update public.barbershop_invite_codes
  set used_at = now(),
      used_by = v_user
  where id = v_invite.id;

  return query select v_invite.barbershop_id, v_invite.role;
end;
$function$;

revoke all on function public.join_barbershop_with_invite(text)
  from public, anon, authenticated;
grant execute on function public.join_barbershop_with_invite(text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
