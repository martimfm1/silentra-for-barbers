import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireModuleContext } from '@/services/modules/authorization';

type RewardType = 'discount' | 'free_service' | 'custom';
const REWARD_TYPES = new Set<RewardType>([
  'discount',
  'free_service',
  'custom',
]);

function parseId(value: unknown) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

async function POST__unobserved(request: Request) {
  try {
    const { admin, userId, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string'
        ? body.description.trim().slice(0, 1000)
        : null;
    const pointsCost = Number(body?.points_cost ?? body?.pointsCost);
    const rewardType =
      typeof body?.reward_type === 'string' ? body.reward_type : 'discount';
    const rewardValue =
      body?.reward_value === null ||
      body?.reward_value === undefined ||
      body?.reward_value === ''
        ? null
        : Number(body.reward_value);
    const active = body?.active !== false;
    if (
      !name ||
      name.length > 120 ||
      !Number.isInteger(pointsCost) ||
      pointsCost <= 0 ||
      pointsCost > 10000000 ||
      !REWARD_TYPES.has(rewardType as RewardType)
    )
      return NextResponse.json({ error: 'Invalid reward' }, { status: 400 });
    if (
      rewardValue !== null &&
      (!Number.isFinite(rewardValue) || rewardValue < 0)
    )
      return NextResponse.json(
        { error: 'Invalid reward value' },
        { status: 400 },
      );
    const { data, error } = await admin
      .from('loyalty_rewards')
      .insert({
        barbershop_id: barbershopId,
        name,
        description,
        points_cost: pointsCost,
        reward_type: rewardType,
        reward_value: rewardValue,
        active,
        created_by: userId,
      })
      .select(
        'id,name,description,points_cost,reward_type,reward_value,active,created_at,updated_at',
      )
      .single();
    if (error) {
      if (error.code === 'PGRST204') {
        const retry = await admin
          .from('loyalty_rewards')
          .insert({
            barbershop_id: barbershopId,
            name,
            description,
            points_cost: pointsCost,
            reward_type: rewardType,
            reward_value: rewardValue,
            active,
          })
          .select(
            'id,name,description,points_cost,reward_type,reward_value,active,created_at,updated_at',
          )
          .single();
        if (retry.error) throw retry.error;
        return NextResponse.json({ reward: retry.data }, { status: 201 });
      }
      throw error;
    }
    return NextResponse.json({ reward: data }, { status: 201 });
  } catch (error) {
    console.error('[LOYALTY_REWARD_POST]', error);
    return NextResponse.json(
      { error: 'Unable to create reward' },
      { status: 500 },
    );
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const id = parseId(body?.id);
    if (!id)
      return NextResponse.json({ error: 'Invalid reward id' }, { status: 400 });
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body?.name !== undefined)
      patch.name =
        typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (body?.description !== undefined)
      patch.description =
        typeof body.description === 'string'
          ? body.description.trim().slice(0, 1000)
          : null;
    if (body?.points_cost !== undefined || body?.pointsCost !== undefined)
      patch.points_cost = Math.floor(
        Number(body.points_cost ?? body.pointsCost),
      );
    if (body?.reward_type !== undefined) patch.reward_type = body.reward_type;
    if (body?.reward_value !== undefined)
      patch.reward_value =
        body.reward_value === null || body.reward_value === ''
          ? null
          : Number(body.reward_value);
    if (body?.active !== undefined) patch.active = body.active === true;
    if (
      typeof patch.points_cost === 'number' &&
      (!Number.isInteger(patch.points_cost) ||
        patch.points_cost <= 0 ||
        patch.points_cost > 10000000)
    )
      return NextResponse.json(
        { error: 'Invalid points cost' },
        { status: 400 },
      );
    if (
      patch.reward_type !== undefined &&
      !REWARD_TYPES.has(patch.reward_type as RewardType)
    )
      return NextResponse.json(
        { error: 'Invalid reward type' },
        { status: 400 },
      );
    const { data, error } = await admin
      .from('loyalty_rewards')
      .update(patch)
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select(
        'id,name,description,points_cost,reward_type,reward_value,active,created_at,updated_at',
      )
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    return NextResponse.json({ reward: data });
  } catch (error) {
    console.error('[LOYALTY_REWARD_PATCH]', error);
    return NextResponse.json(
      { error: 'Unable to update reward' },
      { status: 500 },
    );
  }
}

async function DELETE__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'loyalty',
      'loyalty',
    );
    const id = parseId(new URL(request.url).searchParams.get('id'));
    if (!id)
      return NextResponse.json({ error: 'Invalid reward id' }, { status: 400 });
    const { data, error } = await admin
      .from('loyalty_rewards')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select('id,active')
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    return NextResponse.json({ ok: true, reward: data });
  } catch (error) {
    console.error('[LOYALTY_REWARD_DELETE]', error);
    return NextResponse.json(
      { error: 'Unable to deactivate reward' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/loyalty/rewards',
  POST__unobserved,
);
export const PATCH = withApiObservability(
  '/api/loyalty/rewards',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/loyalty/rewards',
  DELETE__unobserved,
);
