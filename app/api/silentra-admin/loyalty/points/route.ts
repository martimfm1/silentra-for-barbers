import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { BillingError } from '@/types/stripe';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import {
  assertSameOrigin,
  billingErrorResponse,
} from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin } = await requirePlatformAdmin();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const points = Number(body?.points);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }
    if (!Number.isInteger(points) || points <= 0 || points > 1000000) {
      return NextResponse.json(
        { error: 'Os pontos devem ser um inteiro entre 1 e 1.000.000.' },
        { status: 400 },
      );
    }
    if (!reason || reason.length > 500) {
      return NextResponse.json(
        { error: 'Indica um motivo (máx. 500 caracteres).' },
        { status: 400 },
      );
    }

    const { data, error } = await admin.rpc(
      'admin_grant_loyalty_points_by_email',
      {
        p_email: email,
        p_points: points,
        p_reason: reason,
      },
    );

    if (error) {
      if (error.message === 'LOYALTY_MEMBER_NOT_FOUND') {
        return NextResponse.json(
          {
            error: 'Não existe um membro ativo de fidelização com esse email.',
          },
          { status: 404 },
        );
      }
      console.error('[SILENTRA_ADMIN_LOYALTY_GRANT]', error);
      return NextResponse.json(
        { error: 'Não foi possível atribuir os pontos.' },
        { status: 500 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(
      { ok: true, member: result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (error instanceof BillingError) {
      const response = billingErrorResponse(error);
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: response.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('[SILENTRA_ADMIN_LOYALTY_GRANT]', error);
    return NextResponse.json(
      { error: 'Não foi possível atribuir os pontos.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/silentra-admin/loyalty/points',
  POST__unobserved,
);
