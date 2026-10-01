import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  assertStripeBillingAvailableForUser,
} from '@/services/billing/payment-mode.service';
import { billingErrorResponse } from '@/services/billing/http';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const {
      data: { user },
      error,
    } = await (await createClient()).auth.getUser();

    if (error || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    await assertStripeBillingAvailableForUser(user.id);

    const clientSecret = await BillingService.createSetupIntent(
      user.id,
      user.email,
    );

    return NextResponse.json(
      { clientSecret },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}
