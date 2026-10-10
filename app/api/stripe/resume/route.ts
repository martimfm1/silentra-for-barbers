import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import {
  billingErrorResponse,
  assertSameOrigin,
} from '@/services/billing/http';

export const runtime = 'nodejs';

async function POSTHandler(request: Request) {
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

export const POST = withApiLogging('/api/stripe/resume', POSTHandler);
