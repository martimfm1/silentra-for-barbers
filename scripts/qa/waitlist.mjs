import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const migration = read('supabase/migrations/20261103233000_customer_booking_waitlist.sql');
const offersMigration = read('supabase/migrations/20261103235000_automatic_booking_waitlist_offers.sql');
const offersWorker = read('app/api/cron/booking-waitlist-offers/route.ts');
const dashboardPage = read('app/dashboard/espera/page.tsx');
const publicApi = read('app/api/shops/[id]/waitlist/route.ts');
const dashboardApi = read('app/api/dashboard/waitlist/route.ts');
const bookingDrawer = read('app/barbershops/components/booking-drawer-canonical.tsx');
const sidebar = read('app/dashboard/_components/DashboardSidebar.tsx');

assert.match(migration, /create table if not exists public\.booking_waitlist/i);
assert.match(migration, /barbershop_id uuid not null references public\.barbershops/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.booking_waitlist from public, anon, authenticated/i);
assert.match(migration, /grant all on table public\.booking_waitlist to service_role/i);
assert.match(migration, /booking_waitlist_active_duplicate_uidx/i);
assert.match(migration, /offered_date date/i);
assert.match(migration, /offered_time time/i);

assert.match(offersMigration, /create table if not exists public\.booking_waitlist_vacancies/i);
assert.match(offersMigration, /appointments_enqueue_waitlist_vacancy/i);
assert.match(offersMigration, /appointments_sync_booking_waitlist_vacancies/i);
assert.match(offersMigration, /new\.date_hour at time zone 'UTC'/i);
assert.match(offersMigration, /::timestamp at time zone 'UTC'/i);
assert.match(offersMigration, /now\(\) at time zone 'Europe\/Lisbon'/i);
assert.match(offersMigration, /claim_booking_waitlist_vacancies/i);
assert.match(offersMigration, /sync_booking_waitlist_offer_status/i);
assert.match(offersMigration, /booking_waitlist_sync_offer_status/i);
assert.match(offersMigration, /recover_stale_booking_waitlist_offers/i);
assert.match(offersMigration, /release_booking_waitlist_offer/i);
assert.match(offersMigration, /complete_booking_waitlist_offer_delivery/i);
assert.match(offersMigration, /silentra-booking-waitlist-offers/i);
assert.match(offersMigration, /for update skip locked/i);
assert.match(offersMigration, /slot_time < v_vacancy\.slot_time \+ make_interval/i);
assert.match(offersMigration, /other\.professional_id is null/i);
assert.match(offersMigration, /An overlapping offer is still active/i);
assert.match(offersMigration, /interval '20 minutes'/i);

assert.match(offersWorker, /withApiObservability/);
assert.match(offersWorker, /claim_booking_waitlist_vacancies/);
assert.match(offersWorker, /sendBrevoEmail/);
assert.match(offersWorker, /complete_booking_waitlist_offer_delivery/);
assert.match(offersWorker, /release_booking_waitlist_offer/);
assert.match(offersWorker, /booking-waitlist-offers/);
assert.match(dashboardApi, /offered_date,offered_time/);
assert.match(dashboardPage, /Proposed opening:|Vaga proposta:/);

assert.match(publicApi, /readJsonObject/);
assert.match(publicApi, /isSafePublicBookingDate/);
assert.match(publicApi, /consumePublicRateLimit/);
assert.match(publicApi, /customer-waitlist/);
assert.match(publicApi, /withApiObservability/);
assert.match(publicApi, /body\.consent !== true/);
assert.match(publicApi, /eq\('barbershop_id', shop\.barbershop_id\)/);
assert.match(publicApi, /eq\('shop_id', shopId\)/);
assert.match(publicApi, /in\('status', \['waiting', 'offered'\]\)/);
assert.match(publicApi, /status: 'waiting'/);

assert.match(dashboardApi, /withApiObservability/);
assert.match(dashboardApi, /requireTenantAuthorization/);
assert.match(dashboardApi, /barbershop_member_permissions/);
assert.match(dashboardApi, /resolveAccessPlanForUser/);
assert.match(dashboardApi, /eq\('barbershop_id', access\.tenant\.barbershopId\)/);
assert.match(dashboardApi, /allowedStatuses/);
assert.match(dashboardApi, /!\['booked', 'cancelled', 'expired'\]\.includes\(status\)/);

assert.match(bookingDrawer, /\/api\/shops\/\$\{shop\.id\}\/waitlist/);
assert.match(bookingDrawer, /selectedDate/);
assert.match(bookingDrawer, /selectedTime/);
assert.match(bookingDrawer, /selectedProfessionalId/);
assert.match(bookingDrawer, /hasCompleteOffer/);
assert.match(offersWorker, /searchParams\.set\('service'/);
assert.match(offersWorker, /searchParams\.set\('date'/);
assert.match(offersWorker, /searchParams\.set\('time'/);
assert.match(offersWorker, /searchParams\.set\('professional'/);
assert.match(bookingDrawer, /setWaitlistConsent/);
assert.match(bookingDrawer, /waitlistOnly && !waitlistConsent/);
assert.match(bookingDrawer, /Join the waitlist|Entrar na lista de espera/);
assert.match(dashboardPage, /\/api\/dashboard\/waitlist/);
assert.match(dashboardPage, /Mark booked|Marcar reservada/);
assert.match(sidebar, /\/dashboard\/espera/);
assert.match(read('docs/WAITLIST.md'), /20 minutos/);
assert.match(read('docs/WAITLIST.md'), /não fica reservada/);

console.log('Customer waitlist contracts passed.');
