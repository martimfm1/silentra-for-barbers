import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const requiredFiles = [
  'supabase/migrations/20261001190000_manual_payment_mode.sql',
  'supabase/migrations/20261003120000_harden_manual_payment_confirmation.sql',
  'services/billing/payment-mode.service.ts',
  'services/billing/manual-payment.service.ts',
  'lib/billing/manual-pricing.ts',
  'app/api/billing/subscribe/route.ts',
  'app/api/silentra-admin/payment-mode/route.ts',
  'app/api/silentra-admin/subscription-requests/route.ts',
  'app/api/silentra-admin/subscription-requests/[requestId]/route.ts',
  'app/api/cron/manual-subscriptions/route.ts',
  'supabase/migrations/20261006132715_manual_payment_documents.sql',
  'services/billing/manual-payment-document.ts',
  'services/billing/manual-payment-document.service.ts',
  'app/api/billing/documents/[documentId]/route.ts',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required manual billing file: ${file}`);
  }
}

const migration = read('supabase/migrations/20261001190000_manual_payment_mode.sql');
const confirmationMigration = read('supabase/migrations/20261003120000_harden_manual_payment_confirmation.sql');
const subscribe = read('app/api/billing/subscribe/route.ts');
const embedded = read('app/api/stripe/embedded-checkout/route.ts');
const modeService = read('services/billing/payment-mode.service.ts');
const manualService = read('services/billing/manual-payment.service.ts');
const pricingCard = read('components/billing/PricingCard.tsx');
const cron = read('app/api/cron/manual-subscriptions/route.ts');
const vercel = read('vercel.json');
const documentsMigration = read('supabase/migrations/20261006132715_manual_payment_documents.sql');
const documentService = read('services/billing/manual-payment-document.service.ts');
const brevo = read('lib/email/brevo.ts');

const checks = [
  ['Default payment mode is MANUAL', modeService.includes("DEFAULT_PAYMENT_MODE: PaymentMode = 'MANUAL'")],
  ['Persistent payment_mode row exists', migration.includes("values ('payment_mode', 'MANUAL')")],
  ['Manual request history exists', migration.includes('create table if not exists public.subscription_requests')],
  ['Manual request is service-role controlled', migration.includes('alter table public.subscription_requests enable row level security')],
  ['Manual payment link is URL validated', manualService.includes("parsed.protocol !== 'https:'")],
  ['Manual price is server resolved', manualService.includes('getManualPrice(input.plan, interval)')],
  ['Manual mode never enters Stripe creation branch', (() => { const start = subscribe.indexOf('if (useManualFlow)'); const end = subscribe.indexOf('// The Stripe price is resolved and validated exclusively on the server.'); return start >= 0 && end > start && !subscribe.slice(start, end).includes('getStripeClient'); })()],
  ['Stripe checkout is server blocked in manual mode', embedded.includes('PAYMENT_MODE_STRIPE_DISABLED')],
  ['Manual active subscriptions are isolated from Stripe', embedded.includes('existingIsManual')],
  ['PricingCard does not accept Stripe priceId', !pricingCard.includes('priceId')],
  ['Manual expiry cron exists', cron.includes("expire_manual_subscriptions")],
  ['Manual expiry cron is configured', vercel.includes('/api/cron/manual-subscriptions')],
  ['Admin page renders manual-payment console', read('app/silentra-admin/page.tsx').includes('PlatformAdminConsole')],
  ['Admin email carries request deep link', manualService.includes("request_id") && manualService.includes('adminUrl')],
  ['Billing summary reads payment_method', read('app/api/stripe/billing-summary/route.ts').includes('payment_method, updated_at')],
  ['Manual cancellation is server-side', read('services/billing/barbershop-stripe.service.ts').includes('MANUAL_SUBSCRIPTION_CANCELLATION_REQUESTED')],
  ['Manual cancellation API keeps CSRF protection', read('app/api/silentra-admin/subscription-requests/[requestId]/route.ts').includes('assertSameOrigin')],
  ['Manual confirmation RPC hardening is tracked', confirmationMigration.includes('USER_SUBSCRIPTION_TENANT_CONFLICT') && confirmationMigration.includes("notify pgrst, 'reload schema'")],
  ['Manual payment documents are idempotent', documentsMigration.includes('manual_request_id uuid not null unique') && documentsMigration.includes('create_manual_payment_document')],
  ['Manual receipt PDF generation exists', documentService.includes('generateManualPaymentReceiptPdf')],
  ['Manual receipt email has PDF attachment', documentService.includes('attachments:') && brevo.includes('attachment:input.attachments.map')],
  ['Manual receipt resend endpoint exists', read('app/api/billing/documents/[documentId]/route.ts').includes('ManualPaymentDocumentService.sendReceipt')],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) {
  throw new Error(`Manual payment contract checks failed: ${checks.filter(([, passed]) => !passed).map(([name]) => name).join(', ')}`);
}

console.log(`Manual payment contract checks passed: ${checks.length} checks.`);
