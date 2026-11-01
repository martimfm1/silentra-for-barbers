import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(file, 'utf8');

const [
  detailApi,
  profile,
  plansApi,
  plansUi,
  migration,
  apiHotPathMigration,
  portuguese,
  english,
] = await Promise.all([
  read('app/api/crm/clients/[clientId]/route.ts'),
  read('components/dashboard/client-details-dialog.tsx'),
  read('app/api/crm/clients/[clientId]/plans/route.ts'),
  read('components/dashboard/client-plans-manager.tsx'),
  read('supabase/migrations/20261101162000_client_membership_plans.sql'),
  read('supabase/migrations/20261101181241_api_hot_path_optimizations.sql'),
  read('app/locales/pt-copy.ts'),
  read('app/locales/en-copy.ts'),
]);

// Customer lifetime spend is the sum of captured service and product prices,
// calculated in a single tenant-scoped database aggregate over completed bookings.
assert.match(
  detailApi,
  /get_client_completed_total_spent/,
);
assert.match(detailApi, /p_barbershop_id:\s*t\.barbershopId/);
assert.match(detailApi, /p_client_id:\s*clientId/);
assert.match(detailApi, /completedAppointmentsTotalResult\.error/);
assert.match(
  detailApi,
  /Number\(\s*completedAppointmentsTotalResult\.data \?\? 0,?\s*\)/,
);
assert.match(
  detailApi,
  /totalSpent: Math\.round\(completedAppointmentsTotal \* 100\) \/ 100/,
);
assert.doesNotMatch(detailApi, /getCompletedAppointmentsTotal|\.range\(/);
assert.equal(
  (detailApi.match(/id, date_hour, status, service_price, value_products/g) ?? []).length,
  2,
);
assert.match(
  apiHotPathMigration,
  /sum\(coalesce\(a\.service_price, 0\) \+ coalesce\(a\.value_products, 0\)\)/i,
);
assert.match(apiHotPathMigration, /a\.status = 'completed'/i);
assert.match(apiHotPathMigration, /a\.barbershop_id = p_barbershop_id/i);
assert.match(migration, /add column if not exists service_price numeric\(10,2\)/i);
assert.match(migration, /appointments_sync_service_price/);
assert.match(migration, /set service_price = service\.price/i);
assert.match(profile, /totalSpent: Number\(json\.totalSpent\) \|\| 0/);
assert.match(profile, /details\?\.totalSpent/);

// Upcoming appointments are queried independently and ordered nearest-first.
assert.match(detailApi, /upcomingAppointments/);
assert.match(detailApi, /\.in\('status', \['pending', 'scheduled'\]\)/);
assert.match(detailApi, /\.order\('date_hour', \{ ascending: true \}\)/);
assert.match(profile, /clientsPage\.upcomingAppointments/);
assert.match(profile, /upcomingAppointments\.map/);

// Client plans are tenant- and client-scoped at the API boundary.
assert.match(plansApi, /requireModuleContext\('clients', 'clients', req\)/);
assert.match(plansApi, /\.eq\('barbershop_id', tenant\.barbershopId\)/);
assert.match(plansApi, /\.eq\('client_id', clientId\)/);
assert.match(plansApi, /validateServices/);
assert.match(plansApi, /mark-paid/);
assert.match(plansApi, /currentBillingPeriod/);

// Usage is derived from completed bookings in the current cycle.
assert.match(plansApi, /\.eq\('status', 'completed'\)/);
assert.match(plansApi, /\.gte\('date_hour'/);
assert.match(plansApi, /\.lt\('date_hour'/);
assert.match(plansApi, /remaining_appointments/);

// The database enforces one active plan per customer and protects both tables.
assert.match(migration, /create table if not exists public\.client_plans/i);
assert.match(migration, /create table if not exists public\.client_plan_payments/i);
assert.match(migration, /client_plans_one_active_per_client_idx/);
assert.match(migration, /alter table public\.client_plans enable row level security/i);
assert.match(migration, /alter table public\.client_plan_payments enable row level security/i);
assert.match(migration, /client_plans_tenant_select/);
assert.match(migration, /client_plan_payments_tenant_select/);

// The UI supports custom plans, payment tracking and both language packs.
assert.match(plansUi, /planCreateTitle/);
assert.match(plansUi, /planMarkPaid/);
assert.match(plansUi, /planPause/);
assert.match(plansUi, /planResume/);
assert.match(portuguese, /upcomingAppointments:/);
assert.match(portuguese, /planPaymentHistory:/);
assert.match(english, /upcomingAppointments:/);
assert.match(english, /planPaymentHistory:/);

console.log('[CLIENT_PLANS_QA] spend totals, upcoming bookings, client plans, usage and payment tracking passed');
