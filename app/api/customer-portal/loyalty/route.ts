import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/customer-booking-portal';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function GETHandler() {
  const session = await getPortalSession();
  if (!session)
    return NextResponse.json({ authenticated: false }, { status: 401 });

  const admin = createAdminClient();
  await admin.rpc('expire_loyalty_redemptions');

  const { data: memberships, error } = await admin
    .from('loyalty_members')
    .select('id, barbershop_id, email, name, points_balance, status, joined_at')
    .eq('email', session.email)
    .eq('status', 'active')
    .limit(1);

  if (error)
    return NextResponse.json(
      { error: 'Não foi possível carregar a fidelização.' },
      { status: 503 },
    );

  const member = memberships?.[0];
  if (!member)
    return NextResponse.json({ authenticated: true, enrolled: false });

  const [{ data: shop }, { data: publicShop }, { data: rewards }] =
    await Promise.all([
      admin
        .from('barbershops')
        .select('id, name')
        .eq('id', member.barbershop_id)
        .maybeSingle(),
      admin
        .from('shops')
        .select('slug')
        .eq('barbershop_id', member.barbershop_id)
        .maybeSingle(),
      admin
        .from('loyalty_rewards')
        .select(
          'id, name, description, points_cost, reward_type, reward_value, active',
        )
        .eq('barbershop_id', member.barbershop_id)
        .eq('active', true)
        .order('points_cost', { ascending: true }),
    ]);

  const points = Number(member.points_balance ?? 0);
  const nextReward =
    (rewards ?? []).find((reward) => reward.points_cost > points) ?? null;

  return NextResponse.json(
    {
      authenticated: true,
      enrolled: true,
      member: {
        id: member.id,
        email: member.email,
        name: member.name,
        pointsBalance: points,
        joinedAt: member.joined_at,
      },
      barbershop: shop
        ? { id: shop.id, name: shop.name, slug: publicShop?.slug ?? null }
        : null,
      rewards: rewards ?? [],
      nextReward,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}


export const GET = withApiLogging('/api/customer-portal/loyalty', GETHandler);
