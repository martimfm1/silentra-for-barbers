import { withApiObservability } from '@/lib/observability/api';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_MARKETING_QUOTAS } from '@/lib/marketing/campaigns';
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
      .order('created_at', { ascending: false });
    if (error) throw error;

    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const monthValues = Object.fromEntries(
      dateParts.map((part) => [part.type, part.value]),
    );
    const usageMonth = String(monthValues.year) + '-' + String(monthValues.month) + '-01';
    const [{ data: usage, error: usageError }, { count: eligibleCount, error: eligibleError }] =
      await Promise.all([
        admin
          .from('marketing_campaign_monthly_usage')
          .select('manual_campaigns_sent')
          .eq('barbershop_id', barbershopId)
          .eq('usage_month', usageMonth)
          .maybeSingle(),
        admin
          .from('marketing_contact_preferences')
          .select('id', { count: 'exact', head: true })
          .eq('barbershop_id', barbershopId)
          .not('email_consent_at', 'is', null)
          .is('email_unsubscribed_at', null),
      ]);
    if (usageError) throw usageError;
    if (eligibleError) throw eligibleError;

    return NextResponse.json(
      {
        ok: true,
        campaigns: data ?? [],
        quota: {
          monthlyLimit: DEFAULT_MARKETING_QUOTAS.monthlyCampaigns,
          used: usage?.manual_campaigns_sent ?? 0,
          remaining: Math.max(0, DEFAULT_MARKETING_QUOTAS.monthlyCampaigns - (usage?.manual_campaigns_sent ?? 0)),
          eligibleContacts: eligibleCount ?? 0,
          maxRecipientsPerCampaign: DEFAULT_MARKETING_QUOTAS.maxRecipientsPerCampaign,
          month: usageMonth,
        },
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
    console.error('[MARKETING_CAMPAIGNS_GET]', error);
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

    if (body?.triggerType === 'manual') {
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 120
      ) {
        return NextResponse.json(
          { error: 'Indica um nome válido para a campanha.' },
          { status: 400 },
        );
      }
      if (body.channel !== undefined && body.channel !== 'email') {
        return NextResponse.json(
          { error: 'De momento, as campanhas manuais estão disponíveis por email.' },
          { status: 400 },
        );
      }
      if (
        typeof body.subject !== 'string' ||
        !body.subject.trim() ||
        body.subject.trim().length > 200
      ) {
        return NextResponse.json(
          { error: 'Indica um assunto de email válido.' },
          { status: 400 },
        );
      }
      if (
        typeof body.body !== 'string' ||
        !body.body.trim() ||
        body.body.trim().length > 10000
      ) {
        return NextResponse.json(
          { error: 'O conteúdo da campanha é inválido.' },
          { status: 400 },
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
          segment: { audience: 'consented_email' },
          trigger_type: 'manual',
          active: true,
          status: 'draft',
          interval_value: null,
          interval_unit: null,
          next_run_at: null,
          event_name: null,
          scheduled_at: null,
          birthday_offset_days: 0,
          birthday_reward_type: 'none',
          birthday_reward_service_id: null,
        })
        .select(CAMPAIGN_SELECT)
        .single();
      if (error) throw error;

      return NextResponse.json({ ok: true, campaign: data }, { status: 201 });
    }

    if (body?.triggerType !== 'birthday') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Tipo de campanha inválido.',
          code: 'INVALID_CAMPAIGN_TRIGGER',
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

async function PATCH__unobserved(request: NextRequest) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      name?: unknown;
      subject?: unknown;
      body?: unknown;
    } | null;

    if (
      typeof body?.id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(body.id) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 120 ||
      typeof body.subject !== 'string' ||
      !body.subject.trim() ||
      body.subject.trim().length > 200 ||
      typeof body.body !== 'string' ||
      !body.body.trim() ||
      body.body.trim().length > 10000
    ) {
      return NextResponse.json(
        { error: 'Revê o nome, assunto e conteúdo da campanha.' },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from('marketing_campaigns')
      .update({
        name: body.name.trim(),
        subject: body.subject.trim(),
        body: body.body.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('barbershop_id', barbershopId)
      .eq('trigger_type', 'manual')
      .in('status', ['draft', 'scheduled'])
      .select(CAMPAIGN_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Só podes editar campanhas manuais que ainda não começaram a enviar.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, campaign: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGN_PATCH]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível atualizar a campanha.' },
      { status: 500 },
    );
  }
}

async function DELETE__unobserved(request: NextRequest) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!id) {
      return NextResponse.json(
        { error: 'O ID da campanha é obrigatório.' },
        { status: 400 },
      );
    }

    const { data: automation, error: lookupError } = await admin
      .from('marketing_campaigns')
      .select('id,status,trigger_type')
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .in('trigger_type', ['manual', 'interval', 'event', 'birthday'])
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!automation) {
      return NextResponse.json(
        { error: 'Campanha não encontrada.' },
        { status: 404 },
      );
    }
    if (!['draft', 'scheduled', 'cancelled'].includes(automation.status)) {
      return NextResponse.json(
        { error: 'Só é possível eliminar automações antes de iniciarem o envio.' },
        { status: 409 },
      );
    }

    const { error } = await admin
      .from('marketing_campaigns')
      .delete()
      .eq('id', id)
      .eq('barbershop_id', barbershopId)
      .in('trigger_type', ['manual', 'interval', 'event', 'birthday']);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGN_DELETE]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível eliminar a campanha.' },
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
export const PATCH = withApiObservability(
  '/api/marketing/campaigns',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/marketing/campaigns',
  DELETE__unobserved,
);
