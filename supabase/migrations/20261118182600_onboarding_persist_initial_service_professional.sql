begin;

-- Complete the first usable barbershop setup in the same transaction as the
-- existing owner/barbershop creation: one real catalogue service and one
-- initial professional. The browser never writes tenant rows directly.

create or replace function public.create_barbershop_onboarding_with_defaults(
  p_name text,
  p_address text,
  p_city text,
  p_opening_time time,
  p_closing_time time,
  p_price numeric,
  p_tags text[] default '{}',
  p_lat numeric default null,
  p_lng numeric default null,
  p_service_name text default 'Corte de cabelo',
  p_service_duration integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barbershop_id uuid;
  v_service_id uuid;
  v_professional_id uuid;
  v_professional_name text;
begin
  if nullif(btrim(p_service_name), '') is null
    or length(btrim(p_service_name)) > 100
    or p_service_duration is null
    or p_service_duration < 1
    or p_service_duration > 1440
  then
    raise exception using errcode = '22023', message = 'INVALID_INITIAL_SERVICE';
  end if;

  -- This existing RPC validates the owner and creates the barbershop, public
  -- shop profile, legacy opening hours and owner membership atomically.
  v_barbershop_id := public.create_barbershop_onboarding(
    p_name,
    p_address,
    p_city,
    p_opening_time,
    p_closing_time,
    p_price,
    p_tags,
    p_lat,
    p_lng
  );

  select coalesce(
    nullif(btrim(u.name_complete), ''),
    nullif(btrim(u.name), ''),
    'Responsável'
  )
  into v_professional_name
  from public.users u
  where u.id = auth.uid()
    and u.barbershop_id = v_barbershop_id
    and u.role = 'owner';

  if v_professional_name is null then
    raise exception using errcode = 'P0002', message = 'OWNER_PROFILE_NOT_FOUND';
  end if;

  insert into public.services (
    barbershop_id,
    name,
    price,
    duration,
    is_active
  )
  values (
    v_barbershop_id,
    btrim(p_service_name),
    round(p_price, 2),
    p_service_duration,
    true
  )
  returning id into v_service_id;

  insert into public.professionals (
    barbershop_id,
    user_id,
    name,
    commission_percentage,
    active
  )
  values (
    v_barbershop_id,
    auth.uid(),
    v_professional_name,
    100,
    true
  )
  returning id into v_professional_id;

  update public.shops
  set popular_service_id = v_service_id,
      updated_at = now()
  where barbershop_id = v_barbershop_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'PUBLIC_SHOP_PROFILE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'barbershop_id', v_barbershop_id,
    'service_id', v_service_id,
    'professional_id', v_professional_id
  );
end;
$$;

revoke all on function public.create_barbershop_onboarding_with_defaults(
  text, text, text, time, time, numeric, text[], numeric, numeric, text, integer
) from public, anon;

grant execute on function public.create_barbershop_onboarding_with_defaults(
  text, text, text, time, time, numeric, text[], numeric, numeric, text, integer
) to authenticated;

notify pgrst, 'reload schema';

commit;
