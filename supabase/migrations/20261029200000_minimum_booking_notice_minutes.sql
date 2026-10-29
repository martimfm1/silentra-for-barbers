begin;

alter table public.barbershops add column if not exists minimum_booking_notice_minutes integer not null default 0;
alter table public.barbershops drop constraint if exists barbershops_minimum_booking_notice_minutes_check;
alter table public.barbershops add constraint barbershops_minimum_booking_notice_minutes_check check (minimum_booking_notice_minutes between 0 and 43200);

create or replace function public.update_barbershop_config(
  p_barbershop_id uuid,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_cancellation_hours integer;
  v_cancellation_raw text;
  v_default_language text;
  v_booking_notice_minutes integer;
  v_booking_notice_raw text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null
     or p_config is null
     or jsonb_typeof(p_config) <> 'object' then
    raise exception 'invalid barbershop config';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.barbershop_id = p_barbershop_id
      and u.role in ('owner', 'admin')
  ) then
    raise exception 'barbershop update not permitted';
  end if;

  v_plan := public.get_effective_billing_plan_for_barbershop(p_barbershop_id);

  if p_config ? 'default_language' then
    v_default_language := lower(btrim(p_config->>'default_language'));
    if v_default_language not in ('pt', 'en') then
      raise exception 'invalid default language';
    end if;
  end if;

  if p_config ? 'time_limit_cancellation_hours' then
    v_cancellation_raw := nullif(btrim(p_config->>'time_limit_cancellation_hours'), '');

    if v_cancellation_raw is null or v_cancellation_raw !~ '^[0-9]+$' then
      raise exception 'invalid cancellation window';
    end if;

    begin
      v_cancellation_hours := v_cancellation_raw::integer;
    exception
      when numeric_value_out_of_range or invalid_text_representation then
        raise exception 'invalid cancellation window';
    end;

    if v_cancellation_hours < 0 or v_cancellation_hours > 720 then
      raise exception 'invalid cancellation window';
    end if;
  end if;

  if p_config ? 'minimum_booking_notice_minutes' then
    v_booking_notice_raw := nullif(btrim(p_config->>'minimum_booking_notice_minutes'), '');
    if v_booking_notice_raw is null or v_booking_notice_raw !~ '^[0-9]+$' then raise exception 'invalid minimum booking notice'; end if;
    begin v_booking_notice_minutes := v_booking_notice_raw::integer;
    exception when numeric_value_out_of_range or invalid_text_representation then raise exception 'invalid minimum booking notice'; end;
    if v_booking_notice_minutes < 0 or v_booking_notice_minutes > 43200 then raise exception 'invalid minimum booking notice'; end if;
  end if;

  if coalesce(v_plan, 'free') not in ('pro', 'enterprise')
     and (
       (
         p_config ? 'auto_confirm_bookings'
         and coalesce((p_config->>'auto_confirm_bookings')::boolean, false)
       )
       or (
         p_config ? 'auto_complete_bookings'
         and coalesce((p_config->>'auto_complete_bookings')::boolean, false)
       )
     ) then
    raise exception using
      errcode = '42501',
      message = 'AUTOMATIC_BOOKING_SETTINGS_PRO_REQUIRED';
  end if;

  update public.barbershops b
  set
    name = case
      when p_config ? 'name' then nullif(btrim(p_config->>'name'), '')
      else b.name
    end,
    phone = case
      when p_config ? 'phone' then nullif(btrim(p_config->>'phone'), '')
      else b.phone
    end,
    address = case
      when p_config ? 'address' then nullif(btrim(p_config->>'address'), '')
      else b.address
    end,
    opening_time = case
      when p_config ? 'opening_time' then nullif(p_config->>'opening_time', '')::time
      else b.opening_time
    end,
    closing_time = case
      when p_config ? 'closing_time' then nullif(p_config->>'closing_time', '')::time
      else b.closing_time
    end,
    lunch_start = case
      when p_config ? 'lunch_start' then nullif(p_config->>'lunch_start', '')::time
      else b.lunch_start
    end,
    lunch_end = case
      when p_config ? 'lunch_end' then nullif(p_config->>'lunch_end', '')::time
      else b.lunch_end
    end,
    closed_days = case
      when p_config ? 'closed_days' then nullif(btrim(p_config->>'closed_days'), '')
      else b.closed_days
    end,
    allow_online_bookings = case
      when p_config ? 'allow_online_bookings' then coalesce((p_config->>'allow_online_bookings')::boolean, false)
      else b.allow_online_bookings
    end,
    auto_reminders = case
      when p_config ? 'auto_reminders' then coalesce((p_config->>'auto_reminders')::boolean, false)
      else b.auto_reminders
    end,
    auto_confirm_bookings = case
      when p_config ? 'auto_confirm_bookings' then coalesce((p_config->>'auto_confirm_bookings')::boolean, false)
      else b.auto_confirm_bookings
    end,
    auto_complete_bookings = case
      when p_config ? 'auto_complete_bookings' then coalesce((p_config->>'auto_complete_bookings')::boolean, false)
      else b.auto_complete_bookings
    end,
    time_limit_cancellation_hours = case
      when p_config ? 'time_limit_cancellation_hours' then v_cancellation_hours
      else b.time_limit_cancellation_hours
    end,
    minimum_booking_notice_minutes = case
      when p_config ? 'minimum_booking_notice_minutes' then v_booking_notice_minutes
      else b.minimum_booking_notice_minutes
    end,
    default_language = case
      when p_config ? 'default_language' then v_default_language
      else b.default_language
    end,
    updated_at = now()
  where b.id = p_barbershop_id;

  if not found then
    raise exception 'barbershop not found';
  end if;
end;
$$;


revoke all on function public.update_barbershop_config(uuid, jsonb) from public;
grant execute on function public.update_barbershop_config(uuid, jsonb) to authenticated;

commit;
