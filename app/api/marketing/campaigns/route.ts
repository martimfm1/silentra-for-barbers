import { withApiObservability } from '@/lib/observability/api';
import { NextRequest, NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

const CAMPAIGN_SELECT =
  'id,name,channel,subject,body,segment,status,scheduled_at,started_at,completed_at,created_at,updated_at,trigger_type,interval_value,interval_unit,next_run_at,event_name,birthday_offset_days,birthday_reward_type,birthday_reward_service_id,active,total_recipients,sent_count,failed_count';

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const { data, error } = await admin
      .from('marketing_campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('barbershop_id', barbershopId)
      .in('trigger_type', ['interval', 'event', 'birthday'])
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json(
      {
        ok: true,
        campaigns: data ?? [],
        meta: {
          total: data?.length ?? 0,
          generatedAt: new Date().toISOString(),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_AUTOMATIONS_GET]', error);
    return NextResponse.json(
      { ok: false, error: 'Unable to load automations' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: NextRequest) {
  try {
    const { admin, userId, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as {
      triggerType?: unknown;
      name?: unknown;
      channel?: unknown;
      subject?: unknown;
      body?: unknown;
    } | null;

    if (body?.triggerType !== 'birthday') {
      return NextResponse.json(
        {
          ok: false,
          error: 'A criação de campanhas manuais está temporariamente desativada.',
          code: 'MANUAL_CAMPAIGNS_DISABLED',
        },
        { status: 410 },
      );
    }

    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 120
    ) {
      return NextResponse.json(
        { error: 'Nome da automação inválido.' },
        { status: 400 },
      );
    }
    if (
      body.channel !== 'email' ||
      typeof body.subject !== 'string' ||
      !body.subject.trim() ||
      body.subject.length > 200
    ) {
      return NextResponse.json(
        { error: 'A automação de aniversário requer um email válido.' },
        { status: 400 },
      );
    }
    if (
      typeof body.body !== 'string' ||
      !body.body.trim() ||
      body.body.length > 10000
    ) {
      return NextResponse.json(
        { error: 'O conteúdo da automação é inválido.' },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from('marketing_campaigns')
      .select('id')
      .eq('barbershop_id', barbershopId)
      .eq('trigger_type', 'birthday')
      .eq('active', true)
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { error: 'A automação de aniversário já existe.' },
        { status: 409 },
      );
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .insert({
        barbershop_id: barbershopId,
        created_by: userId,
        name: body.name.trim(),
        channel: 'email',
        subject: body.subject.trim(),
        body: body.body.trim(),
        segment: {},
        trigger_type: 'birthday',
        active: true,
        status: 'scheduled',
        birthday_offset_days: 0,
        birthday_reward_type: 'none',
        birthday_reward_service_id: null,
        interval_value: null,
        interval_unit: null,
        next_run_at: null,
        event_name: null,
        scheduled_at: null,
      })
      .select(CAMPAIGN_SELECT)
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, campaign: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_AUTOMATION_CREATE]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível criar a automação.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/marketing/campaigns',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/marketing/campaigns',
  POST__unobserved,
);
