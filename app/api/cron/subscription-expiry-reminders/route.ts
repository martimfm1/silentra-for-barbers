import { withApiObservability } from '@/lib/observability/api';
import { sendEmail } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  customerSubscriptionExpiryReminderEmail,
  getBillingEmailBaseUrl,
} from '@/services/billing/email-templates';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 8;
const PROCESS_CONCURRENCY = 10;

type ReminderEvent = {
  id: string;
  subscription_id: string;
  period_end: string;
  days_before: 1 | 3 | 7;
  attempts: number;
};

type SubscriptionSnapshot = {
  id: string;
  user_id: string;
  barbershop_id: string | null;
  plan: string;
  status: string;
  payment_method: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan_override: string | null;
};

type OwnerSnapshot = {
  id: string;
  name_complete: string | null;
  email: string | null;
  barbershop_id: string | null;
  role: string | null;
};

type BarbershopSnapshot = {
  id: string;
  name: string | null;
  default_language: string | null;
};

type BillingAccountSnapshot = {
  barbershop_id: string;
  billing_owner_user_id: string | null;
  billing_email: string | null;
};

type AssignmentSnapshot = {
  barbershop_id: string;
  expires_at: string | null;
};

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  return (
    request.headers.get('authorization') === `Bearer ${expected}` ||
    request.headers.get('x-cron-secret') === expected
  );
}

function safeErrorName(error: unknown) {
  return error instanceof Error &&
    /^[A-Za-z0-9_.:-]{1,60}$/.test(error.name)
    ? error.name
    : 'UNKNOWN';
}

async function updateOutbox(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await admin
    .from('subscription_expiry_reminder_outbox')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('status', 'processing');
  if (error) throw error;
}

async function releaseClaimedEvents(
  admin: ReturnType<typeof createAdminClient>,
  events: ReminderEvent[],
  errorCode: string,
) {
  if (!events.length) return;
  const availableAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error } = await admin
    .from('subscription_expiry_reminder_outbox')
    .update({
      status: 'pending',
      locked_at: null,
      available_at: availableAt,
      last_error: errorCode,
      updated_at: new Date().toISOString(),
    })
    .in('id', events.map((event) => event.id))
    .eq('status', 'processing');
  if (error) throw error;
}

async function processEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: ReminderEvent,
  context: {
    subscriptions: Map<string, SubscriptionSnapshot>;
    owners: Map<string, OwnerSnapshot>;
    shops: Map<string, BarbershopSnapshot>;
    billingAccounts: Map<string, BillingAccountSnapshot>;
    activeAssignments: Set<string>;
  },
) {
  const subscription = context.subscriptions.get(event.subscription_id);
  if (
    !subscription ||
    !subscription.barbershop_id ||
    !subscription.current_period_end ||
    new Date(subscription.current_period_end).getTime() !==
      new Date(event.period_end).getTime() ||
    !['pro', 'enterprise'].includes(subscription.plan) ||
    !['active', 'trialing'].includes(subscription.status) ||
    subscription.plan_override !== null ||
    !(
      subscription.payment_method === 'MANUAL' ||
      (subscription.payment_method === 'STRIPE' &&
        subscription.cancel_at_period_end === true)
    ) ||
    context.activeAssignments.has(subscription.barbershop_id)
  ) {
    await updateOutbox(admin, event.id, {
      status: 'skipped',
      locked_at: null,
      last_error: 'subscription_no_longer_ending',
    });
    return 'skipped' as const;
  }

  const owner = context.owners.get(subscription.user_id);
  if (
    !owner ||
    owner.barbershop_id !== subscription.barbershop_id ||
    String(owner.role ?? '').toLowerCase() !== 'owner'
  ) {
    await updateOutbox(admin, event.id, {
      status: 'skipped',
      locked_at: null,
      last_error: 'billing_owner_not_found',
    });
    return 'skipped' as const;
  }

  const billingAccount = context.billingAccounts.get(
    subscription.barbershop_id,
  );
  const billingEmail =
    billingAccount?.billing_owner_user_id === owner.id
      ? billingAccount.billing_email?.trim()
      : null;
  const recipient = billingEmail || owner.email?.trim();
  if (!recipient) {
    await updateOutbox(admin, event.id, {
      status: 'skipped',
      locked_at: null,
      last_error: 'billing_email_missing',
    });
    return 'skipped' as const;
  }

  const locale =
    context.shops.get(subscription.barbershop_id)?.default_language === 'en'
      ? 'en'
      : 'pt';
  const template = customerSubscriptionExpiryReminderEmail({
    customerName: owner.name_complete,
    plan: subscription.plan as 'pro' | 'enterprise',
    expiresAt: subscription.current_period_end,
    daysRemaining: event.days_before,
    locale,
    dashboardUrl: new URL(
      '/dashboard/billing',
      getBillingEmailBaseUrl(),
    ).toString(),
  });
  const subject =
    locale === 'en'
      ? event.days_before === 1
        ? 'Your Silentra subscription ends tomorrow'
        : `Your Silentra subscription ends in ${event.days_before} days`
      : event.days_before === 1
        ? 'A tua subscrição Silentra termina amanhã'
        : `A tua subscrição Silentra termina daqui a ${event.days_before} dias`;

  const result = await sendEmail(
    { email: recipient, userId: owner.id },
    {
      subject,
      body: template.text,
      html: template.html,
      senderName: 'Silentra',
    },
  );

  if (result.success) {
    await updateOutbox(admin, event.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      email_message_id: result.messageId ?? null,
      locked_at: null,
      last_error: null,
    });
    return 'sent' as const;
  }

  if (result.skipped) {
    await updateOutbox(admin, event.id, {
      status: 'skipped',
      locked_at: null,
      last_error: 'email_notifications_disabled',
    });
    return 'skipped' as const;
  }

  throw new Error('EMAIL_DELIVERY_FAILED');
}

async function retryEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: ReminderEvent,
) {
  const exhausted = event.attempts >= MAX_ATTEMPTS;
  const delayMinutes = Math.min(360, 2 ** Math.min(event.attempts, 8));
  await updateOutbox(admin, event.id, {
    status: exhausted ? 'failed' : 'pending',
    available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    locked_at: null,
    last_error: 'email_delivery_failed',
  });
}

async function GET__unobserved(request: Request) {
  if (!authorized(request))
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const admin = createAdminClient();
  let claimedEvents: ReminderEvent[] = [];

  try {
    const { data, error } = await admin.rpc(
      'claim_subscription_expiry_reminder_events',
      { p_batch_size: BATCH_SIZE },
    );
    if (error) throw error;

    claimedEvents = (data ?? []) as ReminderEvent[];
    if (!claimedEvents.length)
      return NextResponse.json(
        {
          ok: true,
          requestId,
          claimed: 0,
          sent: 0,
          skipped: 0,
          failed: 0,
          durationMs: Date.now() - startedAt,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );

    const subscriptionIds = [
      ...new Set(claimedEvents.map((event) => event.subscription_id)),
    ];
    const { data: subscriptionRows, error: subscriptionsError } = await admin
      .from('subscriptions')
      .select(
        'id,user_id,barbershop_id,plan,status,payment_method,current_period_end,cancel_at_period_end,plan_override',
      )
      .in('id', subscriptionIds);
    if (subscriptionsError) throw subscriptionsError;

    const subscriptions = (subscriptionRows ?? []) as SubscriptionSnapshot[];
    const ownerIds = [...new Set(subscriptions.map((row) => row.user_id))];
    const shopIds = [
      ...new Set(
        subscriptions
          .map((row) => row.barbershop_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [ownerResult, shopResult, billingResult, assignmentResult] =
      await Promise.all([
        ownerIds.length
          ? admin
              .from('users')
              .select('id,name_complete,email,barbershop_id,role')
              .in('id', ownerIds)
          : Promise.resolve({ data: [], error: null }),
        shopIds.length
          ? admin
              .from('barbershops')
              .select('id,name,default_language')
              .in('id', shopIds)
          : Promise.resolve({ data: [], error: null }),
        shopIds.length
          ? admin
              .from('barbershop_billing_accounts')
              .select('barbershop_id,billing_owner_user_id,billing_email')
              .in('barbershop_id', shopIds)
          : Promise.resolve({ data: [], error: null }),
        shopIds.length
          ? admin
              .from('barbershop_plan_assignments')
              .select('barbershop_id,expires_at')
              .in('barbershop_id', shopIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    const contextError =
      ownerResult.error ||
      shopResult.error ||
      billingResult.error ||
      assignmentResult.error;
    if (contextError) throw contextError;

    const now = Date.now();
    const owners = new Map(
      ((ownerResult.data ?? []) as OwnerSnapshot[]).map((row) => [
        row.id,
        row,
      ]),
    );
    const shops = new Map(
      ((shopResult.data ?? []) as BarbershopSnapshot[]).map((row) => [
        row.id,
        row,
      ]),
    );
    const billingAccounts = new Map(
      ((billingResult.data ?? []) as BillingAccountSnapshot[]).map((row) => [
        row.barbershop_id,
        row,
      ]),
    );
    const activeAssignments = new Set(
      ((assignmentResult.data ?? []) as AssignmentSnapshot[])
        .filter(
          (row) =>
            !row.expires_at || new Date(row.expires_at).getTime() > now,
        )
        .map((row) => row.barbershop_id),
    );
    const context = {
      subscriptions: new Map(
        subscriptions.map((row) => [row.id, row]),
      ),
      owners,
      shops,
      billingAccounts,
      activeAssignments,
    };

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (
      let offset = 0;
      offset < claimedEvents.length;
      offset += PROCESS_CONCURRENCY
    ) {
      const batch = claimedEvents.slice(
        offset,
        offset + PROCESS_CONCURRENCY,
      );
      const results = await Promise.all(
        batch.map(async (event) => {
          try {
            return await processEvent(admin, event, context);
          } catch (error) {
            failed += 1;
            console.error('[SUBSCRIPTION_EXPIRY_EMAIL_FAILED]', {
              requestId,
              eventId: event.id,
              error: safeErrorName(error),
            });
            try {
              await retryEvent(admin, event);
            } catch (retryError) {
              console.error('[SUBSCRIPTION_EXPIRY_EMAIL_RETRY_FAILED]', {
                requestId,
                eventId: event.id,
                error: safeErrorName(retryError),
              });
            }
            return 'failed' as const;
          }
        }),
      );
      sent += results.filter((result) => result === 'sent').length;
      skipped += results.filter((result) => result === 'skipped').length;
    }

    const result = {
      ok: failed === 0,
      requestId,
      claimed: claimedEvents.length,
      sent,
      skipped,
      failed,
      durationMs: Date.now() - startedAt,
    };
    console.info('[SUBSCRIPTION_EXPIRY_EMAIL_CRON]', result);
    return NextResponse.json(result, {
      status: failed === 0 ? 200 : 207,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (claimedEvents.length) {
      try {
        await releaseClaimedEvents(admin, claimedEvents, 'worker_context_failed');
      } catch (releaseError) {
        console.error('[SUBSCRIPTION_EXPIRY_EMAIL_RELEASE_FAILED]', {
          requestId,
          error: safeErrorName(releaseError),
        });
      }
    }
    console.error('[SUBSCRIPTION_EXPIRY_EMAIL_CRON_FAILED]', {
      requestId,
      error: safeErrorName(error),
    });
    return NextResponse.json(
      { ok: false, requestId, error: 'Subscription expiry reminders failed.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/subscription-expiry-reminders',
  GET__unobserved,
);
