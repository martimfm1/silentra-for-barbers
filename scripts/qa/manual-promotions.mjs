import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const promotionService = read('lib/billing/manual-promotions.ts');
const previewRoute = read('app/api/billing/manual-promotion/route.ts');
const stripeCheckout = read('app/api/stripe/embedded-checkout/route.ts');
const manualRoute = read('app/api/billing/manual-checkout/route.ts');
const manualService = read('services/billing/manual-payment.service.ts');
const checkoutUi = read('components/billing/manual-checkout.tsx');
const migration = read(
  'supabase/migrations/20261014221500_manual_checkout_promotion_codes.sql',
);
const trialMigration = read(
  'supabase/migrations/20261014223000_manual_trialpro_free_month.sql',
);
const envTemplate = read('.env.example');

const checks = [
  [
    'Promotions are configured only on the server',
    promotionService.includes('process.env.MANUAL_PROMO_CODES_JSON') &&
      promotionService.includes('JSON.parse(raw)') &&
      !promotionService.includes('NEXT_PUBLIC_MANUAL_PROMO'),
  ],
  [
    'Promotion codes are normalized and scope-checked',
    promotionService.includes('toUpperCase()') &&
      promotionService.includes('promotion.plans') &&
      promotionService.includes('promotion.intervals'),
  ],
  [
    'Discounts use server-resolved manual pricing',
    promotionService.includes('getManualPrice(plan, interval)') &&
      promotionService.includes('originalCents - discountCents'),
  ],
  [
    'Preview endpoint requires same-origin and authenticated user',
    previewRoute.includes('assertSameOrigin(request)') &&
      previewRoute.includes('supabase.auth.getUser()') &&
      previewRoute.includes('verifyCheckoutIntent(token)'),
  ],
  [
    'Preview response is never cached',
    previewRoute.includes("'Cache-Control': 'no-store'"),
  ],
  [
    'Final manual request validates the code again',
    manualRoute.includes('promotionCode,') &&
      manualRoute.includes('assertSameOrigin(request)') &&
      manualService.includes('quoteManualPrice(') &&
      manualService.includes('newMemberEligible: trialEligible') &&
      manualService.includes('isEligibleForManualProTrial'),
  ],
  [
    'Stored request price is the final discounted total',
    manualService.includes('price: quote.finalPrice') &&
      manualService.includes('original_price: quote.originalPrice') &&
      manualService.includes('discount_amount: quote.discountAmount') &&
      manualService.includes('promotion_code: quote.promotionCode'),
  ],
  [
    'Promotion input is shown and applied by the manual checkout UI',
    checkoutUi.includes('Código promocional') &&
      checkoutUi.includes('/api/billing/manual-promotion') &&
      checkoutUi.includes('promotionCode: appliedPromotionCode') &&
      checkoutUi.includes('pricing.finalPrice'),
  ],
  [
    'Database stores auditable promotion price snapshots',
    migration.includes('original_price') &&
      migration.includes('discount_amount') &&
      migration.includes('promotion_code') &&
      migration.includes('subscription_requests_promotion_price_consistent'),
  ],
  [
    'Environment template configures TRIALPRO for Pro monthly only',
    envTemplate.includes('MANUAL_PROMO_CODES_JSON=') &&
      envTemplate.includes('"TRIALPRO":{"type":"free_month"') &&
      envTemplate.includes('"plans":["pro"]') &&
      envTemplate.includes('"intervals":["month"]'),
  ],
  [
    'TRIALPRO cannot be redeemed without backend eligibility',
    promotionService.includes("type === 'free_month'") &&
      promotionService.includes('options.newMemberEligible') &&
      previewRoute.includes('isEligibleForManualProTrial') &&
      manualService.includes('isEligibleForManualProTrial'),
  ],
  [
    'TRIALPRO redemption is atomically activated without payment',
    manualService.includes("admin.rpc('redeem_manual_pro_trial'") &&
      trialMigration.includes(
        'create or replace function public.redeem_manual_pro_trial',
      ) &&
      trialMigration.includes("status = 'TRIAL'") &&
      trialMigration.includes("'trialing'"),
  ],
  [
    'Stripe TRIALPRO is restricted to new Pro monthly customers',
    stripeCheckout.includes("intent.interval === 'month'") &&
      stripeCheckout.includes('requestedPlan === PLANS.PRO') &&
      stripeCheckout.includes('!hasBillingHistory'),
  ],
  [
    'Trial expiry is handled by the manual subscription worker',
    trialMigration.includes("status in ('active', 'trialing')") &&
      trialMigration.includes("r.status in ('PAID', 'TRIAL')"),
  ],
];

for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) {
  throw new Error(
    `Manual promotion contract checks failed: ${checks
      .filter(([, passed]) => !passed)
      .map(([name]) => name)
      .join(', ')}`,
  );
}

console.log(
  `Manual promotion contract checks passed: ${checks.length} checks.`,
);
