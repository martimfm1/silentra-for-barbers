-- This migration was authored for a superseded `locations.barbershop_id`
-- shape. The canonical table, created in 20260809000100 and used by the
-- application, owns locations through `parent_barbershop_id`.
create index if not exists locations_parent_barbershop_idx
  on public.locations (parent_barbershop_id);

create unique index if not exists locations_parent_barbershop_slug_idx
  on public.locations (parent_barbershop_id, slug);

create index if not exists subscriptions_user_plan_status_idx
  on public.subscriptions (user_id, plan, status, updated_at desc);
