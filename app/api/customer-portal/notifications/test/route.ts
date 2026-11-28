import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { getPortalSession } from '@/lib/customer-booking-portal';
import { assertSameOrigin } from '@/services/billing/http';
import { sendWebPushToCustomerEmail } from '@/lib/notifications/providers/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ success: false, error: 'A origem do pedido não pôde ser validada.' }, { status: 403 });
  }

  const session = await getPortalSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Confirma novamente o teu email.' }, { status: 401 });
  }

  const result = await sendWebPushToCustomerEmail(session.email, {
    title: 'Silentra · Notificações ativas',
    body: 'Está tudo pronto. Vais receber atualizações importantes das tuas marcações neste dispositivo.',
    url: '/my-bookings',
    tag: 'customer-push-test',
  });

  if (result.sent === 0) {
    return NextResponse.json(
      { success: false, error: 'Não existe uma subscrição ativa neste dispositivo.' },
      { status: 409 },
    );
  }
  if (result.failed > 0) {
    return NextResponse.json(
      { success: false, error: 'Não foi possível entregar a notificação de teste.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = withApiObservability('/api/customer-portal/notifications/test', POST__unobserved);
