import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

const QR_MANAGE_ROLES = ['owner', 'admin'] as const;
const DEFAULT_QR_TEXT =
  'Scaneia para conhecer a nossa barbearia e marcar o teu proximo servico.';

async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, QR_MANAGE_ROLES);
  if (!tenant.ok)
    return NextResponse.json(
      { error: tenant.status === 401 ? 'Nao autenticado.' : 'Sem permissao.' },
      { status: tenant.status },
    );
  const [{ data: barbershop }, { data: shop }] = await Promise.all([
    tenant.admin
      .from('barbershops')
      .select('name, qr_code_text')
      .eq('id', tenant.barbershopId)
      .maybeSingle(),
    tenant.admin
      .from('shops')
      .select('slug')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);
  if (!shop?.slug)
    return NextResponse.json(
      { error: 'Nao foi possivel preparar o codigo QR.' },
      { status: 404 },
    );
  return NextResponse.json(
    {
      slug: shop.slug,
      name: barbershop?.name || 'Barbearia',
      text: barbershop?.qr_code_text || DEFAULT_QR_TEXT,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function PATCH__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, QR_MANAGE_ROLES);
  if (!tenant.ok)
    return NextResponse.json(
      { error: tenant.status === 401 ? 'Nao autenticado.' : 'Sem permissao.' },
      { status: tenant.status },
    );
  const body: unknown = await request.json().catch(() => null);
  const text =
    typeof (body as { text?: unknown } | null)?.text === 'string'
      ? (body as { text: string }).text.trim()
      : '';
  if (text.length > 160)
    return NextResponse.json(
      { error: 'O texto pode ter no maximo 160 caracteres.' },
      { status: 400 },
    );
  const { error } = await tenant.admin
    .from('barbershops')
    .update({ qr_code_text: text || null })
    .eq('id', tenant.barbershopId);
  if (error)
    return NextResponse.json(
      { error: 'Nao foi possivel guardar o texto.' },
      { status: 500 },
    );
  return NextResponse.json({ text: text || DEFAULT_QR_TEXT });
}

export const GET = withApiObservability('/api/barbershops/qr-code', GET__unobserved);
export const PATCH = withApiObservability('/api/barbershops/qr-code', PATCH__unobserved);
