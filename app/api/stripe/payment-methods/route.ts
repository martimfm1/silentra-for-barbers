import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import { billingErrorResponse, readJsonObject } from '@/services/billing/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
