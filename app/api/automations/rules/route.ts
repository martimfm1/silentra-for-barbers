import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';
const TRIGGERS = [
  'booking_created',
  'booking_completed',
  'booking_cancelled',
  'client_inactive',
  'birthday',
] as const;

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'automated_followups',
      'marketing',
    );
    const { data, error } = await admin
      .from('automation_rules')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ rules: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load automation rules' },
      { status: 500 },
    );
  }
}

async function POSTHandler(request: Request) {
  try {
    const { admin, barbershopId, userId } = await requireModuleContext(
      'automated_followups',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const triggerType =
      typeof body?.triggerType === 'string' ? body.triggerType : '';
    if (
      name.length < 1 ||
      name.length > 120 ||
      !TRIGGERS.includes(triggerType as (typeof TRIGGERS)[number])
    ) {
      return NextResponse.json(
        { error: 'Invalid automation rule' },
        { status: 400 },
      );
    }
    const conditions =
      body?.conditions &&
      typeof body.conditions === 'object' &&
      !Array.isArray(body.conditions)
        ? body.conditions
        : {};
    const actions = Array.isArray(body?.actions)
      ? body.actions.slice(0, 10)
      : [];
    const { data, error } = await admin
      .from('automation_rules')
      .insert({
        barbershop_id: barbershopId,
        created_by: userId,
        name,
        trigger_type: triggerType,
        conditions,
        actions,
        active: body?.active !== false,
      })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create automation rule' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/automations/rules', GETHandler);
export const POST = withApiLogging('/api/automations/rules', POSTHandler);
