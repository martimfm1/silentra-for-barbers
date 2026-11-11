-- Keep the CRM customer directory in sync with appointments, including
-- manually created bookings where the customer has not supplied an email yet.
-- Phone numbers are the stable matching key within a barbershop.

create or replace function public.sync_appointment_crm_client(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_client public.users%rowtype;
  v_phone_digits text;
begin
  select *
    into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if not found then
    return;
  end if;

  if v_appointment.client_id is not null then
    update public.users
    set email = coalesce(
      nullif(trim(email), ''),
      nullif(lower(trim(coalesce(v_appointment.manual_email, ''))), '')
    )
    where id = v_appointment.client_id
      and barbershop_id = v_appointment.barbershop_id
      and role = 'client';
    return;
  end if;

  if nullif(trim(coalesce(v_appointment.manual_name, '')), '') is null then
    return;
  end if;

  v_phone_digits := regexp_replace(coalesce(v_appointment.manual_phone, ''), '[^0-9]', '', 'g');

  -- Do not create unmatchable CRM entries for appointments without a phone.
  if v_phone_digits = '' then
    return;
  end if;

  -- Serialize matching/creation for the same shop and phone to avoid duplicates
  -- when two bookings for the same customer are created concurrently.
  perform pg_advisory_xact_lock(
    hashtextextended(v_appointment.barbershop_id::text || ':' || v_phone_digits, 0)
  );

  select *
    into v_client
  from public.users
  where barbershop_id = v_appointment.barbershop_id
    and role = 'client'
    and regexp_replace(coalesce(num_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
  order by created_at asc
  limit 1;

  if v_client.id is null then
    insert into public.users (
      barbershop_id,
      name_complete,
      num_phone,
      email,
      role
    )
    values (
      v_appointment.barbershop_id,
      trim(v_appointment.manual_name),
      trim(v_appointment.manual_phone),
      nullif(lower(trim(coalesce(v_appointment.manual_email, ''))), ''),
      'client'
    )
    returning * into v_client;
  else
    -- Enrich existing records without replacing information already maintained
    -- by the barber. In particular, a later-supplied email fills an empty email.
    update public.users
    set
      email = coalesce(
        nullif(trim(email), ''),
        nullif(lower(trim(coalesce(v_appointment.manual_email, ''))), '')
      ),
      name_complete = coalesce(nullif(trim(name_complete), ''), trim(v_appointment.manual_name)),
      num_phone = coalesce(nullif(trim(num_phone), ''), trim(v_appointment.manual_phone))
    where id = v_client.id
    returning * into v_client;
  end if;

  update public.appointments
  set client_id = v_client.id
  where id = v_appointment.id
    and client_id is null;
end;
$$;

revoke all on function public.sync_appointment_crm_client(uuid) from public;

create or replace function public.trigger_sync_appointment_crm_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_appointment_crm_client(new.id);
  return new;
end;
$$;

revoke all on function public.trigger_sync_appointment_crm_client() from public;

drop trigger if exists appointments_sync_crm_client on public.appointments;

create trigger appointments_sync_crm_client
after insert or update of manual_name, manual_phone, manual_email, client_id
on public.appointments
for each row
execute function public.trigger_sync_appointment_crm_client();

-- Backfill historical manual bookings so existing customers appear in the CRM
-- and all their bookings become associated with the same customer record.
do $$
declare
  v_appointment record;
begin
  for v_appointment in
    select id
    from public.appointments
    where client_id is null
      and nullif(trim(coalesce(manual_name, '')), '') is not null
      and nullif(regexp_replace(coalesce(manual_phone, ''), '[^0-9]', '', 'g'), '') is not null
    order by date_hour asc, created_at asc
  loop
    perform public.sync_appointment_crm_client(v_appointment.id);
  end loop;
end;
$$;
