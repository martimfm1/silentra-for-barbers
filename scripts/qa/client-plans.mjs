import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(file, 'utf8');

const [
  detailApi,
  profile,
  plansApi,
  plansUi,
  migration,
  portuguese,
  english,
] = await Promise.all([
  read('app/api/crm/clients/[clientId]/route.ts'),
  read('components/dashboard/client-details-dialog.tsx'),
  read('app/api/crm/clients/[clientId]/plans/route.ts'),
  read('components/dashboard/client-plans-manager.tsx'),
  read('supabase/migrations/20261101162000_client_membership_plans.sql'),
  read('app/locales/pt-copy.ts'),
  read('app/locales/en-copy.ts'),
]);

// Customer lifetime spend is the sum of service price and product total,
// and only completed appointments contribute.
assert.match(
  profile,
  /const servicePrice =\s*Number\(appointment\.service_price \?\? service\?\.price\) \|\| 0/,
);
assert.match(profile, /const productsPrice = Number\(appointment\.value_products\) \|\| 0/);
assert.match(profile, /return servicePrice \+ productsPrice/);
assert.match(profile, /appointment\.service_price \?\? service\?\.price/);
assert.match(profile, /appointment\.status === 'completed'/);
assert.match(detailApi, /getCompletedAppointmentsTotal/);
assert.match(detailApi, /\.eq\('status', 'completed'\)/);
assert.match(detailApi, /\.select\('service_price, value_products'\)/);
assert.equal(
  (detailApi.match(/id, date_hour, status, service_price, value_products/g) ?? []).length,
  2,
);
assert.match(detailApi, /Number\(appointment\.service_price\)/);
assert.match(migration, /add column if not exists service_price numeric\(10,2\)/i);
assert.match(migration, /appointments_sync_service_price/);
assert.match(migration, /set service_price = service\.price/i);
assert.match(detailApi, /\.range\(offset, offset \+ pageSize - 1\)/);
assert.match(detailApi, /totalSpent: completedAppointmentsTotal\.total/);
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
