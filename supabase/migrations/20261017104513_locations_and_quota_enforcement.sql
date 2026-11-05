-- The canonical locations table and its tenant/slug indexes are created in
-- 20260809000100_pro_enterprise_modules.sql. Reassert those canonical names
-- without introducing redundant duplicate indexes on fresh installations.

create index if not exists locations_parent_idx
  on public.locations (parent_barbershop_id);

create unique index if not exists locations_parent_barbershop_id_slug_key
  on public.locations (parent_barbershop_id, slug);

create index if not exists subscriptions_user_plan_status_idx
  on public.subscriptions (user_id, plan, status, updated_at desc);
