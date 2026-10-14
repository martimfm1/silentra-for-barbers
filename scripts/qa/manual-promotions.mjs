import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const promotionService = read('lib/billing/manual-promotions.ts');
const previewRoute = read('app/api/billing/manual-promotion/route.ts');
const manualRoute = read('app/api/billing/manual-checkout/route.ts');
const manualService = read('services/billing/manual-payment.service.ts');
const checkoutUi = read('components/billing/manual-checkout.tsx');
const migration = read(
  'supabase/migrations/20261014221500_manual_checkout_promotion_codes.sql',
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
      manualService.includes(
        'quoteManualPrice(input.plan, interval, input.promotionCode)',
      ),
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
    'Environment template documents server-only promotion config',
    envTemplate.includes('MANUAL_PROMO_CODES_JSON=') &&
      envTemplate.includes('type":"percentage'),
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
