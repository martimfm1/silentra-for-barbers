begin;

-- These three appointment references are queried in the agenda, CRM history
-- and service/professional reporting paths. The existing client timeline index
-- starts with barbershop_id and therefore does not cover client_id lookups or
-- FK checks by client_id alone. The exclusion GiST index also does not replace
-- B-tree FK indexes.
create index if not exists appointments_client_id_fk_idx
  on public.appointments (client_id);

create index if not exists appointments_professional_id_fk_idx
  on public.appointments (professional_id);

create index if not exists appointments_service_id_fk_idx
  on public.appointments (service_id);

-- The canonical unique/constraint indexes already cover these exact keys.
-- The duplicate indexes add write and storage cost without adding coverage.
drop index if exists public.idx_appointments_management_token;
drop index if exists public.locations_parent_barbershop_idx;
drop index if exists public.locations_parent_barbershop_slug_idx;
drop index if exists public.loyalty_rewards_shop_idx;
drop index if exists public.marketing_campaigns_birthday_repair_idx;

commit;
