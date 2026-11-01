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
const loyaltyRedemptionHardening = await read(\n  'supabase/migrations/20261101230417_fix_loyalty_redemption_api.sql',\n);\nconst bookingApi = await read('app/api/bookings/route.ts');
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
  /grant update \([\s\S]*name_complete[\s\S]*birth_date\) on table public\.users/i,
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
  loyaltyRedemptionHardening,
  /drop function if exists public\\.redeem_loyalty_reward\\([\\s\\S]*timestamptz\\s*\\)/i,
  'The obsolete five-argument redemption RPC must be removed.',
);
assert.match(
  loyaltyRedemptionHardening,
  /p_token_encrypted text[\\s\\S]*p_code_encrypted text/i,
  'The current redemption RPC must persist encrypted voucher recovery material.',
);
assert.match(
  loyaltyRedemptionHardening,
  /grant execute on function public\\.redeem_loyalty_reward\\([\\s\\S]*to service_role/i,
  'Only the server-side service role may execute the redemption RPC.',
);
assert.doesNotMatch(
  loyaltyRedemptionHardening,
  /to authenticated/i,
  'The redemption RPC must not be executable by authenticated users.',
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
  '[DATABASE_SECURITY_QA] tenant RLS, protected account fields, private permission helper and loyalty redemption contracts passed',
);
