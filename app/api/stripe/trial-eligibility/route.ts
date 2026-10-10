import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import {
  NEW_MEMBER_PRO_OFFER_MONTHS,
  NEW_MEMBER_PRO_PROMOTION_CODE,
} from '@/lib/stripe/constants';
import { PaymentModeService } from '@/services/billing/payment-mode.service';

export const runtime = 'nodejs';

async function GET__unobserved() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json({ eligible: false }, { status: 401 });

    if ((await PaymentModeService.getPaymentMode()) === 'MANUAL') {
      return NextResponse.json(
        {
          eligible: false,
          offerMonths: NEW_MEMBER_PRO_OFFER_MONTHS,
          promotionCode: null,
          plan: 'pro',
          paymentMode: 'MANUAL',
        },
        {
          headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        },
      );
    }

    const eligible = await BillingService.isEligibleForProTrial(user.id);
    return NextResponse.json(
      {
        eligible,
        offerMonths: NEW_MEMBER_PRO_OFFER_MONTHS,
        promotionCode: eligible ? NEW_MEMBER_PRO_PROMOTION_CODE : null,
        plan: 'pro',
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json({ eligible: false }, { status: 500 });
  }
}

export const GET = withApiObservability(
  '/api/stripe/trial-eligibility',
  GET__unobserved,
);
