import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import {
  billingErrorResponse,
  assertSameOrigin,
} from '@/services/billing/http';

export const runtime = 'nodejs';

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await BarbershopStripeService.resume(user.id);
    return NextResponse.json({ cancelAtPeriodEnd: false });
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const POST = withApiObservability('/api/stripe/resume', POST__unobserved);
