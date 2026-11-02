alter table public.services
  validate constraint services_price_non_negative;

alter table public.services
  validate constraint services_duration_valid;
