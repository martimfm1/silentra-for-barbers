import { NextResponse } from 'next/server';
import { BillingService } from '@/services/billing/billing.service';

export async function GET() {
  try {
    const prices = await BillingService.getAvailablePrices();
    return NextResponse.json({ data: prices }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
