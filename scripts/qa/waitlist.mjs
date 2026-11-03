import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const migration = read('supabase/migrations/20261103233000_customer_booking_waitlist.sql');
const publicApi = read('app/api/shops/[id]/waitlist/route.ts');
const dashboardApi = read('app/api/dashboard/waitlist/route.ts');
const bookingDrawer = read('app/barbershops/components/booking-drawer-canonical.tsx');
const dashboardPage = read('app/dashboard/espera/page.tsx');
const sidebar = read('app/dashboard/_components/DashboardSidebar.tsx');

assert.match(migration, /create table if not exists public\.booking_waitlist/i);
assert.match(migration, /barbershop_id uuid not null references public\.barbershops/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.booking_waitlist from public, anon, authenticated/i);
assert.match(migration, /grant all on table public\.booking_waitlist to service_role/i);
assert.match(migration, /booking_waitlist_active_duplicate_uidx/i);

assert.match(publicApi, /readJsonObject/);
assert.match(publicApi, /isSafePublicBookingDate/);
assert.match(publicApi, /consume_public_rate_limit/);
assert.match(publicApi, /body\.consent !== true/);
assert.match(publicApi, /eq\('barbershop_id', shop\.barbershop_id\)/);
assert.match(publicApi, /eq\('shop_id', shopId\)/);
assert.match(publicApi, /in\('status', \['waiting', 'offered'\]\)/);
assert.match(publicApi, /status: 'waiting'/);

assert.match(dashboardApi, /requireTenantAuthorization/);
assert.match(dashboardApi, /barbershop_member_permissions/);
assert.match(dashboardApi, /resolveAccessPlanForUser/);
assert.match(dashboardApi, /eq\('barbershop_id', access\.tenant\.barbershopId\)/);
assert.match(dashboardApi, /allowedStatuses/);

assert.match(bookingDrawer, /\/api\/shops\/\$\{shop\.id\}\/waitlist/);
assert.match(bookingDrawer, /setWaitlistConsent/);
assert.match(bookingDrawer, /waitlistOnly && !waitlistConsent/);
assert.match(bookingDrawer, /Join the waitlist|Entrar na lista de espera/);
assert.match(dashboardPage, /\/api\/dashboard\/waitlist/);
assert.match(dashboardPage, /Mark booked|Marcar reservada/);
assert.match(sidebar, /\/dashboard\/espera/);

console.log('Customer waitlist contracts passed.');
