import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { billingErrorResponse } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
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
