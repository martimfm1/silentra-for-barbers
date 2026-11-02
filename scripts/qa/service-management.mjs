import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [
  migration,
  serviceCard,
  servicePage,
  serviceHook,
  serviceRepository,
  bookingApi,
  bookingDataApi,
  publicApi,
  publicV1Api,
  agendaPage,
  posPage,
  serviceTypes,
  referenceMigration,
] = await Promise.all([
  read('supabase/migrations/20261102114554_service_archiving_and_client_crm_metrics.sql'),
  read('app/dashboard/_components/cards/ServicesListCard.tsx'),
  read('app/dashboard/servicos/page.tsx'),
  read('app/state/_hooks/dashboard/useServices.ts'),
  read('app/dashboard/_services/services.service.ts'),
  read('app/api/bookings/route.ts'),
  read('app/api/shops/[id]/booking-data/route.ts'),
  read('app/api/public/barbershops/[slug]/route.ts'),
  read('app/api/v1/public/barbershops/[slug]/route.ts'),
  read('app/agendadovictor/page.tsx'),
  read('app/dashboard/pos/page.tsx'),
  read('types/dashboard/entities.ts'),
  read('supabase/migrations/20261102115012_preserve_service_appointment_references.sql'),
]);

assert.match(migration, /add column if not exists is_active boolean not null default true/i);
assert.match(migration, /services_price_non_negative/);
assert.match(migration, /services_duration_valid/);
assert.match(migration, /get_client_crm_metrics/);
assert.match(migration, /appointment_count/);
assert.match(migration, /total_spent/);
assert.match(migration, /last_visit/);
assert.match(referenceMigration, /on delete restrict/i);
assert.match(referenceMigration, /validate constraint appointments_service_id_fkey/i);

assert.match(serviceCard, /statusFilter/);
assert.match(serviceCard, /'active' \| 'inactive'/);
assert.match(serviceCard, /handleToggleServiceActive/);
assert.match(serviceCard, /service\.is_active === false/);
assert.match(servicePage, /handleToggleServiceActive=\{handleToggleServiceActive\}/);
assert.match(serviceHook, /price < 0/);
assert.match(serviceHook, /duration > 1440/);
assert.match(serviceHook, /is_active: service\.is_active === false/);
assert.match(serviceRepository, /linkedAppointments/);
assert.match(serviceRepository, /serviço tem marcações associadas/i);
assert.match(serviceTypes, /is_active\?: boolean/);

for (const source of [bookingApi, bookingDataApi, publicApi, publicV1Api, agendaPage, posPage]) {
  assert.match(source, /is_active/);
}
assert.match(bookingApi, /\.eq\('is_active', true\)/);
assert.match(bookingDataApi, /\.eq\('is_active', true\)/);
assert.match(publicApi, /\.eq\('is_active', true\)/);
assert.match(publicV1Api, /\.eq\('is_active', true\)/);

console.log('[SERVICE_MANAGEMENT_QA] archiving, filtering, validation and booking history protection passed');
