begin;

-- A profile can be left with role=owner after an interrupted/legacy onboarding
-- without actually owning a barbershop. Such a profile must still be able to
-- accept a team invitation. Only block owners who are currently linked to a shop.
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

  v_input := upper(regexp_replace(trim(coalesce(p_code, '')), '\\s+', '', 'g'));

  if v_input ~ '^BARB-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$' then
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
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'invalid_or_expired_code' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.professionals
    where barbershop_id = v_invite.barbershop_id
      and user_id = v_user
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
    from public.professionals
    where barbershop_id = v_invite.barbershop_id
      and active = true;

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
