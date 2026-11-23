import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { queueManualCampaignRecipients } from '@/lib/marketing/dispatcher';
import { moduleErrorResponse, requireModuleContext } from '@/services/modules/authorization';
import { NextResponse } from 'next/server';
import { DEFAULT_MARKETING_QUOTAS } from '@/lib/marketing/campaigns';

export const runtime = 'nodejs';

function lisbonMonthStart() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return String(values.year) + '-' + String(values.month) + '-01';
}

async function POST__unobserved(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const admin = createAdminClient();
  let barbershopId = '';
  let usageMonth: string | null = null;
  let quotaReserved = false;

  try {
    const context = await requireModuleContext('marketing_campaigns', 'marketing');
    if (!context.barbershopId) throw new Error('Barbearia não encontrada.');
    barbershopId = context.barbershopId;
    const { campaignId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) {
      return NextResponse.json({ error: 'Campanha inválida.' }, { status: 400 });
    }

    usageMonth = lisbonMonthStart();
    const { data: reserved, error: quotaError } = await admin.rpc(
      'reserve_marketing_campaign_send',
      {
        p_barbershop_id: barbershopId,
        p_usage_month: usageMonth,
        p_limit: DEFAULT_MARKETING_QUOTAS.monthlyCampaigns,
      },
    );
    if (quotaError) throw quotaError;
    if (reserved !== true) {
      return NextResponse.json(
        {
          ok: false,
          code: 'MARKETING_MONTHLY_QUOTA_REACHED',
          error: 'Atingiste o limite de 10 campanhas enviadas este mês.',
          quota: { monthlyLimit: DEFAULT_MARKETING_QUOTAS.monthlyCampaigns },
        },
        { status: 429 },
      );
    }
    quotaReserved = true;

    const result = await queueManualCampaignRecipients(campaignId, barbershopId);
    if (result.queued === 0) {
      await admin.rpc('release_marketing_campaign_send', {
        p_barbershop_id: barbershopId,
        p_usage_month: usageMonth,
      });
      quotaReserved = false;
      return NextResponse.json(
        {
          ok: false,
          code: 'NO_CONSENTED_RECIPIENTS',
          error: 'Não existem clientes com email e autorização de marketing ativa para esta campanha.',
          eligibleContacts: result.total,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      queued: result.queued,
      eligibleContacts: result.total,
      quota: {
        monthlyLimit: DEFAULT_MARKETING_QUOTAS.monthlyCampaigns,
        reserved: true,
      },
    });
  } catch (error) {
    if (quotaReserved && barbershopId && usageMonth) {
      const { error: releaseError } = await admin.rpc(
        'release_marketing_campaign_send',
        {
          p_barbershop_id: barbershopId,
          p_usage_month: usageMonth,
        },
      );
      if (releaseError) {
        console.error('[MARKETING_CAMPAIGN_QUOTA_RELEASE_ERROR]', releaseError.code);
      }
    }
    const response = moduleErrorResponse(error);
    if (response) return response;
    const message =
      error instanceof Error ? error.message : 'Não foi possível iniciar a campanha.';
    const status =
      message.includes('5.000 destinatários') ||
      message.includes('já foi enviada') ||
      message.includes('não encontrada')
        ? 409
        : 500;
    console.error('[MARKETING_CAMPAIGN_SEND]', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export const POST = withApiObservability(
  '/api/marketing/campaigns/[campaignId]/send',
  POST__unobserved,
);
