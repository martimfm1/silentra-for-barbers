import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  billingErrorResponse,
  readJsonObject,
  assertSameOrigin,
} from '@/services/billing/http';
import { assertUserHasStripeSubscription } from '@/services/billing/payment-mode.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      return NextResponse.json(
        { error: 'Não tens sessão iniciada.' },
        { status: 401 },
      );

    await BillingService.assertBillingOwner(user.id);
    await assertUserHasStripeSubscription(user.id);

    const body = await readJsonObject(request);
    const plan = body.plan;
    const interval = body.interval;

    if (plan !== 'pro' && plan !== 'enterprise')
      return NextResponse.json(
        { error: 'O plano selecionado não é válido.', code: 'INVALID_PRICE' },
        { status: 400 },
      );

    if (interval !== undefined && interval !== 'month' && interval !== 'year')
      return NextResponse.json(
        {
          error: 'O período de faturação selecionado não é válido.',
          code: 'INVALID_PRICE',
        },
        { status: 400 },
      );

    await BillingService.updatePlan(
      user.id,
      plan,
      interval === 'year' ? 'year' : 'month',
    );

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}
