import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { isRecord } from '@/lib/validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

async function PATCHHandler(request: Request) {
  const tenant = await requireTenantAuthorization(request, ['owner', 'admin']);
  if (!tenant.ok)
    return NextResponse.json(
      {
        error:
          tenant.status === 401
            ? 'Sessão inválida.'
            : 'Sem permissão para alterar o avatar.',
      },
      { status: tenant.status },
    );

  const body: unknown = await request.json().catch(() => null);
  const avatarUrl =
    isRecord(body) && typeof body.avatarUrl === 'string'
      ? body.avatarUrl.trim()
      : '';
  const expectedPath = `/storage/v1/object/public/avatar/${tenant.barbershopId}/avatar.webp`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(avatarUrl);
  } catch {
    return NextResponse.json(
      { error: 'O endereço do avatar é inválido.' },
      { status: 400 },
    );
  }
  if (parsedUrl.pathname !== expectedPath)
    return NextResponse.json(
      { error: 'O endereço do avatar não pertence à tua barbearia.' },
      { status: 400 },
    );

  const { error } = await tenant.admin
    .from('barbershops')
    .update({ avatar_url: avatarUrl })
    .eq('id', tenant.barbershopId);
  if (error) {
    console.error('[BARBERSHOP_AVATAR_UPDATE_FAIL]', error.code ?? 'UNKNOWN');
    return NextResponse.json(
      { error: 'Não foi possível guardar o avatar.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, avatarUrl });
}

export const PATCH = withApiLogging('/api/barbershops/avatar', PATCHHandler);
