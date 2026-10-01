import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { ManualPaymentService } from '@/services/billing/manual-payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ requestId: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { user } = await requirePlatformAdmin();
    const { requestId } = await params;
    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      paymentLink?: unknown;
      reason?: unknown;
    } | null;

    const action = body?.action;

    if (action === 'send_payment' || action === 'resend_payment') {
      const existing = await ManualPaymentService.getRequest(requestId);
      if (!existing)
        return json({ ok: false, error: 'Pedido de subscrição não encontrado.' }, 404);

      const paymentLink =
        typeof body?.paymentLink === 'string' && body.paymentLink.trim()
          ? body.paymentLink
          : existing.payment_link;

      if (!paymentLink)
        return json(
          { ok: false, error: 'Introduz primeiro o link de pagamento.' },
          400,
        );

      const result = await ManualPaymentService.sendPayment(
        requestId,
        paymentLink,
        user.id,
      );

      if (!result.sent)
        return json({ ok: false, error: result.error }, 502);

      return json({ ok: true, status: 'PAYMENT_SENT' });
    }

    if (action === 'confirm_payment') {
      const result = await ManualPaymentService.confirmPayment(
        requestId,
        user.id,
      );
      return json({
        ok: true,
        status: 'PAID',
        subscription: result,
        activationEmailSent: result.emailSent,
      });
    }

    if (action === 'reject') {
      const result = await ManualPaymentService.reject(
        requestId,
        user.id,
        typeof body?.reason === 'string' ? body.reason : undefined,
      );
      return json(result);
    }

    return json({ ok: false, error: 'Ação administrativa inválida.' }, 400);
  } catch (error) {
    console.error('[MANUAL_REQUEST_PATCH]', error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o pedido.',
      },
      500,
    );
  }
}
