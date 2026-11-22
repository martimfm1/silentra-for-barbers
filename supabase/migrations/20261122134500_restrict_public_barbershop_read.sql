begin;

-- Public storefront, landing-page and booking endpoints use the server-side
-- service role. The Data API must not expose every barbershop row/column.
-- Authenticated dashboard access is limited to staff belonging to that tenant.
revoke all privileges on table public.barbershops from anon, authenticated;

-- Remove any older column-level grants as well as table-level grants.
revoke all privileges (
  id,
  name,
  phone,
  address,
  opening_time,
  closing_time,
  closed_days,
  allow_online_bookings,
  auto_reminders,
  time_limit_cancellation_hours,
  created_at,
  slug,
  whatsapp_status,
  updated_at,
  lunch_start,
  lunch_end,
  is_public_in_directory,
  created_by,
  qr_code_text,
  avatar_url,
  auto_confirm_bookings,
  auto_complete_bookings,
  marketplace_sales_mode,
  default_language,
  minimum_booking_notice_minutes,
  mbway_enabled,
  mbway_phone,
  calendar_feed_enabled,
  calendar_feed_version,
  auto_confirm_manual_bookings,
  require_birth_date,
  weekly_schedule
) on table public.barbershops from anon, authenticated;

-- Columns required by the authenticated dashboard/settings UI.
-- Internal ownership, QR and calendar feed version metadata stay server-only.
grant select (
  id,
  name,
  phone,
  address,
  opening_time,
  closing_time,
  closed_days,
  allow_online_bookings,
  auto_reminders,
  time_limit_cancellation_hours,
  slug,
  whatsapp_status,
  updated_at,
  lunch_start,
  lunch_end,
  is_public_in_directory,
  avatar_url,
  auto_confirm_bookings,
  auto_complete_bookings,
  default_language,
  minimum_booking_notice_minutes,
  mbway_enabled,
  mbway_phone,
  auto_confirm_manual_bookings,
  require_birth_date,
  weekly_schedule
) on table public.barbershops to authenticated;

-- The only direct client-side table update still used by the application is
-- the authenticated owner/admin location endpoint. Other settings use guarded
-- SECURITY DEFINER RPCs with an internal owner/admin check.
grant update (address) on table public.barbershops to authenticated;

drop policy if exists barbershops_public_read on public.barbershops;
drop policy if exists barbershops_authenticated_tenant_read on public.barbershops;

create policy barbershops_authenticated_tenant_read
  on public.barbershops
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users as actor
      where actor.id = (select auth.uid())
        and actor.barbershop_id = barbershops.id
        and actor.role in (
          'owner',
          'admin',
          'manager',
          'barber',
          'receptionist',
          'staff',
          'professional'
        )
    )
  );

commit;
