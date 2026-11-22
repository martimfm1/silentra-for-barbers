import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFile(join(root, file), 'utf8');

const initialHardening = await read(
  'supabase/migrations/20261101225911_harden_production_tenant_rls.sql',
);
const appointmentUpdateHardening = await read(
  'supabase/migrations/20261101230103_harden_appointment_update_rls.sql',
);
const privateHelperHardening = await read(
  'supabase/migrations/20261101230225_move_tenant_permission_helper_private.sql',
);
const loyaltyRedemptionHardening = await read(
  'supabase/migrations/20261101230417_fix_loyalty_redemption_api.sql',
);
const teamMemberHardening = await read(
  'supabase/migrations/20261101233345_harden_team_member_management_rpc.sql',
);
const internalTableHardening = await read(
  'supabase/migrations/20261101233354_revoke_internal_table_client_grants.sql',
);
const appointmentReferenceIndexes = await read(
  'supabase/migrations/20261101235218_add_appointment_reference_indexes.sql',
);
const rlsPolicyPerformance = await read(
  'supabase/migrations/20261101235220_optimize_rls_policy_initplans.sql',
);
const appointmentClientRpcHardening = await read(
  'supabase/migrations/20261105001000_enforce_client_permission_in_appointment_rpc.sql',
);
const bookingApi = await read('app/api/bookings/route.ts');
const bookingRpcHardening = await read(
  'supabase/migrations/20260830190000_harden_security_definer_function_privileges.sql',
);

assert.match(
  initialHardening,
  /revoke all privileges on table public\.appointments from anon/i,
  'Anonymous users must not have direct appointment table privileges.',
);
assert.match(
  initialHardening,
  /appointments_staff_read_tenant[\s\S]*has_barbershop_permission/i,
  'Appointment reads must be restricted to the current tenant and agenda permission.',
);
assert.match(
  initialHardening,
  /appointments_staff_insert_tenant[\s\S]*status in \('pending', 'scheduled'\)/i,
  'Direct authenticated appointment inserts must be tenant-checked and limited to initial states.',
);
assert.match(
  initialHardening,
  /revoke all privileges on table public\.users from anon/i,
  'Anonymous users must not have direct user/CRM table privileges.',
);
assert.match(
  initialHardening,
  /grant update \([\s\S]*name_complete[\s\S]*birth_date[\s\S]*\) on table public\.users/i,
  'Authenticated users may only update safe profile/CRM fields.',
);
assert.doesNotMatch(
  initialHardening,
  /grant update \([^)]*\b(role|barbershop_id|id)\b/i,
  'Protected account/tenant columns must never be granted for client updates.',
);
assert.match(
  initialHardening,
  /barbershops_owner_admin_update[\s\S]*actor\.role in \('owner', 'admin'\)/i,
  'Barbershop writes must be restricted to its owner/admin.',
);
assert.doesNotMatch(
  initialHardening,
  /create policy[^;]+to public[^;]+for update/i,
  'No permissive public UPDATE policy may be recreated.',
);

assert.match(
  appointmentUpdateHardening,
  /appointments_staff_update_tenant[\s\S]*with check[\s\S]*has_barbershop_permission/i,
  'Appointment updates must remain restricted to the caller tenant and agenda permission.',
);
assert.match(
  appointmentUpdateHardening,
  /new\.barbershop_id is distinct from old\.barbershop_id/i,
  'An appointment tenant must not be reassigned by a direct update.',
);
assert.match(
  appointmentUpdateHardening,
  /new\.service_id is distinct from old\.service_id[\s\S]*new\.professional_id is distinct from old\.professional_id[\s\S]*new\.client_id is distinct from old\.client_id/i,
  'Changed appointment references must be checked against the same tenant.',
);

assert.match(
  privateHelperHardening,
  /create schema if not exists private/i,
  'The permission helper must live in a non-exposed schema.',
);
assert.match(
  privateHelperHardening,
  /create or replace function private\.has_barbershop_permission/i,
  'The private permission helper must exist.',
);
assert.match(
  privateHelperHardening,
  /grant usage on schema private to authenticated, service_role/i,
  'Only trusted authenticated/server roles should be allowed to resolve the private helper schema.',
);
assert.match(
  privateHelperHardening,
  /drop function if exists public\.has_barbershop_permission/i,
  'The previous public RPC must be removed.',
);

assert.match(
  loyaltyRedemptionHardening,
  /drop function if exists public\.redeem_loyalty_reward\([\s\S]*timestamptz\s*\)/i,
  'The obsolete five-argument redemption RPC must be removed.',
);
assert.match(
  loyaltyRedemptionHardening,
  /p_token_encrypted text[\s\S]*p_code_encrypted text/i,
  'The current redemption RPC must persist encrypted voucher recovery material.',
);
assert.match(
  loyaltyRedemptionHardening,
  /grant execute on function public\.redeem_loyalty_reward\([\s\S]*to service_role/i,
  'Only the server-side service role may execute the redemption RPC.',
);
assert.doesNotMatch(
  loyaltyRedemptionHardening,
  /to authenticated/i,
  'The redemption RPC must not be executable by authenticated users.',
);

assert.match(
  teamMemberHardening,
  /v_actor_role <> 'owner'[\s\S]*team_permission_required/i,
  'Only the tenant owner may change team roles and permissions.',
);
assert.match(
  teamMemberHardening,
  /p_permissions is not null and jsonb_typeof\(p_permissions\) <> 'object'/i,
  'Team permissions must be a JSON object.',
);
assert.match(
  teamMemberHardening,
  /jsonb_each\(v_permissions\)[\s\S]*jsonb_typeof\(permission_entry\.value\) <> 'boolean'/i,
  'Team permission values must be booleans.',
);
assert.match(
  teamMemberHardening,
  /permissions\.user_id = p_user_id[\s\S]*permissions\.barbershop_id = v_shop/i,
  'Removing a team member must scope permission cleanup to the same tenant.',
);
assert.match(
  teamMemberHardening,
  /v_target_role = 'client'[\s\S]*clients_are_not_team_members/i,
  'The team removal RPC must not detach CRM clients.',
);

assert.match(
  internalTableHardening,
  /pg_catalog\.to_regclass[\s\S]*'audit_logs'[\s\S]*'email_queue'[\s\S]*'notification_queue'[\s\S]*'verification_tokens'/i,
  'Internal table hardening must safely detect each optional internal table.',
);
assert.match(
  internalTableHardening,
  /REVOKE ALL ON TABLE public\.%I FROM public, anon, authenticated/i,
  'Existing internal tables must not be exposed to client roles.',
);
assert.match(
  internalTableHardening,
  /GRANT ALL ON TABLE public\.%I TO service_role/i,
  'Trusted server-side workers must retain access to internal tables.',
);

assert.match(
  appointmentReferenceIndexes,
  /create index if not exists appointments_client_id_fk_idx[\s\S]*on public\.appointments \(client_id\)/i,
  'Appointment client foreign keys must have a full leading-column B-tree index.',
);
assert.match(
  appointmentReferenceIndexes,
  /create index if not exists appointments_professional_id_fk_idx[\s\S]*on public\.appointments \(professional_id\)/i,
  'Appointment professional foreign keys must have a full leading-column B-tree index.',
);
assert.match(
  appointmentReferenceIndexes,
  /create index if not exists appointments_service_id_fk_idx[\s\S]*on public\.appointments \(service_id\)/i,
  'Appointment service foreign keys must have a full leading-column B-tree index.',
);
assert.match(
  appointmentReferenceIndexes,
  /drop index if exists public\.idx_appointments_management_token[\s\S]*drop index if exists public\.locations_parent_barbershop_idx[\s\S]*drop index if exists public\.locations_parent_barbershop_slug_idx[\s\S]*drop index if exists public\.loyalty_rewards_shop_idx[\s\S]*drop index if exists public\.marketing_campaigns_birthday_repair_idx/i,
  'Only the redundant indexes must be removed; canonical unique/constraint indexes must remain.',
);

assert.doesNotMatch(
  appointmentReferenceIndexes,
  /drop index if exists public\.idx_appointments_management_token_expires_at/i,
  'The independent appointment expiry index must be preserved.',
);

assert.doesNotMatch(
  appointmentReferenceIndexes,
  /where (client_id|professional_id|service_id) is not null/i,
  'Foreign-key coverage indexes must not be partial.',
);

assert.match(
  appointmentReferenceIndexes,
  /create index if not exists appointments_client_id_fk_idx[\s\S]*create index if not exists appointments_professional_id_fk_idx[\s\S]*create index if not exists appointments_service_id_fk_idx/i,
  'Appointment foreign-key references must have full B-tree indexes.',
);
assert.doesNotMatch(
  appointmentReferenceIndexes,
  /where client_id is not null|where professional_id is not null|where service_id is not null/i,
  'Foreign-key indexes must not be partial indexes.',
);
assert.match(
  rlsPolicyPerformance,
  /\(select auth\.uid\(\)\)/i,
  'RLS policies must cache auth.uid() per statement.',
);
assert.match(
  rlsPolicyPerformance,
  /select public\.get_my_barbershop_id\(\)/i,
  'RLS policies must cache tenant helper calls per statement.',
);
assert.match(
  rlsPolicyPerformance,
  /drop policy if exists reviews_public_read[\s\S]*drop policy if exists "Leitura pública de serviços"/i,
  'Redundant public SELECT policies must be removed without removing the canonical public policy.',
);
assert.match(
  rlsPolicyPerformance,
  /drop policy if exists subscriptions_select_own[\s\S]*create policy subscriptions_select_own[\s\S]*or barbershop_id =/i,
  'Subscription SELECT policies must be consolidated without changing either access path.',
);

assert.match(
  rlsPolicyPerformance,
  /create policy "Permitir update de serviços da barbearia"[\s\S]*using \(\(select public\.get_my_barbershop_id\(\)\)\s*=/i,
  'Service write policies must cache the tenant helper per statement.',
);
assert.doesNotMatch(
  rlsPolicyPerformance,
  /get_my_barbershop_id\(\)\)\s*=\s*\(barbershop_id\)::text/i,
  'Service tenant checks must compare UUID columns as UUIDs.',
);

assert.match(
  rlsPolicyPerformance,
  /create policy marketing_campaigns_staff_read[\s\S]*select public\.get_my_barbershop_id\(\)/i,
  'Marketing tenant policies must cache the tenant helper per statement.',
);

assert.match(
  bookingApi,
  /create_booking_atomic/,
  'Public booking must keep using the server-side atomic booking RPC.',
);
assert.match(
  bookingRpcHardening,
  /grant execute[\s\S]*to service_role/i,
  'Atomic booking RPC must remain service-role-only.',
);

assert.match(
  appointmentClientRpcHardening,
  /private\.has_barbershop_permission\([\s\S]*array\['clients'\]::text\[\]/i,
  'The SECURITY DEFINER appointment-to-CRM RPC must enforce the tenant clients permission internally.',
);
assert.match(
  appointmentClientRpcHardening,
  /revoke all on function public\.add_client_from_completed_appointment\(uuid, uuid\)[\s\S]*grant execute on function public\.add_client_from_completed_appointment\(uuid, uuid\)\s*to authenticated/i,
  'The appointment-to-CRM RPC must remain authenticated-only.',
);
assert.match(
  appointmentClientRpcHardening,
  /set search_path = ''/i,
  'The SECURITY DEFINER appointment-to-CRM RPC must use an empty search_path.',
);

const barbershopReadHardening = await read(
  'supabase/migrations/20261122154328_restrict_public_barbershop_read.sql',
);
const publicProfileResolver = await read('lib/barbershops/public-profile.ts');
const enterpriseLandingPage = await read('app/site/[slug]/page.tsx');
const publicBookingAvailability = await read('app/api/shops/[id]/booking-data/route.ts');
const barbershopSettingsService = await read('app/dashboard/_services/barbershop.service.ts');
const legacyClientsService = await read('app/dashboard/_services/clients.service.ts');
const barbershopLocationRoute = await read(
  'app/api/barbershops/[barbershopId]/location/route.ts',
);

assert.ok(
  barbershopReadHardening.includes(
    'revoke all privileges on table public.barbershops from anon, authenticated;',
  ),
  'Direct Data API table grants must be removed before least-privilege grants are restored.',
);
assert.ok(
  barbershopReadHardening.includes('revoke all privileges (') &&
    barbershopReadHardening.includes(') on table public.barbershops from anon, authenticated;'),
  'Existing column-level grants must also be revoked.',
);
assert.ok(
  barbershopReadHardening.includes('grant select (') &&
    barbershopReadHardening.includes(') on table public.barbershops to authenticated;'),
  'Authenticated dashboard reads must be limited to an explicit column allowlist.',
);
assert.ok(
  barbershopReadHardening.includes(
    'grant update (address) on table public.barbershops to authenticated;',
  ),
  'The only direct client-side barbershop table update must be the tenant-checked location address.',
);
assert.ok(
  barbershopReadHardening.includes(
    'drop policy if exists barbershops_public_read on public.barbershops;',
  ),
  'The unconditional public read policy must be removed.',
);
assert.ok(
  barbershopReadHardening.includes('create policy barbershops_authenticated_tenant_read') &&
    barbershopReadHardening.includes('to authenticated') &&
    barbershopReadHardening.includes('actor.id = (select auth.uid())') &&
    barbershopReadHardening.includes('actor.barbershop_id = barbershops.id'),
  'Authenticated reads must be limited to staff belonging to the exact current tenant.',
);
assert.ok(
  !barbershopReadHardening.includes('to anon'),
  'No anonymous Data API read policy may be recreated for barbershops.',
);
assert.ok(
  publicProfileResolver.includes('createAdminClient()'),
  'Public profile resolution must remain on the server-side service client.',
);
assert.ok(
  enterpriseLandingPage.includes('createAdminClient()'),
  'Enterprise landing-page reads must remain server-side after public Data API access is removed.',
);
assert.ok(
  publicBookingAvailability.includes('createAdminClient()'),
  'Public availability must continue through the validated server-side endpoint.',
);
assert.ok(
  !legacyClientsService.includes(".from('barbershops')"),
  'The legacy customer service must not retain broad direct barbershop config reads or writes.',
);
assert.ok(
  barbershopSettingsService.includes(".from('barbershops')") &&
    barbershopSettingsService.includes('.select('),
  'The dashboard settings service must use explicit authenticated column reads.',
);
assert.ok(
  !barbershopSettingsService.includes(".select('*')"),
  'The dashboard settings service must not depend on SELECT *.',
);
assert.ok(
  barbershopLocationRoute.includes('profile?.barbershop_id !== barbershopId') &&
    barbershopLocationRoute.includes("!['owner', 'admin'].includes(profile.role)") &&
    barbershopLocationRoute.includes(".from('barbershops')") &&
    barbershopLocationRoute.includes('.update({ address })'),
  'The address-only direct update must check the authenticated tenant and owner/admin role.',
);

const publicBookingCreateRoute = await read('app/api/bookings/route.ts');
const publicDirectoryRoute = await read('app/api/shops/route.ts');
const publicSlotsRoute = await read('app/api/shops/[id]/slots/route.ts');
const privateMbwaySettingsRoute = await read('app/api/barbershops/mbway-settings/route.ts');

const selectGrantStart = barbershopReadHardening.indexOf('grant select (');
const selectGrantEnd = barbershopReadHardening.indexOf(
  ') on table public.barbershops to authenticated;',
  selectGrantStart,
);
assert.ok(selectGrantStart >= 0 && selectGrantEnd > selectGrantStart);
const selectGrant = barbershopReadHardening.slice(selectGrantStart, selectGrantEnd);
assert.ok(
  !selectGrant.includes('mbway_phone'),
  'The private MB WAY destination must not be readable by every authenticated staff member.',
);
assert.ok(
  privateMbwaySettingsRoute.includes("!['owner', 'admin'].includes(profile.role)") &&
    privateMbwaySettingsRoute.includes(".select('mbway_enabled, mbway_phone')") &&
    privateMbwaySettingsRoute.includes(".eq('id', profile.barbershop_id)"),
  'The MB WAY destination must be served only after owner/admin authorization and scoped to the authenticated tenant.',
);
assert.ok(
  !barbershopSettingsService.includes('mbway_enabled, mbway_phone') &&
    barbershopSettingsService.includes("fetch('/api/barbershops/mbway-settings'"),
  'Dashboard config must not read mbway_phone directly from the broad tenant SELECT grant.',
);
assert.ok(
  publicBookingCreateRoute.includes('const admin = createAdminClient()') &&
    publicBookingCreateRoute.includes('await admin') &&
    !publicBookingCreateRoute.includes('createClient'),
  'Public booking creation must resolve barbershop, service and block data server-side.',
);
assert.ok(
  publicDirectoryRoute.includes('const admin = createAdminClient()') &&
    !publicDirectoryRoute.includes('createClient') &&
    publicDirectoryRoute.includes(".eq('barbershops.is_public_in_directory', true)"),
  'The public directory must use server-side reads and keep its public-directory visibility filter.',
);
assert.ok(
  publicSlotsRoute.includes('createAdminClient()') &&
    publicSlotsRoute.includes('await admin') &&
    !publicSlotsRoute.includes('createClient'),
  'Public booking slots must not depend on anonymous SELECT from barbershops.',
);

assert.ok(
  publicBookingAvailability.includes(
    'mbwayPhone: manualPrepaymentEnabled ? mbwayPhone :',
  ) &&
    publicBookingAvailability.includes(
      "whatsappPhone: manualPrepaymentEnabled ? whatsappPhone :",
    ),
  'Public booking availability must not return payment destination numbers when MB WAY prepayment is unavailable.',
);

console.log(
  '[DATABASE_SECURITY_QA] tenant RLS, privileged RPCs, internal table grants and loyalty redemption contracts passed',
);
