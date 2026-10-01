import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { BillingError } from '@/types/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const database = createAdminClient();
    const { data: owner, error: ownerError } = await database
      .from('users')
      .select('barbershop_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (ownerError)
      throw new BillingError(
        'Could not resolve billing owner.',
        'DB_READ_FAILED',
      );
    if (
      !owner?.barbershop_id ||
      String(owner.role ?? '').toLowerCase() !== 'owner'
    ) {
      throw new BillingError(
        'Only the barbershop owner can change the subscription.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    const { data: account, error: accountError } = await database
      .from('barbershop_billing_accounts')
      .select('stripe_customer_id')
      .eq('barbershop_id', owner.barbershop_id)
      .maybeSingle();

    if (accountError)
      throw new BillingError(
        'Could not load Stripe billing account.',
        'DB_READ_FAILED',
      );
    if (!account?.stripe_customer_id)
      return NextResponse.json({ success: true, changed: false });

    const subscriptions = await getStripeClient().subscriptions.list({
      customer: account.stripe_customer_id,
      status: 'all',
      limit: 20,
    });

    const changeSubscription = [...subscriptions.data]
      .filter(
        (subscription) =>
          subscription.metadata?.app === 'silentra-for-barbers' &&
          subscription.metadata?.is_plan_change === 'true' &&
          subscription.metadata?.previous_subscription_id &&
          ['active', 'trialing'].includes(subscription.status),
      )
      .sort((a, b) => b.created - a.created)[0];

    if (!changeSubscription)
      return NextResponse.json({ success: true, changed: false });

    await BarbershopStripeService.syncFromStripe(
      owner.barbershop_id,
      user.id,
      changeSubscription,
    );

    const previousSubscriptionId =
      changeSubscription.metadata.previous_subscription_id;
    if (!previousSubscriptionId || previousSubscriptionId === 'none') {
      return NextResponse.json(
        {
          success: true,
          changed: false,
          stripeSubscriptionId: changeSubscription.id,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const previous = await getStripeClient()
      .subscriptions.retrieve(previousSubscriptionId)
      .catch(() => null);
    if (
      previous &&
      ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(
        previous.status,
      )
    ) {
      await getStripeClient().subscriptions.cancel(previous.id);
    }

    return NextResponse.json(
      {
        success: true,
        changed: true,
        stripeSubscriptionId: changeSubscription.id,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Could not finalize the plan change.' },
      { status: 500 },
    );
  }
}
