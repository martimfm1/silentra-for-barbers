import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { ManualPaymentService } from '@/services/billing/manual-payment.service';
import type { ManualRequestStatus } from '@/services/billing/manual-payment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses = new Set<ManualRequestStatus>([
  'PENDING',
  'PAYMENT_SENT',
  'PAID',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const statusParam = new URL(request.url).searchParams.get('status');
    const status = statuses.has(statusParam as ManualRequestStatus)
      ? (statusParam as ManualRequestStatus)
      : undefined;

    const rows = await ManualPaymentService.listRequests(status);
    const admin = (await import('@/lib/supabase/admin')).createAdminClient();

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const shopIds = [...new Set(rows.map((row) => row.barbershop_id))];

    const [{ data: users }, { data: shops }] = await Promise.all([
      userIds.length
        ? admin
            .from('users')
            .select('id, name_complete, email')
            .in('id', userIds)
        : Promise.resolve({ data: [] }),
      shopIds.length
        ? admin.from('barbershops').select('id, name').in('id', shopIds)
        : Promise.resolve({ data: [] }),
    ]);

    const usersById = new Map(
      (users ?? []).map((user) => [user.id, user]),
    );
    const shopsById = new Map(
      (shops ?? []).map((shop) => [shop.id, shop]),
    );

    return NextResponse.json(
      {
        ok: true,
        requests: rows.map((row) => ({
          ...row,
          customer: usersById.get(row.user_id) ?? null,
          barbershop: shopsById.get(row.barbershop_id) ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError')
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    console.error('[MANUAL_REQUESTS_GET]', error);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível carregar os pedidos de subscrição.' },
      { status: 500 },
    );
  }
}
