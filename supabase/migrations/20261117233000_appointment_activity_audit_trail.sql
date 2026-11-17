begin;

create index if not exists audit_logs_appointment_tenant_timeline_idx
  on public.audit_logs ((metadata ->> 'barbershop_id'), entity_id, created_at desc)
  where entity_type = 'appointment';

create or replace function public.capture_appointment_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_type text;
  v_barbershop_id uuid;
begin
  v_barbershop_id := coalesce(new.barbershop_id, old.barbershop_id);

  if v_actor_id is not null then
    select u.name_complete
      into v_actor_name
    from public.users as u
    where u.id = v_actor_id
      and u.barbershop_id = v_barbershop_id;
  end if;

  if tg_op = 'INSERT' then
    v_actor_type := case
      when v_actor_id is not null then 'staff'
      when new.client_id is not null or nullif(trim(coalesce(new.manual_name, '')), '') is not null then 'customer'
      else 'system'
    end;

    insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
    values (
      'appointment.created',
      'appointment',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'barbershop_id', new.barbershop_id,
        'actor_type', v_actor_type,
        'actor_user_id', v_actor_id,
        'actor_name', coalesce(v_actor_name, nullif(trim(new.manual_name), '')),
        'status', new.status::text,
        'date_hour', new.date_hour,
        'service_id', new.service_id,
        'professional_id', new.professional_id
      )),
      now()
    );
    return new;
  end if;

  -- Server-side routes using the service role write their own actor-aware
  -- event. This trigger handles direct authenticated writes and cancellations
  -- that already carry explicit actor metadata.
  if v_actor_id is null and new.cancellation_actor is null then
    return new;
  end if;

  v_actor_type := coalesce(
    nullif(new.cancellation_actor, ''),
    case when v_actor_id is not null then 'staff' else 'system' end
  );
  v_actor_name := coalesce(
    nullif(trim(new.cancellation_actor_name), ''),
    nullif(trim(v_actor_name), ''),
    case when v_actor_type = 'staff' then 'Equipa da barbearia' else 'Sistema' end
  );

  if old.status is distinct from new.status then
    insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
    values (
      case
        when new.status = 'cancelled' then 'appointment.cancelled'
        when new.status = 'completed' then 'appointment.completed'
        when old.status = 'pending' and new.status = 'scheduled' then 'appointment.confirmed'
        else 'appointment.status_changed'
      end,
      'appointment',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'barbershop_id', new.barbershop_id,
        'actor_type', v_actor_type,
        'actor_user_id', v_actor_id,
        'actor_name', v_actor_name,
        'from_status', old.status::text,
        'to_status', new.status::text,
        'cancellation_reason', new.cancellation_reason
      )),
      now()
    );
  end if;

  if old.date_hour is distinct from new.date_hour then
    insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
    values (
      'appointment.rescheduled',
      'appointment',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'barbershop_id', new.barbershop_id,
        'actor_type', v_actor_type,
        'actor_user_id', v_actor_id,
        'actor_name', v_actor_name,
        'from_date_hour', old.date_hour,
        'to_date_hour', new.date_hour
      )),
      now()
    );
  end if;

  if old.professional_id is distinct from new.professional_id then
    insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
    values (
      'appointment.professional_changed',
      'appointment',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'barbershop_id', new.barbershop_id,
        'actor_type', v_actor_type,
        'actor_user_id', v_actor_id,
        'actor_name', v_actor_name,
        'from_professional_id', old.professional_id,
        'to_professional_id', new.professional_id
      )),
      now()
    );
  end if;

  if old.service_id is distinct from new.service_id then
    insert into public.audit_logs (action, entity_type, entity_id, metadata, created_at)
    values (
      'appointment.service_changed',
      'appointment',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'barbershop_id', new.barbershop_id,
        'actor_type', v_actor_type,
        'actor_user_id', v_actor_id,
        'actor_name', v_actor_name,
        'from_service_id', old.service_id,
        'to_service_id', new.service_id
      )),
      now()
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.capture_appointment_audit_event()
  from public, anon, authenticated;

drop trigger if exists capture_appointment_audit_event
  on public.appointments;

create trigger capture_appointment_audit_event
after insert or update of status, date_hour, professional_id, service_id
on public.appointments
for each row
execute function public.capture_appointment_audit_event();

commit;
