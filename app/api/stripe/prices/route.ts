import { NextResponse } from 'next/server';
import { StripePriceService } from '@/services/billing/stripe-price.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
