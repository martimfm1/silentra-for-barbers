import { withApiLogging } from '@/lib/observability/api-request';
import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { billingErrorResponse } from '@/services/billing/http';
import { BillingError } from '@/types/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function markWebhookFailed(eventId: string, error: unknown) {
  const database = createAdminClient();
  const message = error instanceof Error ? error.message : 'UNKNOWN';
  const { error: markError } = await database.rpc('fail_stripe_webhook_event', {
    p_event_id: eventId,
    p_error: message,
  });
  if (markError)
    console.error(
      'billing.webhook_ledger_fail_mark_failed',
      markError.name ?? 'unknown',
    );
}

async function hydrateBillingMappingFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
) {
  const barbershopId = metadata?.barbershop_id?.trim() || null;
  const metadataUserId =
    metadata?.user_id?.trim() ||
    metadata?.billing_owner_user_id?.trim() ||
    null;
  const customerId = metadata?.stripe_customer_id?.trim() || null;
  if (!barbershopId) return null;

  const database = createAdminClient();
  let ownerUserId = metadataUserId;

  if (!ownerUserId) {
    const { data: owner, error } = await database
      .from('users')
      .select('id')
      .eq('barbershop_id', barbershopId)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not resolve barbershop billing owner.',
        'DB_READ_FAILED',
      );
    ownerUserId = owner?.id ?? null;
  }

  if (!ownerUserId)
    throw new BillingError(
      'Could not resolve barbershop billing owner.',
      'WEBHOOK_PROCESSING_FAILED',
    );

  const { data: owner, error: ownerError } = await database
    .from('users')
    .select('id, barbershop_id, role')
    .eq('id', ownerUserId)
    .maybeSingle();
  if (ownerError)
    throw new BillingError(
      'Could not resolve billing owner.',
      'DB_READ_FAILED',
    );
  if (
    !owner ||
    owner.barbershop_id !== barbershopId ||
    String(owner.role ?? '').toLowerCase() !== 'owner'
  ) {
    throw new BillingError(
      'Invalid billing owner for barbershop.',
      'WEBHOOK_PROCESSING_FAILED',
    );
  }

  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId) {
    const { data: account, error } = await database
      .from('barbershop_billing_accounts')
      .select('stripe_customer_id')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not load barbershop Stripe mapping.',
        'DB_READ_FAILED',
      );
    resolvedCustomerId = account?.stripe_customer_id ?? null;
  }

  if (resolvedCustomerId) {
    await BarbershopStripeService.findBarbershopByCustomerId(
      resolvedCustomerId,
    );
  }

  return { barbershopId, ownerUserId, customerId: resolvedCustomerId };
}

async function processCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  if (!session.subscription) return;
  const stripeSubscription =
    typeof session.subscription === 'string'
      ? await getStripeClient().subscriptions.retrieve(session.subscription)
      : session.subscription;
  const metadata = session.metadata ?? stripeSubscription.metadata ?? {};
  const mapping = await hydrateBillingMappingFromMetadata(metadata);
  if (!mapping)
    throw new BillingError(
      'Checkout session does not contain the barbershop billing mapping.',
      'WEBHOOK_PROCESSING_FAILED',
    );
  await BarbershopStripeService.syncFromStripe(
    mapping.barbershopId,
    mapping.ownerUserId,
    stripeSubscription,
  );
}

async function POSTHandler(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret)
    return NextResponse.json(
      { error: 'Invalid webhook request.' },
      { status: 400 },
    );

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return billingErrorResponse(
      new BillingError(
        'Webhook signature verification failed.',
        'WEBHOOK_VERIFICATION_FAILED',
      ),
    );
  }

  try {
    const database = createAdminClient();
    const { data: claimStatus, error: claimError } = await database.rpc(
      'claim_stripe_webhook_event',
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_lease_seconds: 300,
      },
    );

    if (claimError)
      return billingErrorResponse(
        new BillingError(
          'Webhook ledger unavailable.',
          'WEBHOOK_PROCESSING_FAILED',
        ),
      );
    if (claimStatus === 'processed')
      return NextResponse.json({ received: true, duplicate: true });
    if (claimStatus === 'processing')
      return NextResponse.json({ received: true, processing: true });
    if (claimStatus !== 'claimed')
      return billingErrorResponse(
        new BillingError(
          'Webhook claim could not be established.',
          'WEBHOOK_PROCESSING_FAILED',
        ),
      );

    try {
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded'
      ) {
        await processCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
      } else if (
        [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ].includes(event.type)
      ) {
        await BarbershopStripeService.processWebhookEvent(event);
      }
    } catch (error) {
      await markWebhookFailed(event.id, error);
      throw error;
    }

    const { error: completeError } = await database.rpc(
      'complete_stripe_webhook_event',
      { p_event_id: event.id },
    );
    if (completeError)
      return billingErrorResponse(
        new BillingError(
          'Webhook acknowledgement could not be persisted.',
          'WEBHOOK_PROCESSING_FAILED',
        ),
      );
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof BillingError) return billingErrorResponse(error);
    console.error(
      'billing.webhook_processing_failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return billingErrorResponse(
      new BillingError(
        'Webhook processing failed.',
        'WEBHOOK_PROCESSING_FAILED',
      ),
    );
  }
}

export const POST = withApiLogging('/api/stripe/webhook', POSTHandler);
