import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const requiredFiles = [
  'supabase/migrations/20261001190000_manual_payment_mode.sql',
  'services/billing/payment-mode.service.ts',
  'services/billing/manual-payment.service.ts',
  'lib/billing/manual-pricing.ts',
  'app/api/billing/subscribe/route.ts',
  'app/api/_silentra-admin/payment-mode/route.ts',
  'app/api/_silentra-admin/subscription-requests/route.ts',
  'app/api/_silentra-admin/subscription-requests/[requestId]/route.ts',
  'app/api/cron/manual-subscriptions/route.ts',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required manual billing file: ${file}`);
  }
}

const migration = read('supabase/migrations/20261001190000_manual_payment_mode.sql');
const subscribe = read('app/api/billing/subscribe/route.ts');
const embedded = read('app/api/stripe/embedded-checkout/route.ts');
const modeService = read('services/billing/payment-mode.service.ts');
const manualService = read('services/billing/manual-payment.service.ts');
const pricingCard = read('components/billing/PricingCard.tsx');
const cron = read('app/api/cron/manual-subscriptions/route.ts');
const vercel = read('vercel.json');

const checks = [
  ['Default payment mode is MANUAL', modeService.includes("DEFAULT_PAYMENT_MODE: PaymentMode = 'MANUAL'")],
  ['Persistent payment_mode row exists', migration.includes("values ('payment_mode', 'MANUAL')")],
  ['Manual request history exists', migration.includes('create table if not exists public.subscription_requests')],
  ['Manual request is service-role controlled', migration.includes('alter table public.subscription_requests enable row level security')],
  ['Manual payment link is URL validated', manualService.includes("['http:', 'https:'].includes(parsed.protocol)")],
  ['Manual price is server resolved', manualService.includes('getManualPrice(input.plan, interval)')],
  ['Manual mode never enters Stripe creation branch', subscribe.includes("if (useManualFlow)") && !subscribe.slice(subscribe.indexOf('if (useManualFlow)'), subscribe.indexOf('const prices = await BillingService.getAvailablePrices()')).includes('getStripeClient')],
  ['Stripe checkout is server blocked in manual mode', embedded.includes('PAYMENT_MODE_STRIPE_DISABLED')],
  ['Manual active subscriptions are isolated from Stripe', embedded.includes('existingIsManual')],
  ['PricingCard does not accept Stripe priceId', !pricingCard.includes('priceId')],
  ['Manual expiry cron exists', cron.includes("expire_manual_subscriptions")],
  ['Manual expiry cron is configured', vercel.includes('/api/cron/manual-subscriptions')],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) {
  throw new Error('Manual payment contract checks failed.');
}

console.log(`Manual payment contract checks passed: ${checks.length} checks.`);
