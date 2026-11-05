-- Enforce professional quotas atomically at the database boundary.
-- The function is intentionally callable only by the service role.

create or replace function public.create_professional_with_plan_quota(
  p_actor_user_id uuid,
  p_barbershop_id uuid,
  p_name varchar,
  p_commission_percentage integer default null,
  p_active boolean default true
)
returns public.professionals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_barbershop_id uuid;
  v_role text;
  v_plan text := 'free';
  v_limit integer := 1;
  v_count integer;
  v_professional public.professionals;
begin
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 120 then
    raise exception using errcode = '22023', message = 'INVALID_NAME';
  end if;

  if p_commission_percentage is not null and (p_commission_percentage < 0 or p_commission_percentage > 100) then
    raise exception using errcode = '22023', message = 'INVALID_COMMISSION';
  end if;

  select u.barbershop_id, u.role
    into v_user_barbershop_id, v_role
  from public.users u
  where u.id = p_actor_user_id;

  if v_user_barbershop_id is null or v_user_barbershop_id <> p_barbershop_id then
    raise exception using errcode = '42501', message = 'BARBERSHOP_ACCESS_DENIED';
  end if;

  if coalesce(lower(v_role), '') not in ('admin', 'owner') then
    raise exception using errcode = '42501', message = 'PROFESSIONAL_MANAGEMENT_DENIED';
  end if;

  -- Serialize quota checks per barbershop so concurrent requests cannot
  -- create two professionals through a count-then-insert race.
  perform pg_advisory_xact_lock(hashtextextended(p_barbershop_id::text, 0));

  select case
    when s.status in ('active', 'trialing') and s.plan in ('pro', 'enterprise')
      then s.plan::text
    else 'free'
  end
    into v_plan
  from public.subscriptions s
  join public.users u on u.id = s.user_id
  where u.barbershop_id = p_barbershop_id
  order by case when s.status in ('active', 'trialing') then 0 else 1 end,
           s.updated_at desc
  limit 1;

  if v_plan = 'pro' then
    v_limit := 5;
  elsif v_plan = 'enterprise' then
    v_limit := null;
  end if;

  select count(*)::integer
    into v_count
  from public.professionals
  where barbershop_id = p_barbershop_id;

  if v_limit is not null and v_count >= v_limit then
    raise exception using errcode = 'P0001', message = 'PROFESSIONAL_LIMIT_REACHED';
  end if;

  insert into public.professionals (
    barbershop_id,
    name,
    commission_percentage,
    active
  )
  values (
    p_barbershop_id,
    btrim(p_name),
    p_commission_percentage,
    coalesce(p_active, true)
  )
  returning * into v_professional;

  insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
  values (
    'professional.created',
    'professional',
    v_professional.id::text,
    jsonb_build_object('barbershop_id', p_barbershop_id, 'plan', v_plan, 'actor_user_id', p_actor_user_id),
    now()
  );

  return v_professional;
end;
$$;

revoke all on function public.create_professional_with_plan_quota(uuid, uuid, varchar, integer, boolean) from public, anon, authenticated;
grant execute on function public.create_professional_with_plan_quota(uuid, uuid, varchar, integer, boolean) to service_role;
