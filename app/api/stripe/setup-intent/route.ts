import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  assertSameOrigin,
  billingErrorResponse,
} from '@/services/billing/http';
import { assertStripeBillingAvailableForUser } from '@/services/billing/payment-mode.service';

export const runtime = 'nodejs';

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();

    if (error || !user?.email) {
      return NextResponse.json(
        { error: 'Não tens sessão iniciada.' },
        { status: 401 },
      );
    }

    await BillingService.assertBillingOwner(user.id);
    await assertStripeBillingAvailableForUser(user.id);

    const clientSecret = await BillingService.createSetupIntent(
      user.id,
      user.email,
    );

    return NextResponse.json(
      { clientSecret },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const POST = withApiObservability(
  '/api/stripe/setup-intent',
  POST__unobserved,
);
