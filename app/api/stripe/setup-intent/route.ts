import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import { billingErrorResponse, assertSameOrigin } from '@/services/billing/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();
    if (error || !user?.email)
      return NextResponse.json({ error: 'Não tens sessão iniciada.' }, { status: 401 });
    await BillingService.assertBillingOwner(user.id);
    return NextResponse.json(
      clientSecret: await BillingService.createSetupIntent(user.id, user.email),
    });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
