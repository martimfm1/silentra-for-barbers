import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireModuleContext } from '@/services/modules/authorization';

const TRIGGERS = new Set([
  'booking_created',
  'booking_completed',
  'booking_cancelled',
  'client_inactive',
  'birthday',
]);
const ACTIONS = new Set(['email', 'sms']);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function PATCH__unobserved(
  request: Request,
  context: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'automated_followups',
      'automated_followups',
    );
    const { ruleId } = await context.params;
    if (!isUuid(ruleId))
      return NextResponse.json({ error: 'Invalid rule id' }, { status: 400 });
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body?.name !== undefined)
      patch.name =
        typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    if (
      body?.triggerType !== undefined &&
      typeof body.triggerType === 'string'
    ) {
      if (!TRIGGERS.has(body.triggerType))
        return NextResponse.json({ error: 'Invalid trigger' }, { status: 400 });
      patch.trigger_type = body.triggerType;
    }
    if (body?.active !== undefined) patch.active = body.active === true;
    if (
      body?.conditions !== undefined &&
      body.conditions &&
      typeof body.conditions === 'object' &&
      !Array.isArray(body.conditions)
    )
      patch.conditions = body.conditions;
    if (body?.actions !== undefined) {
      if (!Array.isArray(body.actions) || body.actions.length > 10)
        return NextResponse.json({ error: 'Invalid actions' }, { status: 400 });
      for (const action of body.actions) {
        if (!action || typeof action !== 'object' || Array.isArray(action))
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 },
          );
        const type = (action as Record<string, unknown>).type;
        if (typeof type !== 'string' || !ACTIONS.has(type))
          return NextResponse.json(
            { error: 'Invalid action type' },
            { status: 400 },
          );
      }
      patch.actions = body.actions;
    }
    const { data, error } = await admin
      .from('automation_rules')
      .update(patch)
      .eq('id', ruleId)
      .eq('barbershop_id', barbershopId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        { error: 'Automation not found' },
        { status: 404 },
      );
    return NextResponse.json({ rule: data });
  } catch (error) {
    console.error('[AUTOMATION_RULE_PATCH]', error);
    return NextResponse.json(
      { error: 'Unable to update automation rule' },
      { status: 500 },
    );
  }
}

async function DELETE__unobserved(
  request: Request,
  context: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'automated_followups',
      'automated_followups',
    );
    const { ruleId } = await context.params;
    if (!isUuid(ruleId))
      return NextResponse.json({ error: 'Invalid rule id' }, { status: 400 });
    const { error } = await admin
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)
      .eq('barbershop_id', barbershopId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[AUTOMATION_RULE_DELETE]', error);
    return NextResponse.json(
      { error: 'Unable to delete automation rule' },
      { status: 500 },
    );
  }
}

export const PATCH = withApiObservability(
  '/api/automations/rules/[ruleId]',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/automations/rules/[ruleId]',
  DELETE__unobserved,
);
