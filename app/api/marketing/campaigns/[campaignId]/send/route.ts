import { withApiLogging } from '@/lib/observability/api-request';
import { NextRequest, NextResponse } from 'next/server';
import { queueCampaign } from '@/lib/marketing/dispatcher';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const { campaignId } = await params;
    const { data: campaign, error } = await admin
      .from('marketing_campaigns')
      .select('id,status,active')
      .eq('id', campaignId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (error || !campaign)
      return NextResponse.json(
        { error: 'Campanha não encontrada.' },
        { status: 404 },
      );
    if (!campaign.active)
      return NextResponse.json(
        { error: 'A campanha está desativada.' },
        { status: 409 },
      );
    if (campaign.status === 'sending')
      return NextResponse.json(
        { error: 'A campanha já está a ser enviada.' },
        { status: 409 },
      );

    const runKey = `manual:${barbershopId}:${campaignId}:${Date.now()}`;
    const result = await queueCampaign(campaignId, runKey);
    return NextResponse.json({
      ok: true,
      ...result,
      message: 'Campanha colocada na fila de envio.',
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_CAMPAIGN_SEND]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível iniciar o envio.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(
  '/api/marketing/campaigns/[campaignId]/send',
  POSTHandler,
);
