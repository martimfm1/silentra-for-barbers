import { withApiLogging } from '@/lib/observability/api-request';
import { NextRequest, NextResponse } from 'next/server';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

const EVENTS = [
  'booking_created',
  'booking_completed',
  'booking_cancelled',
] as const;
const MODES = ['manual', 'interval', 'event', 'birthday'] as const;
const CAMPAIGN_SELECT =
  'id,name,channel,trigger_type,interval_value,interval_unit,next_run_at,event_name,birthday_offset_days,birthday_reward_type,birthday_reward_service_id,active,status,updated_at';

async function GETHandler() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );

    const { data: campaigns, error: campaignError } = await admin
      .from('marketing_campaigns')
      .select(CAMPAIGN_SELECT)
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false });

    if (campaignError) {
      console.error('[MARKETING_AUTOMATION_CAMPAIGNS_GET]', campaignError);
      return NextResponse.json(
        {
          ok: false,
          error:
            'A configuração de automações ainda não está disponível na base de dados.',
          code: campaignError.code ?? 'AUTOMATION_SCHEMA_ERROR',
          details: campaignError.message,
        },
        { status: 500 },
      );
    }

    const { data: services, error: serviceError } = await admin
      .from('services')
      .select('id,name,price,duration')
      .eq('barbershop_id', barbershopId)
      .order('name', { ascending: true });

    if (serviceError) {
      console.error('[MARKETING_AUTOMATION_SERVICES_GET]', serviceError);
      return NextResponse.json(
        {
          ok: false,
          error:
            'Não foi possível carregar os serviços disponíveis para recompensas.',
          code: serviceError.code ?? 'AUTOMATION_SERVICES_ERROR',
          details: serviceError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        campaigns: campaigns ?? [],
        events: EVENTS,
        services: services ?? [],
        meta: { generatedAt: new Date().toISOString() },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_AUTOMATION_GET]', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Não foi possível carregar as definições de automação.',
        code: 'AUTOMATION_LOAD_FAILED',
      },
      { status: 500 },
    );
  }
}

async function PATCHHandler(request: NextRequest) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    const mode =
      typeof body?.triggerType === 'string' ? body.triggerType : 'manual';

    if (!id || !MODES.includes(mode as (typeof MODES)[number])) {
      return NextResponse.json(
        { error: 'Configuração de automação inválida.' },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {
      trigger_type: mode,
      updated_at: new Date().toISOString(),
    };

    if (mode === 'interval') {
      const value = Number(body?.intervalValue);
      const unit = body?.intervalUnit;
      if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 3650 ||
        !['hours', 'days'].includes(String(unit))
      ) {
        return NextResponse.json(
          { error: 'Intervalo inválido.' },
          { status: 400 },
        );
      }
      patch.interval_value = value;
      patch.interval_unit = unit;
      patch.event_name = null;
      patch.birthday_offset_days = 0;
      patch.birthday_reward_type = 'none';
      patch.birthday_reward_service_id = null;
      patch.active = true;
      patch.next_run_at = new Date(
        Date.now() + (unit === 'days' ? value * 86400000 : value * 3600000),
      ).toISOString();
      patch.status = 'scheduled';
    } else if (mode === 'event') {
      const eventName =
        typeof body?.eventName === 'string' ? body.eventName : '';
      if (!EVENTS.includes(eventName as (typeof EVENTS)[number])) {
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
      }
      patch.interval_value = null;
      patch.interval_unit = null;
      patch.next_run_at = null;
      patch.event_name = eventName;
      patch.birthday_offset_days = 0;
      patch.birthday_reward_type = 'none';
      patch.birthday_reward_service_id = null;
      patch.active = true;
      patch.status = 'draft';
    } else if (mode === 'birthday') {
      const offset = Number(body?.birthdayOffsetDays ?? 0);
      const rewardType =
        typeof body?.birthdayRewardType === 'string'
          ? body.birthdayRewardType
          : 'none';
      const rewardServiceId =
        typeof body?.birthdayRewardServiceId === 'string'
          ? body.birthdayRewardServiceId
          : null;

      if (!Number.isInteger(offset) || offset < -365 || offset > 365) {
        return NextResponse.json(
          {
            error: 'O desvio do aniversário deve estar entre -365 e 365 dias.',
          },
          { status: 400 },
        );
      }

      if (!['none', 'free_service'].includes(rewardType)) {
        return NextResponse.json(
          { error: 'Tipo de recompensa inválido.' },
          { status: 400 },
        );
      }

      if (rewardType === 'free_service') {
        if (!rewardServiceId) {
          return NextResponse.json(
            { error: 'Seleciona o serviço que será oferecido gratuitamente.' },
            { status: 400 },
          );
        }
        const { data: service, error: serviceError } = await admin
          .from('services')
          .select('id')
          .eq('id', rewardServiceId)
          .eq('barbershop_id', barbershopId)
          .maybeSingle();
        if (serviceError) throw serviceError;
        if (!service) {
          return NextResponse.json(
            { error: 'O serviço selecionado não pertence a esta barbearia.' },
            { status: 400 },
          );
        }
      }

      patch.interval_value = null;
      patch.interval_unit = null;
      patch.next_run_at = null;
      patch.event_name = null;
      patch.birthday_offset_days = offset;
      patch.birthday_reward_type = rewardType;
      patch.birthday_reward_service_id =
        rewardType === 'free_service' ? rewardServiceId : null;
      patch.active = true;
      patch.status = 'scheduled';
    } else {
      patch.interval_value = null;
      patch.interval_unit = null;
      patch.next_run_at = null;
      patch.event_name = null;
      patch.birthday_offset_days = 0;
      patch.birthday_reward_type = 'none';
      patch.birthday_reward_service_id = null;
      patch.active = true;
      patch.status = 'draft';
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .update(patch)
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .select(CAMPAIGN_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Campanha não encontrada.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, campaign: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_AUTOMATION_PATCH]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível atualizar a automação.' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/marketing/campaigns/automation', GETHandler);
export const PATCH = withApiLogging('/api/marketing/campaigns/automation', PATCHHandler);
