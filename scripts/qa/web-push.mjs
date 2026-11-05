import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [worker, provider, route, testRoute, panel, bookingNotification, migration, docs, packageJson] = await Promise.all([
  read('public/sw.js'),
  read('lib/notifications/providers/push.ts'),
  read('app/api/notifications/push/route.ts'),
  read('app/api/notifications/push/test/route.ts'),
  read('components/dashboard/settings-push-notifications-panel.tsx'),
  read('lib/brevo/barber-booking-notification.ts'),
  read('supabase/migrations/20261103012254_web_push_subscriptions.sql'),
  read('docs/WEB_PUSH.md'),
  read('package.json'),
]);

assert.match(worker, /addEventListener\('push'/);
assert.match(worker, /addEventListener\('notificationclick'/);
assert.match(provider, /Content-Encoding': 'aes128gcm'/);
assert.match(provider, /VAPID_PRIVATE_KEY/);
assert.match(provider, /notification_subscriptions/);
assert.match(route, /requireTenantAuthorization/);
assert.match(route, /onConflict: 'endpoint'/);
assert.match(route, /action === 'status'/);
assert.match(route, /isAllowedPushEndpoint/);
assert.match(testRoute, /sendWebPushToUser/);
assert.match(panel, /Notification\.requestPermission\(\)/);
assert.match(panel, /isIosHomeScreenApp/);
assert.match(panel, /Safari tabs cannot receive iPhone web push/);
assert.match(bookingNotification, /sendWebPushToUsers/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.notification_subscriptions/i);
assert.match(docs, /VAPID_PRIVATE_KEY/);
assert.equal(JSON.parse(packageJson).scripts['qa:push'], 'node scripts/qa/web-push.mjs');

console.log('[WEB_PUSH_QA] worker, VAPID delivery, tenant APIs, subscription UI and migration contracts passed');
