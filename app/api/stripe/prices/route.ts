import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { StripePriceService } from '@/services/billing/stripe-price.service';
import { getManualPrices } from '@/lib/billing/manual-pricing';
import { PaymentModeService } from '@/services/billing/payment-mode.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETHandler() {
  try {
    const paymentMode = await PaymentModeService.getPaymentMode();
    if (paymentMode === 'MANUAL') {
      return NextResponse.json(
        {
          mode: paymentMode,
          data: getManualPrices().map((price) => ({
            plan: price.plan,
            interval: price.interval,
            unitAmount: Math.round(price.unitAmount * 100),
            currency: price.currency,
          })),
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'public, max-age=60' },
        },
      );
    }

    const prices = await StripePriceService.getAvailablePrices();
    return NextResponse.json(
      { data: prices },
      { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (error) {
    console.error('[STRIPE_PRICES_ERROR]', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return NextResponse.json(
      { error: 'Não foi possível carregar os preços.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}


export const GET = withApiLogging('/api/stripe/prices', GETHandler);
