begin;

alter table public.barbershops
  add column if not exists auto_confirm_manual_bookings boolean not null default true;

update public.barbershops
set auto_confirm_manual_bookings = true
where auto_confirm_manual_bookings is null;

create or replace function public.set_manual_booking_auto_confirmation(
  p_barbershop_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_barbershop_id is null or p_enabled is null then
    raise exception 'invalid manual booking confirmation setting';
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

  update public.barbershops
  set auto_confirm_manual_bookings = p_enabled,
      updated_at = now()
  where id = p_barbershop_id;

  if not found then
    raise exception 'barbershop not found';
  end if;
end;
$$;

revoke all on function public.set_manual_booking_auto_confirmation(uuid, boolean) from public;
grant execute on function public.set_manual_booking_auto_confirmation(uuid, boolean) to authenticated;

create or replace function public.apply_manual_booking_confirmation_setting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auto_confirm boolean;
begin
  -- Authenticated inserts originate from the internal dashboard. Public booking
  -- creation runs through the service-role RPC and keeps its own status logic.
  if auth.uid() is not null and new.status in ('pending', 'scheduled') then
    select coalesce(b.auto_confirm_manual_bookings, true)
      into v_auto_confirm
    from public.barbershops b
    where b.id = new.barbershop_id;

    if v_auto_confirm then
      new.status := 'scheduled';
    else
      new.status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_manual_booking_confirmation_setting
  on public.appointments;

create trigger trg_apply_manual_booking_confirmation_setting
before insert on public.appointments
for each row
execute function public.apply_manual_booking_confirmation_setting();

commit;
