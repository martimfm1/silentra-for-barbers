import { withApiObservability } from '@/lib/observability/api';
import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { billingErrorResponse } from '@/services/billing/http';
import { BillingError } from '@/types/stripe';
import { dispatchMoneyFlowOutboxBatch } from '@/services/moneyflow/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function markWebhookFailed(eventId: string, error: unknown) {
  const database = createAdminClient();
  // Persist only a bounded error identifier; provider exception messages can
  // contain customer details or request data and must not enter the ledger.
  const candidate: { name?: unknown; code?: unknown } =
    error && typeof error === 'object'
      ? (error as { name?: unknown; code?: unknown })
      : {};
  const safeName =
    typeof candidate.name === 'string' &&
    /^[A-Za-z0-9_.:-]{1,60}$/.test(candidate.name)
      ? candidate.name
      : 'UNKNOWN';
  const safeCode =
    typeof candidate.code === 'string' &&
    /^[A-Za-z0-9_.:-]{1,60}$/.test(candidate.code)
      ? candidate.code
      : null;
  const message = safeCode ? `${safeName}:${safeCode}` : safeName;
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

type InvoiceMoneyFlowFields = {
  id: string;
  amount_paid?: number;
  currency?: string;
  created?: number;
  number?: string | null;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  parent?: {
    subscription_details?: {
      subscription?: string | { id: string } | null;
    } | null;
  } | null;
  status_transitions?: { paid_at?: number | null } | null;
};

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

async function processPaidSubscriptionInvoice(invoice: Stripe.Invoice) {
  const fields = invoice as unknown as InvoiceMoneyFlowFields;
  if (!fields.id || !Number.isFinite(fields.amount_paid) || (fields.amount_paid ?? 0) <= 0) {
    return;
  }

  // MoneyFlow currently links an EUR account in the Silentra finance context.
  // Non-EUR invoices are deliberately left out rather than converted silently.
  if (String(fields.currency ?? '').toUpperCase() !== 'EUR') return;

  const subscriptionId = stripeObjectId(
    fields.subscription ??
      fields.parent?.subscription_details?.subscription,
  );
  if (!subscriptionId) return;

  const subscription = await getStripeClient().subscriptions.retrieve(
    subscriptionId,
  );
  // A subscription carrying a barbershop mapping is never platform revenue.
  if (subscription.metadata.barbershop_id?.trim()) return;

  const customerId = stripeObjectId(fields.customer);
  if (!customerId) return;
  const customerMapping =
    await BarbershopStripeService.findBarbershopByCustomerId(customerId);
  // Customer-linked invoices are operational barbershop revenue, not platform revenue.
  if (customerMapping) return;

  const paidAt =
    fields.status_transitions?.paid_at ??
    fields.created ??
    Math.floor(Date.now() / 1000);
  const occurredAt = new Date(paidAt * 1000).toISOString();
  const plan = subscription.metadata.plan?.trim().toLowerCase();
  const description = plan
    ? `Subscrição Silentra for Barbers · ${plan}`
    : 'Subscrição Silentra for Barbers';

  const admin = createAdminClient();
  const eventKey = `stripe-invoice:${fields.id}`;
  const { error } = await admin.from('moneyflow_sync_outbox').upsert(
    {
      event_key: eventKey,
      event_type: 'subscription_payment',
      payload: {
        eventId: eventKey,
        amount: (fields.amount_paid ?? 0) / 100,
        currency: 'EUR',
        occurredAt,
        description,
        externalReference: fields.number ?? fields.id,
      },
    },
    { onConflict: 'event_key', ignoreDuplicates: true },
  );

  if (error) {
    throw new BillingError(
      'Could not queue the confirmed subscription payment for MoneyFlow.',
      'DB_WRITE_FAILED',
    );
  }

  try {
    await dispatchMoneyFlowOutboxBatch(10);
  } catch (error) {
    // The durable outbox and scheduled retry keep the Stripe webhook independent
    // from MoneyFlow availability.
    console.error('[MONEYFLOW_STRIPE_PAYMENT_DISPATCH_FAILED]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
    });
  }
}

async function POST__unobserved(request: Request) {
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
      } else if (event.type === 'invoice.paid') {
        await processPaidSubscriptionInvoice(
          event.data.object as Stripe.Invoice,
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

export const POST = withApiObservability(
  '/api/stripe/webhook',
  POST__unobserved,
);
