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
  /revoke all on table[\s\S]*public\.audit_logs[\s\S]*public\.verification_tokens[\s\S]*from public, anon, authenticated/i,
  'Internal audit, queue, configuration, rate-limit and token tables must not be exposed to client roles.',
);
assert.match(
  internalTableHardening,
  /grant all on table[\s\S]*public\.verification_tokens[\s\S]*to service_role/i,
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

console.log(
  '[DATABASE_SECURITY_QA] tenant RLS, privileged RPCs, internal table grants and loyalty redemption contracts passed',
);
