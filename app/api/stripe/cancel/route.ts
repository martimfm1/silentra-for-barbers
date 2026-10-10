import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import {
  billingErrorResponse,
  assertSameOrigin,
} from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await BarbershopStripeService.cancelAtPeriodEnd(user.id);
    return NextResponse.json({ cancelAtPeriodEnd: true });
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const POST = withApiObservability('/api/stripe/cancel', POST__unobserved);
