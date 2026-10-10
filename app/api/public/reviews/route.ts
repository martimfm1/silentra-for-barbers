import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 80;
const MAX_COMMENT_LENGTH = 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function POSTHandler(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      barbershopId?: unknown;
      clientName?: unknown;
      rating?: unknown;
      comment?: unknown;
    };

    const shopId = cleanString(body.barbershopId, 100);
    const clientName = cleanString(body.clientName, MAX_NAME_LENGTH);
    const comment = cleanString(body.comment, MAX_COMMENT_LENGTH);
    const rating =
      typeof body.rating === 'number' ? body.rating : Number(body.rating);

    if (!shopId || !clientName)
      return jsonError('Dados da avaliação inválidos.', 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return jsonError('A classificação deve estar entre 1 e 5.', 400);
    }

    const database = createAdminClient();
    const { data: shop, error: shopError } = await database
      .from('shops')
      .select('id, barbershop_id, public_profile_enabled')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError || !shop) return jsonError('Barbearia não encontrada.', 404);
    if (shop.public_profile_enabled === false)
      return jsonError('Esta barbearia não aceita avaliações públicas.', 403);

    const { data, error } = await database
      .from('reviews')
      .insert({
        barbershop_id: shop.id,
        client_name: clientName,
        rating,
        comment,
      })
      .select('id, client_name, rating, comment, created_at')
      .single();

    if (error || !data) {
      return jsonError('Não foi possível guardar a avaliação.', 500);
    }

    const { data: aggregateRows } = await database
      .from('reviews')
      .select('rating')
      .eq('barbershop_id', shop.id);

    const count = aggregateRows?.length ?? 0;
    const average =
      count > 0
        ? Number(
            (
              aggregateRows!.reduce(
                (sum, row) => sum + Number(row.rating || 0),
                0,
              ) / count
            ).toFixed(1),
          )
        : 0;

    await database
      .from('shops')
      .update({
        rating: average,
        reviews_count: count,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shop.id);

    return NextResponse.json(
      { data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return jsonError('Não foi possível processar a avaliação.', 500);
  }
}


export const POST = withApiLogging('/api/public/reviews', POSTHandler);
