import { withApiLogging } from '@/lib/observability/api-request';
import { NextRequest, NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function POSTHandler(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { admin, barbershopId, userId } = await requireModuleContext(
      'marketing_campaigns',
      'marketing',
    );
    const { code } = await context.params;
    const normalizedCode = code.trim().toUpperCase();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const appointmentId =
      typeof body?.appointmentId === 'string' ? body.appointmentId : null;

    if (!normalizedCode) {
      return NextResponse.json(
        { error: 'Código do voucher inválido.' },
        { status: 400 },
      );
    }

    const { data: voucher, error: voucherError } = await admin
      .from('marketing_campaign_vouchers')
      .select(
        'id,code,client_id,barbershop_id,service_id,reward_type,status,birthday_date,expires_at,redeemed_at,appointment_id,services(name,price)',
      )
      .eq('barbershop_id', barbershopId)
      .eq('code', normalizedCode)
      .maybeSingle();

    if (voucherError) throw voucherError;
    if (!voucher) {
      return NextResponse.json(
        { error: 'Voucher não encontrado.' },
        { status: 404 },
      );
    }

    if (voucher.status !== 'issued') {
      return NextResponse.json(
        {
          error:
            voucher.status === 'redeemed'
              ? 'Este voucher já foi utilizado.'
              : 'Este voucher já não está disponível.',
          status: voucher.status,
        },
        { status: 409 },
      );
    }

    const now = Date.now();
    if (new Date(voucher.expires_at).getTime() <= now) {
      await admin
        .from('marketing_campaign_vouchers')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', voucher.id)
        .eq('status', 'issued');
      return NextResponse.json(
        { error: 'Este voucher expirou.' },
        { status: 410 },
      );
    }

    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await admin
        .from('appointments')
        .select('id,barbershop_id,client_id,service_id')
        .eq('id', appointmentId)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();
      if (appointmentError) throw appointmentError;
      if (!appointment) {
        return NextResponse.json(
          { error: 'Marcação não encontrada.' },
          { status: 404 },
        );
      }
      if (appointment.client_id !== voucher.client_id) {
        return NextResponse.json(
          { error: 'O voucher pertence a outro cliente.' },
          { status: 409 },
        );
      }
      if (appointment.service_id !== voucher.service_id) {
        return NextResponse.json(
          {
            error:
              'O voucher só pode ser usado no serviço definido pela campanha.',
          },
          { status: 409 },
        );
      }
    }

    const { data: redeemed, error: redeemError } = await admin
      .from('marketing_campaign_vouchers')
      .update({
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by: userId,
        appointment_id: appointmentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voucher.id)
      .eq('barbershop_id', barbershopId)
      .eq('status', 'issued')
      .select(
        'id,code,client_id,service_id,reward_type,status,birthday_date,expires_at,redeemed_at,appointment_id,services(name,price)',
      )
      .maybeSingle();

    if (redeemError) throw redeemError;
    if (!redeemed) {
      return NextResponse.json(
        { error: 'O voucher já foi utilizado ou alterado por outro operador.' },
        { status: 409 },
      );
    }

    const service = Array.isArray(redeemed.services)
      ? redeemed.services[0]
      : redeemed.services;
    const servicePrice = Number(service?.price ?? 0);

    return NextResponse.json({
      ok: true,
      voucher: {
        id: redeemed.id,
        code: redeemed.code,
        clientId: redeemed.client_id,
        serviceId: redeemed.service_id,
        rewardType: redeemed.reward_type,
        status: redeemed.status,
        appointmentId: redeemed.appointment_id,
        redeemedAt: redeemed.redeemed_at,
      },
      reward: {
        serviceName: service?.name ?? null,
        servicePrice,
        discountAmount: servicePrice,
      },
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETING_VOUCHER_REDEEM]', error);
    return NextResponse.json(
      { error: 'Não foi possível validar o voucher.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(
  '/api/marketing/vouchers/[code]',
  POSTHandler,
);
