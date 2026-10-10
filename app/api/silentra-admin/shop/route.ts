import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_STATUSES = ['pending', 'scheduled'] as const;

async function GET__unobserved(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const barbershopId =
      new URL(request.url).searchParams.get('barbershopId')?.trim() ?? '';

    if (!UUID_RE.test(barbershopId)) {
      return NextResponse.json(
        { ok: false, error: 'barbershopId inválido.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [
      shopResult,
      ownerResult,
      membersResult,
      todayResult,
      upcomingResult,
      completedResult,
      cancelledResult,
      assignmentResult,
    ] = await Promise.all([
      // `barbershops` does not contain an email column; the tenant's contact email is the owner's email.
      admin
        .from('barbershops')
        .select('id,name,slug,created_at,address,phone')
        .eq('id', barbershopId)
        .maybeSingle(),
      admin
        .from('users')
        .select('id,email,name_complete,role')
        .eq('barbershop_id', barbershopId)
        .eq('role', 'owner')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .gte('date_hour', startOfToday.toISOString())
        .lt('date_hour', startOfTomorrow.toISOString()),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .in('status', ACTIVE_STATUSES)
        .gte('date_hour', now.toISOString()),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .eq('status', 'completed'),
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', barbershopId)
        .eq('status', 'cancelled'),
      admin
        .from('barbershop_plan_assignments')
        .select('plan,reason,assigned_at,expires_at,assigned_by')
        .eq('barbershop_id', barbershopId)
        .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    for (const result of [
      shopResult,
      ownerResult,
      membersResult,
      todayResult,
      upcomingResult,
      completedResult,
      cancelledResult,
      assignmentResult,
    ]) {
      if (result.error) throw result.error;
    }

    const shop = shopResult.data;
    if (!shop) {
      return NextResponse.json(
        { ok: false, error: 'Barbearia não encontrada.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const owner = ownerResult.data ?? null;
    let subscription: {
      plan: string | null;
      plan_override: string | null;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
      stripe_price_id: string | null;
    } | null = null;

    if (owner?.id) {
      const { data, error } = await admin
        .from('subscriptions')
        .select(
          'plan,plan_override,status,current_period_end,cancel_at_period_end,stripe_price_id,updated_at,created_at',
        )
        .eq('user_id', owner.id)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      subscription = data;
    }

    const assignment = assignmentResult.data;
    const assignmentActive = Boolean(
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > now.getTime()),
    );
    const subscriptionOverride =
      subscription?.plan_override &&
      ['free', 'pro', 'enterprise'].includes(subscription.plan_override)
        ? subscription.plan_override
        : null;
    const stripePlan =
      subscription?.plan &&
      ['pro', 'enterprise'].includes(subscription.plan) &&
      ['active', 'trialing'].includes(subscription.status)
        ? subscription.plan
        : null;
    const effectivePlan = assignmentActive
      ? assignment!.plan
      : (subscriptionOverride ?? stripePlan ?? 'free');
    const source = assignmentActive
      ? 'admin'
      : subscriptionOverride
        ? 'subscription_override'
        : stripePlan
          ? 'stripe'
          : 'free';

    return NextResponse.json(
      {
        ok: true,
        shop: {
          ...shop,
          email: owner?.email ?? null,
        },
        owner,
        plan: {
          effective: effectivePlan,
          source,
          assignment: assignmentActive ? assignment : null,
          subscription: subscription
            ? {
                status: subscription.status,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end,
                plan: subscription.plan,
                plan_override: subscription.plan_override,
                stripe_price_id: subscription.stripe_price_id,
              }
            : null,
        },
        metrics: {
          members: membersResult.count ?? 0,
          todayAppointments: todayResult.count ?? 0,
          upcomingAppointments: upcomingResult.count ?? 0,
          completedAppointments: completedResult.count ?? 0,
          cancelledAppointments: cancelledResult.count ?? 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    console.error('[SILENTRA_ADMIN_SHOP]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível carregar o tenant.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/silentra-admin/shop',
  GET__unobserved,
);
