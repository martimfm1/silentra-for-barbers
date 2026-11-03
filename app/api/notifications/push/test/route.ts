import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { sendWebPushToUser } from '@/lib/notifications/providers/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PUSH_ALLOWED_ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

async function POST__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, PUSH_ALLOWED_ROLES);
  if (!tenant.ok) {
    return NextResponse.json(
      { success: false, error: tenant.status === 401 ? 'Não autenticado.' : 'Sem permissão para enviar notificações.' },
      { status: tenant.status },
    );
  }
  const result = await sendWebPushToUser(tenant.userId, {
    title: 'Silentra for Barbers',
    body: 'As notificações estão configuradas e prontas a funcionar neste dispositivo.',
    url: '/dashboard/settings',
    tag: 'silentra-push-test',
  });
  if (result.sent === 0) return NextResponse.json({ success: false, error: 'Não existe uma subscrição ativa neste dispositivo.' }, { status: 409 });
  if (result.failed > 0) return NextResponse.json({ success: false, error: 'A notificação de teste não foi entregue a todos os dispositivos.' }, { status: 502 });
  return NextResponse.json({ success: true });
}
export const POST = withApiObservability('/api/notifications/push/test', POST__unobserved);
