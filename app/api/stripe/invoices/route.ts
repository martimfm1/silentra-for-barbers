import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { assertStripeBillingAvailableForUser } from '@/services/billing/payment-mode.service';
import { billingErrorResponse } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GET__unobserved() {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await assertStripeBillingAvailableForUser(user.id);

    return NextResponse.json(
      { invoices: await BarbershopStripeService.getInvoices(user.id) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const GET = withApiObservability(
  '/api/stripe/invoices',
  GET__unobserved,
);
