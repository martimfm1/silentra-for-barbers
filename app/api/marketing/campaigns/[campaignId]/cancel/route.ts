import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

async function POSTHandler(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const { campaignId } = await params;

    const { data: campaign, error: campaignError } = await admin
      .from('marketing_campaigns')
      .select('id,status,active')
      .eq('id', campaignId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (campaignError) throw campaignError;
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha não encontrada.' },
        { status: 404 },
      );
    }

    if (!['scheduled', 'sending'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Só é possível cancelar campanhas agendadas ou em envio.' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { error: campaignUpdateError } = await admin
      .from('marketing_campaigns')
      .update({
        status: 'cancelled',
        active: false,
        next_run_at: null,
        updated_at: now,
      })
      .eq('id', campaignId)
      .eq('barbershop_id', barbershopId)
      .in('status', ['scheduled', 'sending']);

    if (campaignUpdateError) throw campaignUpdateError;

    const { error: recipientUpdateError } = await admin
      .from('marketing_campaign_recipients')
      .update({
        status: 'cancelled',
        next_attempt_at: null,
        error_message: 'Campanha cancelada pelo utilizador.',
      })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued');

    if (recipientUpdateError) throw recipientUpdateError;

    const { count: cancelledRecipients, error: recipientCountError } =
      await admin
        .from('marketing_campaign_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'cancelled');

    if (recipientCountError) throw recipientCountError;

    return NextResponse.json({
      ok: true,
      cancelledRecipients: cancelledRecipients ?? 0,
      message:
        'Campanha cancelada. Os destinatários ainda não enviados foram removidos da fila.',
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGN_CANCEL]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível cancelar a campanha.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(
  '/api/marketing/campaigns/[campaignId]/cancel',
  POSTHandler,
);
