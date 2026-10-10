import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLoyaltySession } from '@/lib/loyalty/session';
import { requireTenantAuthorization } from '@/lib/security/tenant-guard';
import { getLoyaltyTenantBySlug } from '@/lib/loyalty/public-tenant';

export const runtime = 'nodejs';

type LoyaltyMember = {
  id: string;
  email: string;
  name: string | null;
  points_balance: number;
  status: string;
};
type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: string;
  reward_value: number | null;
  active: boolean;
};
type LoyaltyRedemption = {
  id: string;
  reward_id: string;
  points_spent: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  validated_at: string | null;
};

async function GET__unobserved(request: Request) {
  const slug =
    new URL(request.url).searchParams.get('slug')?.trim().toLowerCase() || '';

  try {
    const tenant = await getLoyaltyTenantBySlug(slug);
    if (!tenant)
      return NextResponse.json(
        { error: 'Fidelização indisponível.' },
        { status: 404 },
      );

    await requireTenantAuthorization({
      barbershopId: tenant.barbershopId,
      allowPublicTenant: true,
    });

    const session = await getLoyaltySession(tenant.barbershopId);
    if (!session)
      return NextResponse.json(
        { authenticated: false },
        { headers: { 'Cache-Control': 'no-store' } },
      );

    const admin = createAdminClient();
    await admin.rpc('expire_loyalty_redemptions');

    const { data: memberData, error: memberError } = await admin
      .from('loyalty_members')
      .select('id, email, name, points_balance, status')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('email', session.email)
      .eq('status', 'active')
      .maybeSingle();

    if (memberError)
      return NextResponse.json(
        { error: 'Não foi possível carregar a fidelização.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );

    const member = memberData as LoyaltyMember | null;
    const [
      { data: rewardsData, error: rewardsError },
      { data: redemptionsData, error: redemptionsError },
      { data: barbershop },
    ] = await Promise.all([
      admin
        .from('loyalty_rewards')
        .select(
          'id, name, description, points_cost, reward_type, reward_value, active',
        )
        .eq('barbershop_id', tenant.barbershopId)
        .eq('active', true)
        .order('points_cost', { ascending: true }),
      member
        ? admin
            .from('loyalty_redemptions')
            .select(
              'id, reward_id, points_spent, status, expires_at, created_at, validated_at',
            )
            .eq('barbershop_id', tenant.barbershopId)
            .eq('member_id', member.id)
            .order('created_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as LoyaltyRedemption[], error: null }),
      admin
        .from('barbershops')
        .select('name, slug')
        .eq('id', tenant.barbershopId)
        .maybeSingle(),
    ]);

    if (rewardsError || redemptionsError)
      return NextResponse.json(
        { error: 'Não foi possível carregar a fidelização.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );

    const rewards = (rewardsData ?? []) as LoyaltyReward[];
    const redemptions = (redemptionsData ?? []) as LoyaltyRedemption[];
    const points = member?.points_balance ?? 0;
    const nextReward =
      rewards.find((reward) => reward.points_cost > points) ?? null;

    return NextResponse.json(
      {
        authenticated: true,
        email: session.email,
        member: member ?? {
          email: session.email,
          name: null,
          points_balance: 0,
          status: 'active',
        },
        rewards,
        redemptions,
        nextReward,
        barbershop: {
          name: barbershop?.name ?? 'Barbearia',
          slug: barbershop?.slug ?? slug,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível carregar a fidelização.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability('/api/loyalty/me', GET__unobserved);
