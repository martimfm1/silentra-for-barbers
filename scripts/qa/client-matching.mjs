import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  profileRoute,
  bookingService,
  clientsService,
  drawer,
  helper,
  customerLookupMigration,
  packageJson,
  workflow,
] = await Promise.all([
  readFile('app/api/bookings/customer-profile/route.ts', 'utf8'),
  readFile('app/dashboard/_services/appointments.service.ts', 'utf8'),
  readFile('app/dashboard/_services/clients.service.ts', 'utf8'),
  readFile('app/barbershops/components/booking-drawer-canonical.tsx', 'utf8'),
  readFile('lib/bookings/public-customer-profile.ts', 'utf8'),
  readFile('supabase/migrations/20261113174709_booking_customer_profile_lookup.sql', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.github/workflows/ci.yml', 'utf8'),
]);

assert.match(
  profileRoute,
  /from\('shops'\)[\s\S]*?select\('barbershop_id,is_active'\)[\s\S]*?\.eq\('id', shopId\)/,
);
assert.match(profileRoute, /barbershopId:\s*shop\.barbershop_id/);
assert.ok(profileRoute.includes('lookup_public_booking_customer'));
assert.ok(profileRoute.includes('verifyLookupToken'));
assert.ok(profileRoute.includes('createDecipheriv'));
assert.ok(profileRoute.includes('createCipheriv'));
assert.ok(profileRoute.includes('consume_public_rate_limit'));
assert.ok(profileRoute.includes(".eq('barbershop_id', tokenPayload.barbershopId)"));
assert.ok(customerLookupMigration.includes('where (select count(*) from matches) = 1'));
assert.ok(customerLookupMigration.includes('public.users'));
assert.ok(customerLookupMigration.includes('from public, anon, authenticated'));
assert.ok(customerLookupMigration.includes('to service_role'));
assert.match(helper, /\.eq\('barbershop_id', input\.barbershopId\)/);
assert.match(helper, /normalizePublicBookingPhone/);
assert.ok(drawer.includes("setCustomerLookupField('email')"));
assert.ok(drawer.includes("setCustomerLookupField('phone')"));
assert.ok(drawer.includes("customerState === 'suggestion'"));
assert.ok(drawer.includes('confirmCustomerProfile'));
assert.ok(drawer.includes('declineCustomerProfile'));
assert.ok(drawer.includes('profileSuggestionEmail'));
assert.ok(drawer.includes('profileSuggestionPhone'));
assert.ok(profileRoute.includes('customerName: displayCustomerName || null'));
assert.ok(profileRoute.includes('.slice(0, 80)'));
assert.ok(drawer.includes('customerSuggestion.customerName'));
assert.ok(drawer.includes('profileSuggestionCustomer'));
assert.ok(drawer.includes('profileSuggestionNameUnavailable'));
assert.ok(drawer.includes("setName((current) => current.trim() || profile.name?.trim() || '')"));
assert.match(
  bookingService,
  /\.eq\('barbershop_id', payload\.barbershop_id\)[\s\S]*?\.eq\('role', 'client'\)[\s\S]*?\.eq\('email', clientEmail\)/,
);
assert.match(bookingService, /client_id: resolvedClientId/);
assert.match(
  clientsService,
  /\.eq\('barbershop_id', resolvedBarbershopId\)[\s\S]*?\.eq\('role', 'client'\)/,
);
assert.match(
  clientsService,
  /Já existe um cliente com este email ou telemóvel nesta barbearia/,
);
assert.equal(
  packageJson.scripts['qa:client-matching'],
  'node scripts/qa/client-matching.mjs',
);
assert.match(packageJson.scripts.qa, /pnpm qa:client-matching/);
assert.match(
  workflow,
  /name: Client matching and tenant isolation contracts\s+run: pnpm qa:client-matching/,
);

console.log(
  'Client matching contracts passed: customer lookup and deduplication are scoped to the selected barbershop.',
);
