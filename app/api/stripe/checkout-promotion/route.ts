import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GET__unobserved() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ applied: false }, { status: 401 });

    const database = createAdminClient();
    const { data: userRow, error: userError } = await database
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (
      userError ||
      !userRow?.barbershop_id ||
      String(userRow.role ?? '').toLowerCase() !== 'owner'
    ) {
      return NextResponse.json({ applied: false });
    }

    const { data: billingAccount, error: billingAccountError } = await database
      .from('barbershop_billing_accounts')
      .select('stripe_customer_id')
      .eq('barbershop_id', userRow.barbershop_id)
      .maybeSingle();

    if (billingAccountError || !billingAccount?.stripe_customer_id) {
      return NextResponse.json({ applied: false });
    }

    const sessions = await getStripeClient().checkout.sessions.list({
      customer: billingAccount.stripe_customer_id,
      status: 'complete',
      limit: 10,
    });

    const session = [...sessions.data]
      .filter(
        (item) => item.mode === 'subscription' && Boolean(item.subscription),
      )
      .sort((a, b) => b.created - a.created)[0];

    if (!session?.discounts?.length) {
      return NextResponse.json(
        { applied: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const discount = session.discounts[0];
    const promotionCodeId =
      typeof discount.promotion_code === 'string'
        ? discount.promotion_code
        : (discount.promotion_code?.id ?? null);

    let code: string | null = null;
    let percentOff: number | null = null;
    let amountOff: number | null = null;
    let currency: string | null = session.currency?.toUpperCase() ?? null;

    if (promotionCodeId) {
      const promotionCode = await getStripeClient().promotionCodes.retrieve(
        promotionCodeId,
        { expand: ['promotion.coupon'] },
      );

      code = promotionCode.code;

      const promotion = promotionCode.promotion;
      if (promotion && promotion.type === 'coupon') {
        const coupon = promotion.coupon;

        if (coupon) {
          const couponId = typeof coupon === 'string' ? coupon : coupon.id;

          if (typeof coupon === 'string') {
            const resolvedCoupon =
              await getStripeClient().coupons.retrieve(couponId);
            if (!resolvedCoupon.deleted) {
              percentOff = resolvedCoupon.percent_off ?? null;
              amountOff = resolvedCoupon.amount_off ?? null;
              currency = resolvedCoupon.currency?.toUpperCase() ?? currency;
            }
          } else if (!coupon.deleted) {
            percentOff = coupon.percent_off ?? null;
            amountOff = coupon.amount_off ?? null;
            currency = coupon.currency?.toUpperCase() ?? currency;
          }
        }
      }
    }

    const amountDiscount =
      session.total_details?.amount_discount ?? amountOff ?? 0;

    return NextResponse.json(
      {
        applied: true,
        code,
        discountAmount: amountDiscount,
        currency,
        percentOff,
        amountOff,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { applied: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/stripe/checkout-promotion',
  GET__unobserved,
);
