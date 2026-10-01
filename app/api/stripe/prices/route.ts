import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing/billing.service';
import { getManualPrices } from '@/lib/billing/manual-pricing';
import { PaymentModeService } from '@/services/billing/payment-mode.service';

export async function GET() {
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

    const prices = await BillingService.getAvailablePrices();
    return NextResponse.json(
      { mode: paymentMode, data: prices },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=60' },
      },
    );
  } catch (error) {
    console.error(
      '[PRICES_API_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível carregar os preços.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
