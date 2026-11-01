import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (file) => readFile(join(root, file), 'utf8');

const migration = await read(
  'supabase/migrations/20261101225911_harden_production_tenant_rls.sql',
);
const appointmentUpdateMigration = await read(\n  'supabase/migrations/20261101230500_harden_appointment_update_rls.sql',\n);\nconst bookingApi = await read('app/api/bookings/route.ts');
const bookingRpcHardening = await read(
  'supabase/migrations/20260830190000_harden_security_definer_function_privileges.sql',
);

assert.match(
  migration,
  /revoke all privileges on table public\.appointments from anon/i,
  'Anonymous users must not have direct appointment table privileges.',
);
assert.match(
  migration,
  /appointments_staff_read_tenant[\s\S]*has_barbershop_permission/i,
  'Appointment reads must be restricted to the current tenant and agenda permission.',
);
assert.match(
  migration,
  /appointments_staff_insert_tenant[\s\S]*status in \('pending', 'scheduled'\)/i,
  'Direct authenticated appointment inserts must be tenant-checked and limited to initial states.',
);
assert.match(
  migration,
  /revoke all privileges on table public\.users from anon/i,
  'Anonymous users must not have direct user/CRM table privileges.',
);
assert.match(
  migration,
  /grant update \([\s\S]*name_complete[\s\S]*birth_date\) on table public\.users/i,
  'Authenticated users may only update safe profile/CRM fields.',
);
assert.doesNotMatch(
  migration,
  /grant update \([^)]*\b(role|barbershop_id|id)\b/i,
  'Protected account/tenant columns must never be granted for client updates.',
);
assert.match(
  migration,
  /barbershops_owner_admin_update[\s\S]*actor\.role in \('owner', 'admin'\)/i,
  'Barbershop writes must be restricted to its owner/admin.',
);
assert.doesNotMatch(
  migration,
  /create policy[^;]+to public[^;]+for update/i,
  'No permissive public UPDATE policy may be recreated.',
);
assert.match(
  migration,
  /has_barbershop_permission[\s\S]*security definer[\s\S]*set search_path = ''/i,
  'The permission helper must use a pinned empty search_path.',
);
assert.match(
  migration,
  /revoke all on function public\.has_barbershop_permission\(uuid, text\[\]\)[\s\S]*from public, anon, authenticated/i,
  'The permission helper must explicitly revoke public execution before granting it.',
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
  '[DATABASE_SECURITY_QA] tenant-scoped appointments, protected users and owner/admin barbershop writes passed',
);
