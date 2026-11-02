-- Keep service references intact so deleting a service can never erase booking history.
alter table public.appointments
  drop constraint if exists appointments_service_id_fkey;

alter table public.appointments
  add constraint appointments_service_id_fkey
  foreign key (service_id)
  references public.services(id)
  on delete restrict
  not valid;

alter table public.appointments
  validate constraint appointments_service_id_fkey;
