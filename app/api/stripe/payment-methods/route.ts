import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  assertSameOrigin,
  billingErrorResponse,
  readJsonObject,
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

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await assertStripeBillingAvailableForUser(user.id);

    const body = await readJsonObject(request);

    if (!body.action) {
      return NextResponse.json({
        paymentMethods: await BillingService.getPaymentMethods(user.id),
      });
    }

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

export const POST = withApiObservability('/api/stripe/payment-methods', POST__unobserved);
