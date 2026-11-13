import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route, templates, migration, vercel] = await Promise.all([
  readFile('app/api/cron/subscription-expiry-reminders/route.ts', 'utf8'),
  readFile('services/billing/email-templates.ts', 'utf8'),
  readFile('supabase/migrations/20261111230000_subscription_expiry_email_reminders.sql', 'utf8'),
  readFile('vercel.json', 'utf8').then(JSON.parse),
]);

assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /claim_subscription_expiry_reminder_events/);
assert.match(route, /sendEmail\(/);
assert.match(route, /role \?\? ''\)\.toLowerCase\(\) !== 'owner'/);
assert.match(route, /payment_method === 'MANUAL'/);
assert.match(route, /payment_method === 'STRIPE'[\s\S]*?cancel_at_period_end === true/);
assert.match(route, /plan_override !== null/);
assert.match(route, /activeAssignments\.has\(subscription\.barbershop_id\)/);
assert.match(route, /billingAccount\?\.billing_owner_user_id === owner\.id/);
assert.match(route, /MAX_ATTEMPTS = 8/);
assert.match(route, /status: exhausted \? 'failed' : 'pending'/);
assert.match(route, /status: 'sent'/);
assert.match(route, /status: 'skipped'/);
assert.match(route, /PROCESS_CONCURRENCY = 10/);
assert.match(templates, /customerSubscriptionExpiryReminderEmail/);
assert.match(templates, /daysRemaining: 1 \| 3 \| 7/);
assert.match(templates, /timeZone: 'Europe\/Lisbon'/);
assert.match(templates, /Your subscription ends tomorrow/);
assert.match(templates, /A tua subscrição termina amanhã/);
assert.match(templates, /lang: isEnglish \? 'en' : 'pt'/);
assert.match(migration, /unique \(subscription_id, period_end, days_before\)/);
assert.match(migration, /check \(days_before in \(7, 3, 1\)\)/);
assert.match(migration, /Europe\/Lisbon/);
assert.match(migration, /for update skip locked/i);
assert.match(migration, /grant execute on function public\.claim_subscription_expiry_reminder_events\(integer\)[\s\S]*?to service_role/i);
assert.ok(
  vercel.crons.some(
    (cron) =>
      cron.path === '/api/cron/subscription-expiry-reminders' &&
      cron.schedule === '25 0 * * *',
  ),
  'Subscription expiry reminder cron must run daily at 00:25 UTC.',
);
console.log('Subscription expiry email reminder contracts passed.');
