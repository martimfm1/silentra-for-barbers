begin;

-- SECURITY DEFINER bypasses users-table RLS. Enforce the same canonical
-- tenant CRM permission inside the RPC instead of relying on the caller UI
-- or the users_insert_client_in_tenant policy.
create or replace function public.add_client_from_completed_appointment(
  p_barbershop_id uuid,
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user public.users%rowtype;
  v_appointment public.appointments%rowtype;
  v_existing public.users%rowtype;
  v_client public.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select *
    into v_user
    from public.users
   where id = auth.uid()
     and barbershop_id = p_barbershop_id
   limit 1;

  if v_user.id is null
     or v_user.role not in ('owner', 'admin', 'manager', 'barber', 'receptionist', 'staff')
     or not private.has_barbershop_permission(
       p_barbershop_id,
       array['clients']::text[]
     ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
    into v_appointment
    from public.appointments
   where id = p_appointment_id
     and barbershop_id = p_barbershop_id
   for update;

  if v_appointment.id is null then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;

  if v_appointment.status not in ('scheduled', 'completed') then
    raise exception 'appointment must be confirmed before adding the client'
      using errcode = '22023';
  end if;

  if v_appointment.client_id is not null then
    select *
      into v_existing
      from public.users
     where id = v_appointment.client_id
       and barbershop_id = p_barbershop_id
       and role = 'client';

    if v_existing.id is null then
      raise exception 'appointment client is not a CRM client'
        using errcode = '22023';
    end if;

    return jsonb_build_object('already_exists', true, 'client', jsonb_build_object(
      'id', v_existing.id,
      'name_complete', v_existing.name_complete,
      'num_phone', v_existing.num_phone,
      'email', v_existing.email,
      'birth_date', v_existing.birth_date,
      'style_notes', v_existing.style_notes
    ));
  end if;

  if nullif(trim(coalesce(v_appointment.manual_name, '')), '') is null then
    raise exception 'appointment has no valid client name' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(v_appointment.manual_phone, '')), '') is not null then
    select *
      into v_existing
      from public.users
     where barbershop_id = p_barbershop_id
       and role = 'client'
       and regexp_replace(coalesce(num_phone, ''), '\s+', '', 'g') =
           regexp_replace(v_appointment.manual_phone, '\s+', '', 'g')
     order by created_at asc
     limit 1;

    if v_existing.id is not null then
      update public.appointments
         set client_id = v_existing.id
       where id = p_appointment_id;

      return jsonb_build_object('already_exists', true, 'client', jsonb_build_object(
        'id', v_existing.id,
        'name_complete', v_existing.name_complete,
        'num_phone', v_existing.num_phone,
        'email', v_existing.email,
        'birth_date', v_existing.birth_date,
        'style_notes', v_existing.style_notes
      ));
    end if;
  end if;

  insert into public.users (
    barbershop_id, name_complete, num_phone, email, birth_date, role
  )
  values (
    p_barbershop_id,
    trim(v_appointment.manual_name),
    coalesce(trim(v_appointment.manual_phone), ''),
    nullif(lower(trim(coalesce(v_appointment.manual_email, ''))), ''),
    v_appointment.manual_birth_date,
    'client'
  )
  returning * into v_client;

  update public.appointments
     set client_id = v_client.id
   where id = p_appointment_id;

  return jsonb_build_object('already_exists', false, 'client', jsonb_build_object(
    'id', v_client.id,
    'name_complete', v_client.name_complete,
    'num_phone', v_client.num_phone,
    'email', v_client.email,
    'birth_date', v_client.birth_date,
    'style_notes', v_client.style_notes
  ));
end;
$function$;

revoke all on function public.add_client_from_completed_appointment(uuid, uuid)
  from public, anon;
grant execute on function public.add_client_from_completed_appointment(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
