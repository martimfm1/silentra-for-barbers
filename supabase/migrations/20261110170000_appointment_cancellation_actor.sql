-- Preserve who cancelled each appointment for the agenda audit trail.
alter table public.appointments
  add column if not exists cancellation_actor text,
  add column if not exists cancellation_actor_name text;

comment on column public.appointments.cancellation_actor is
  'Origin of the cancellation: staff or customer.';
comment on column public.appointments.cancellation_actor_name is
  'Display name of the person who cancelled the appointment.';
