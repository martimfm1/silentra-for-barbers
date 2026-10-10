import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Plan = 'free' | 'pro' | 'enterprise';
type UserShop = { id: string; barbershop_id: string | null };
type Subscription = {
  user_id: string;
  plan: string | null;
  plan_override: string | null;
  status: string;
  updated_at: string | null;
  payment_method?: string | null;
  current_period_end?: string | null;
};

type RecentPayment = {
  price: number | string;
  billing_interval: string;
  paid_at: string | null;
};

type AuditEvent = {
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'platform.plan_assignment.updated': 'Plano da barbearia atualizado',
  'platform.plan_assignment.cleared': 'Atribuição manual de plano removida',
  PAYMENT_LINK_SENT: 'Link de pagamento enviado',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  SUBSCRIPTION_ACTIVATED: 'Subscrição ativada',
  MANUAL_SUBSCRIPTION_CANCELLATION_REQUESTED: 'Cancelamento de subscrição solicitado',
  loyalty_redemption_validated: 'Recompensa de fidelização validada',
  'professional.created': 'Profissional adicionado à barbearia',
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  barbershop: 'Barbearia',
  subscription: 'Subscrição',
  subscription_request: 'Pedido de subscrição',
  loyalty_redemption: 'Recompensa de fidelização',
  professional: 'Profissional',
};

function describeAuditEvent(event: AuditEvent) {
  const metadata = event.metadata ?? {};
  const detailParts: string[] = [];
  if (typeof metadata.plan === 'string') {
    const plan = metadata.plan.toLowerCase();
    detailParts.push(`Plano ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`);
  }
  if (metadata.billing_interval === 'month') detailParts.push('Mensal');
  if (metadata.billing_interval === 'year') detailParts.push('Anual');
  if (typeof metadata.request_type === 'string') {
    const requestTypes: Record<string, string> = {
      NEW: 'Nova subscrição',
      RENEWAL: 'Renovação',
      CHANGE: 'Alteração de plano',
    };
    if (requestTypes[metadata.request_type]) detailParts.push(requestTypes[metadata.request_type]);
  }
  if (typeof metadata.price === 'number' && typeof metadata.currency === 'string') {
    try {
      detailParts.push(new Intl.NumberFormat('pt-PT', {
        style: 'currency', currency: metadata.currency, maximumFractionDigits: 2,
      }).format(metadata.price));
    } catch {
      // Ignore unknown currency metadata rather than displaying raw provider data.
    }
  }
  const rawAction = event.action.replace(/[._-]+/g, ' ').trim();
  const fallback = rawAction ? rawAction.charAt(0).toUpperCase() + rawAction.slice(1) : 'Atividade registada';
  return {
    label: AUDIT_ACTION_LABELS[event.action] ?? fallback,
    entityLabel: AUDIT_ENTITY_LABELS[event.entity_type] ?? 'Plataforma',
    detail: detailParts.join(' · '),
  };
}

export async function GET(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim() || '';
    const now = new Date().toISOString();

    const [
      shopsCount,
      usersCount,
      ownersCount,
      barbersCount,
      clientsCount,
      appointmentsCount,
      upcomingCount,
      activeSubscriptionsCount,
      assignmentsCount,
      allShops,
      shops,
      users,
      assignments,
      subscriptions,
      openPaymentRequestsCount,
      paymentSentRequestsCount,
      allManualRequests30d,
      paidManualRequests30d,
      paidManualRevenue30d,
      emailFailureRequestsCount,
      manualExpiring7d,
      newShops7d,
      newUsers7d,
      appointmentsNext7d,
      canceledSubscriptions30d,
      recentAuditEvents,
    ] = await Promise.all([
      admin.from('barbershops').select('id', { count: 'exact', head: true }),
      admin.from('users').select('id', { count: 'exact', head: true }),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner'),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'barber'),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'client'),
      admin.from('appointments').select('id', { count: 'exact', head: true }),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'scheduled'])
        .gte('date_hour', now),
      admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'trialing']),
      admin
        .from('barbershop_plan_assignments')
        .select('barbershop_id', { count: 'exact', head: true })
        .or(`expires_at.is.null,expires_at.gt.${now}`),
      admin.from('barbershops').select('id'),
      query
        ? UUID_RE.test(query)
          ? admin
              .from('barbershops')
              .select('id,name,slug,created_at')
              .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
              .eq('id', query)
              .limit(30)
          : admin
              .from('barbershops')
              .select('id,name,slug,created_at')
              .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
              .order('created_at', { ascending: false })
              .limit(30)
        : admin
            .from('barbershops')
            .select('id,name,slug,created_at')
            .order('created_at', { ascending: false })
            .limit(30),
      admin.from('users').select('id,barbershop_id'),
      admin
        .from('barbershop_plan_assignments')
        .select('barbershop_id,plan,expires_at')
        .or(`expires_at.is.null,expires_at.gt.${now}`),
      admin
        .from('subscriptions')
        .select(
          'user_id,plan,plan_override,status,updated_at,payment_method,current_period_end',
        )
        .order('updated_at', { ascending: false }),
      admin
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'PAYMENT_SENT']),
      admin
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PAYMENT_SENT'),
      admin
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      admin
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PAID')
        .gte('paid_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      admin
        .from('subscription_requests')
        .select('price,billing_interval,paid_at')
        .eq('status', 'PAID')
        .gte('paid_at', new Date(Date.now() - 30 * 86400000).toISOString())
        .order('paid_at', { ascending: false })
        .limit(500),
      admin
        .from('subscription_requests')
        .select('id', { count: 'exact', head: true })
        .not('last_email_error', 'is', null),
      admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_method', 'MANUAL')
        .in('status', ['active', 'trialing'])
        .gte('current_period_end', now)
        .lt(
          'current_period_end',
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ),
      admin
        .from('barbershops')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'scheduled'])
        .gte('date_hour', now)
        .lt('date_hour', new Date(Date.now() + 7 * 86400000).toISOString()),
      admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'canceled')
        .gte('updated_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      admin
        .from('audit_logs')
        .select('action,entity_type,entity_id,created_at,metadata')
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

    for (const result of [
      shopsCount,
      usersCount,
      ownersCount,
      barbersCount,
      clientsCount,
      appointmentsCount,
      upcomingCount,
      activeSubscriptionsCount,
      assignmentsCount,
      allShops,
      shops,
      users,
      assignments,
      subscriptions,
      openPaymentRequestsCount,
      paymentSentRequestsCount,
      allManualRequests30d,
      paidManualRequests30d,
      paidManualRevenue30d,
      emailFailureRequestsCount,
      manualExpiring7d,
      newShops7d,
      newUsers7d,
      appointmentsNext7d,
      canceledSubscriptions30d,
      recentAuditEvents,
    ]) {
      if (result.error) throw result.error;
    }

    const paidActiveSubscriptions = (subscriptions.data ?? []).filter(
      (subscription) =>
        ['pro', 'enterprise'].includes(subscription.plan ?? '') &&
        ['active', 'trialing'].includes(subscription.status),
    ).length;

    const manualRevenue30d = (
      (paidManualRevenue30d.data ?? []) as RecentPayment[]
    ).reduce((sum, payment) => sum + Number(payment.price || 0), 0);

    const manualRequestTotal30d = allManualRequests30d.count ?? 0;
    const manualPaid30d = paidManualRequests30d.count ?? 0;
    const manualConversion30d =
      manualRequestTotal30d > 0
        ? Math.round((manualPaid30d / manualRequestTotal30d) * 100)
        : 0;

    const userShopById = new Map<string, string>(
      ((users.data ?? []) as UserShop[])
        .filter((user) => user.barbershop_id)
        .map((user) => [user.id, user.barbershop_id as string]),
    );

    const assignmentByShop = new Map(
      (assignments.data ?? []).map((item) => [item.barbershop_id, item]),
    );
    const subscriptionByShop = new Map<string, Subscription>();

    for (const subscription of (subscriptions.data ?? []) as Subscription[]) {
      const barbershopId = userShopById.get(subscription.user_id);
      if (!barbershopId || subscriptionByShop.has(barbershopId)) continue;
      subscriptionByShop.set(barbershopId, subscription);
    }

    const effectivePlan = (shopId: string): Plan => {
      const assignment = assignmentByShop.get(shopId);
      if (assignment) return assignment.plan as Plan;
      const subscription = subscriptionByShop.get(shopId);
      if (
        subscription?.plan_override &&
        ['free', 'pro', 'enterprise'].includes(subscription.plan_override)
      )
        return subscription.plan_override as Plan;
      if (
        subscription?.plan &&
        ['pro', 'enterprise'].includes(subscription.plan) &&
        ['active', 'trialing'].includes(subscription.status)
      )
        return subscription.plan as Plan;
      return 'free';
    };

    const plans = (allShops.data ?? []).reduce(
      (acc, shop) => {
        acc[effectivePlan(shop.id)] += 1;
        return acc;
      },
      { free: 0, pro: 0, enterprise: 0 },
    );

    const rows = (shops.data ?? []).map((shop) => {
      const assignment = assignmentByShop.get(shop.id);
      return {
        ...shop,
        plan: effectivePlan(shop.id),
        assigned: Boolean(assignment),
        expires_at: assignment?.expires_at ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      stats: {
        barbershops: shopsCount.count ?? 0,
        users: usersCount.count ?? 0,
        owners: ownersCount.count ?? 0,
        barbers: barbersCount.count ?? 0,
        clients: clientsCount.count ?? 0,
        appointments: appointmentsCount.count ?? 0,
        upcomingAppointments: upcomingCount.count ?? 0,
        activeSubscriptions: activeSubscriptionsCount.count ?? 0,
        activePaidSubscriptions: paidActiveSubscriptions,
        planAssignments: assignmentsCount.count ?? 0,
      },
      operations: {
        openPaymentRequests: openPaymentRequestsCount.count ?? 0,
        paymentSentRequests: paymentSentRequestsCount.count ?? 0,
        paidManualRequests30d: manualPaid30d,
        manualRevenue30d: Number(manualRevenue30d.toFixed(2)),
        manualConversion30d,
        emailFailures: emailFailureRequestsCount.count ?? 0,
        manualExpiring7d: manualExpiring7d.count ?? 0,
        newShops7d: newShops7d.count ?? 0,
        newUsers7d: newUsers7d.count ?? 0,
        appointmentsNext7d: appointmentsNext7d.count ?? 0,
        canceledSubscriptions30d: canceledSubscriptions30d.count ?? 0,
      },
      system: {
        adminIdentityConfigured: Boolean(
          process.env.SILENTRA_PLATFORM_ADMIN_USER_ID?.trim() ||
          process.env.SILENTRA_PLATFORM_ADMIN_EMAIL?.trim(),
        ),
        emailConfigured: Boolean(
          process.env.BREVO_API_KEY?.trim() &&
          (process.env.BREVO_FROM_EMAIL?.trim() ||
            process.env.SENDER_EMAIL?.trim()),
        ),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        manualPricingConfigured: Boolean(
          process.env.MANUAL_PRICE_PRO_MONTHLY_EUR?.trim() &&
          process.env.MANUAL_PRICE_PRO_YEARLY_EUR?.trim() &&
          process.env.MANUAL_PRICE_ENTERPRISE_MONTHLY_EUR?.trim() &&
          process.env.MANUAL_PRICE_ENTERPRISE_YEARLY_EUR?.trim(),
        ),
        manualPaymentHostAllowlistConfigured: Boolean(
          process.env.MANUAL_PAYMENT_ALLOWED_HOSTS?.trim(),
        ),
      },
      activity: ((recentAuditEvents.data ?? []) as AuditEvent[]).map((event) => {
        const description = describeAuditEvent(event);
        return {
          action: event.action,
          label: description.label,
          entityLabel: description.entityLabel,
          detail: description.detail,
          createdAt: event.created_at,
        };
      }),
      plans,
      recentShops: rows,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('[SILENTRA_ADMIN_OVERVIEW]', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar o overview interno.' },
      { status: 500 },
    );
  }
}
