import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  assertSameOrigin,
  billingErrorResponse,
  readJsonObject,
} from '@/services/billing/http';

export const runtime = 'nodejs';

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
    const body = await readJsonObject(request);
    if (!body.action)
      return NextResponse.json({
        paymentMethods: await BillingService.getPaymentMethods(user.id),
      });
    if (
      (body.action !== 'set_default' && body.action !== 'remove') ||
      typeof body.paymentMethodId !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid payment method request.' },
        { status: 400 },
      );
    }
    await BillingService.updatePaymentMethod(
      user.id,
      body.action,
      body.paymentMethodId,
    );
    return NextResponse.json({
      paymentMethods: await BillingService.getPaymentMethods(user.id),
    });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
