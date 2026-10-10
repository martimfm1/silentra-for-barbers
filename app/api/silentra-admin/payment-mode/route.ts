import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { BillingError } from '@/types/stripe';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import {
  PaymentModeService,
  PAYMENT_MODES,
  type PaymentMode,
} from '@/services/billing/payment-mode.service';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertSameOrigin,
  billingErrorResponse,
} from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GET__unobserved() {
  try {
    await requirePlatformAdmin();
    const paymentMode = await PaymentModeService.getPaymentMode();
    return NextResponse.json(
      { ok: true, paymentMode },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Não foi possível carregar o método de pagamento.' },
      { status: 404 },
    );
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, user } = await requirePlatformAdmin();
    const body = (await request.json().catch(() => null)) as {
      paymentMode?: unknown;
    } | null;
    const paymentMode = body?.paymentMode;

    if (!PAYMENT_MODES.includes(paymentMode as PaymentMode)) {
      return NextResponse.json(
        { ok: false, error: 'Método de pagamento inválido.' },
        { status: 400 },
      );
    }

    const current = await PaymentModeService.getPaymentMode();
    if (current === paymentMode) {
      return NextResponse.json(
        { ok: true, paymentMode: current },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const nextMode = paymentMode as PaymentMode;
    await PaymentModeService.setPaymentMode(nextMode, user.id);

    const { error: auditError } = await admin.from('audit_logs').insert({
      action: 'PAYMENT_MODE_CHANGED',
      entity_type: 'platform_settings',
      entity_id: 'payment_mode',
      metadata: {
        actor_user_id: user.id,
        previous_mode: current,
        payment_mode: nextMode,
      },
      created_at: new Date().toISOString(),
    });

    if (auditError)
      console.error('[PAYMENT_MODE_AUDIT_ERROR]', auditError.code);

    return NextResponse.json(
      { ok: true, paymentMode: nextMode },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404 },
      );
    if (error instanceof BillingError) {
      const response = billingErrorResponse(error);
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: response.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    console.error('[PAYMENT_MODE_PATCH]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível alterar o método de pagamento.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/silentra-admin/payment-mode', GET__unobserved);
export const PATCH = withApiObservability('/api/silentra-admin/payment-mode', PATCH__unobserved);
