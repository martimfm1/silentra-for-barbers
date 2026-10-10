import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

const MODES = ['refund', 'void'] as const;
type Mode = (typeof MODES)[number];

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

async function POSTHandler(request: Request, context: RouteContext) {
  try {
    const { admin, barbershopId, userId } = await requireModuleContext(
      'pos',
      'pos',
    );
    const { transactionId } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction id' },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const mode = typeof body?.mode === 'string' ? body.mode : 'refund';

    if (!MODES.includes(mode as Mode)) {
      return NextResponse.json(
        { error: 'Invalid reversal mode' },
        { status: 400 },
      );
    }

    const { data, error } = await admin.rpc('refund_pos_transaction_atomic', {
      p_transaction_id: transactionId,
      p_barbershop_id: barbershopId,
      p_user_id: userId,
      p_mode: mode,
    });

    if (error || !data) {
      const message = error?.message ?? 'Unable to reverse POS transaction';

      if (/does not belong/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 403 });
      }

      if (/only completed transactions/i.test(message)) {
        return NextResponse.json(
          { error: message, code: 'TRANSACTION_NOT_REVERSIBLE' },
          { status: 409 },
        );
      }

      throw error ?? new Error(message);
    }

    return NextResponse.json({ transaction: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;

    return NextResponse.json(
      { error: 'Unable to reverse POS transaction' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(
  '/api/enterprise/pos/[transactionId]/reversal',
  POSTHandler,
);
