import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { getAccessPlanForRequest } from '@/services/billing/plan-access.guard';
import { assertFeature } from '@/lib/billing/entitlements';
import { requireModuleContext } from '@/services/modules/authorization';

function parseNumber(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function ensureAccess() {
  const access = await getAccessPlanForRequest();
  if (!access.ok)
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  try {
    assertFeature(access.plan, 'loyalty');
  } catch (error) {
    return {
      response: NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Feature not included',
        },
        { status: 403 },
      ),
    } as const;
  }
  const context = await requireModuleContext('loyalty', 'loyalty');
  return { context } as const;
}

async function GET__unobserved() {
  try {
    const result = await ensureAccess();
    if ('response' in result) return result.response;
    const { admin, barbershopId } = result.context;
    const [
      { data: settings, error: settingsError },
      { data: rewards, error: rewardsError },
    ] = await Promise.all([
      admin
        .from('loyalty_settings')
        .select(
          'barbershop_id,enabled,points_per_euro,welcome_points,referral_points,updated_at',
        )
        .eq('barbershop_id', barbershopId)
        .maybeSingle(),
      admin
        .from('loyalty_rewards')
        .select(
          'id,name,description,points_cost,reward_type,reward_value,active,created_at,updated_at',
        )
        .eq('barbershop_id', barbershopId)
        .order('points_cost', { ascending: true }),
    ]);
    if (settingsError) throw settingsError;
    if (rewardsError) throw rewardsError;

    return NextResponse.json(
      {
        settings: settings ?? {
          barbershop_id: barbershopId,
          enabled: false,
          points_per_euro: 1,
          welcome_points: 0,
          referral_points: 0,
        },
        rewards: rewards ?? [],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[LOYALTY_GET]', error);
    return NextResponse.json(
      { error: 'Unable to load loyalty data' },
      { status: 500 },
    );
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    const result = await ensureAccess();
    if ('response' in result) return result.response;
    const { admin, barbershopId } = result.context;
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const enabled = body?.enabled === true;
    const pointsPerEuro = parseNumber(
      body?.points_per_euro ?? body?.pointsPerEuro,
      1,
    );
    const welcomePoints = Math.floor(
      parseNumber(body?.welcome_points ?? body?.welcomePoints, 0),
    );
    const referralPoints = Math.floor(
      parseNumber(body?.referral_points ?? body?.referralPoints, 0),
    );
    if (
      pointsPerEuro <= 0 ||
      pointsPerEuro > 100 ||
      welcomePoints < 0 ||
      welcomePoints > 100000 ||
      referralPoints < 0 ||
      referralPoints > 100000
    ) {
      return NextResponse.json(
        { error: 'Invalid loyalty settings' },
        { status: 400 },
      );
    }
    const { data, error } = await admin
      .from('loyalty_settings')
      .upsert(
        {
          barbershop_id: barbershopId,
          enabled,
          points_per_euro: pointsPerEuro,
          welcome_points: welcomePoints,
          referral_points: referralPoints,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'barbershop_id' },
      )
      .select(
        'barbershop_id,enabled,points_per_euro,welcome_points,referral_points,updated_at',
      )
      .single();
    if (error) throw error;
    return NextResponse.json(
      { settings: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[LOYALTY_PATCH]', error);
    return NextResponse.json(
      { error: 'Unable to save loyalty settings' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/loyalty', GET__unobserved);
export const PATCH = withApiObservability('/api/loyalty', PATCH__unobserved);
