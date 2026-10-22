import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const websitePage = read('app/[slug]/page.tsx');
const enterpriseWebsitePage = read('app/site/[slug]/page.tsx');
const websiteRequestApi = read('app/api/dashboard/custom-website/route.ts');
const websiteAdminApi = read('app/api/silentra-admin/custom-websites/[requestId]/route.ts');
const websiteMigration = read('supabase/migrations/20261016180000_enterprise_custom_website_requests.sql');
const publicApi = read('app/api/v1/public/barbershops/[slug]/route.ts');
const publicApiDocs = read('docs/API_PUBLICA.md');
const openApi = read('public/openapi-v1.yaml');
const birthdayApi = read('app/api/messages/birthdays/route.ts');
const birthdayWorker = read('lib/marketing/birthday-delivery.ts');
const marketingCron = read('app/api/cron/marketing/route.ts');
const bookingApi = read('app/api/bookings/route.ts');
const bookingSettings = read('components/dashboard/settings-automatic-booking-panel.tsx');
const bookingSettingsMigration = read('supabase/migrations/20260827133000_automatic_booking_settings.sql');
const bookingRpcMigration = read('supabase/migrations/20260905150000_finalize_atomic_booking_contract.sql');
const completionMigration = read('supabase/migrations/20260827134500_enable_booking_completion_worker.sql');
const completionSchedule = read('supabase/migrations/20260827180000_schedule_booking_completion_with_pg_cron.sql');
const completionCronApi = read('app/api/cron/booking-completion/route.ts');
const vercel = JSON.parse(read('vercel.json'));

assert.match(websiteRequestApi, /require\(['"]@\/services\/billing\/barbershop-stripe\.service|BarbershopStripeService/);
assert.match(websiteRequestApi, /custom_website_requests/);
assert.match(websiteRequestApi, /assertSameOrigin/);
assert.match(websiteAdminApi, /requirePlatformAdmin/);
assert.match(websiteAdminApi, /update\.status/);
assert.match(websiteAdminApi, /nextStatus === 'published'/);
assert.match(websitePage, /getPublishedWebsite/);
assert.match(websitePage, /eq\('status', 'published'\)/);
assert.match(websitePage, /notFound\(\)/);
assert.match(enterpriseWebsitePage, /barbershop_landing_pages/);
assert.match(websiteMigration, /custom_website_requests_one_active_per_shop/);
assert.match(websiteMigration, /enable row level security/i);

assert.match(publicApi, /consumePublicRateLimit/);
assert.match(publicApi, /Access-Control-Allow-Origin/);
assert.match(publicApi, /if-none-match/);
assert.match(publicApi, /ETag: etag/);
assert.match(publicApi, /'Cache-Control': PUBLIC_CACHE/);
assert.match(publicApiDocs, /GET \/api\/v1\/public\/barbershops\/\{slug\}/);
assert.match(openApi, /openapi: 3\.1\.0/);
assert.match(openApi, /PublicBarbershopResponse/);

assert.match(birthdayApi, /trigger_type: 'birthday'/);
assert.match(birthdayApi, /active: enabled/);
assert.match(birthdayWorker, /\.eq\('trigger_type', 'birthday'\)/);
assert.match(birthdayWorker, /claimCampaign\(campaign, today\)/);
assert.match(birthdayWorker, /birthday:\$\{birthdayDate\}/);
assert.match(birthdayWorker, /status === 'sent'/);
assert.match(marketingCron, /processBirthdayCampaignDelivery/);
assert.match(marketingCron, /CRON_SECRET/);
assert.ok(vercel.crons.some((job) => job.path === '/api/cron/marketing'));

assert.match(bookingApi, /'create_booking_atomic'/);
assert.match(bookingApi, /p_status: 'pending'/);
assert.match(bookingApi, /appointment\.status === 'scheduled'/);
assert.match(bookingSettings, /auto_confirm_bookings/);
assert.match(bookingSettings, /auto_complete_bookings/);
assert.match(bookingSettings, /barbershopService\.updateConfig/);
assert.match(bookingSettingsMigration, /auto_confirm_bookings boolean not null default false/);
assert.match(bookingSettingsMigration, /auto_complete_bookings boolean not null default false/);
assert.match(bookingRpcMigration, /coalesce\(b\.auto_confirm_bookings, false\)/);
assert.match(bookingRpcMigration, /if v_auto_confirm then/);
assert.match(bookingRpcMigration, /v_status := 'scheduled'/);

assert.match(completionMigration, /process_automatic_booking_completion/);
assert.match(completionMigration, /auto_complete_bookings/);
assert.match(completionMigration, /a\.status = 'scheduled'/);
assert.match(completionMigration, /a\.date_hour[\s\S]*<= now\(\)/);
assert.match(completionSchedule, /cron\.schedule\(/);
assert.match(completionSchedule, /silentra-booking-completion/);
assert.match(completionSchedule, /\*\/10 \* \* \* \*/);
assert.match(completionCronApi, /CRON_SECRET/);
assert.match(completionCronApi, /process_automatic_booking_completion/);

console.log('Custom websites, public API, birthday automation, auto-confirmation and auto-completion contracts passed.');
