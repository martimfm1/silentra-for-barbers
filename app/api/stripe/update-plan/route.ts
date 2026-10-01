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
    await BillingService.assertBillingOwner(user.id);
    const { newPriceId } = await readJsonObject(request);
    if (typeof newPriceId !== 'string')
      return NextResponse.json(
        { error: 'newPriceId is required.' },
        { status: 400 },
      );
    await BillingService.updatePlan(user.id, newPriceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
