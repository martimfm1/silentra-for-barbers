import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTimeSlots } from '@/app/barbershops/utils/booking-slots';
import { isSafePublicBookingDate, UUID_PATTERN } from '@/lib/validation';

async function GET__unobserved(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: shopId } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (
      !UUID_PATTERN.test(shopId) ||
      !dateParam ||
      !isSafePublicBookingDate(dateParam)
    ) {
      return NextResponse.json(
        { error: "O parâmetro 'date' é obrigatório no formato YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const selectedDate = new Date(`${dateParam}T00:00:00`);
    const dayOfWeek = selectedDate.getDay(); // 0 = Domingo, 1 = Segunda...

    const supabase = await createClient();

    const { data: shop, error } = await supabase
      .from('shops')
      .select(
        `
        id,
        barbershops (
          name,
          opening_time,
          closing_time,
          off_days
        )
      `,
      )
      .eq('id', shopId)
      .single();

    if (error || !shop) {
      return NextResponse.json(
        { error: 'Barbearia não encontrada' },
        { status: 404 },
      );
    }

    const barbershop = Array.isArray(shop.barbershops)
      ? shop.barbershops[0]
      : shop.barbershops;

    const offDays: number[] = barbershop?.off_days || [0];

    // Validação de Dia de Folga
    if (offDays.includes(dayOfWeek)) {
      return NextResponse.json(
        {
          shopId,
          date: dateParam,
          isClosed: true,
          message: 'A barbearia está encerada/de folga neste dia.',
          slots: [],
        },
        { headers: { 'Cache-Control': 'private, no-cache' } },
      );
    }

    const openTime = barbershop?.opening_time
      ? barbershop.opening_time.substring(0, 5)
      : '09:00';
    const closeTime = barbershop?.closing_time
      ? barbershop.closing_time.substring(0, 5)
      : '19:00';

    const slots = generateTimeSlots(openTime, closeTime, 30);

    return NextResponse.json(
      {
        shopId,
        date: dateParam,
        isClosed: false,
        slots,
      },
      { headers: { 'Cache-Control': 'private, no-cache' } },
    );
  } catch (error) {
    console.error('[API_SLOTS_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar horários' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/shops/[id]/slots',
  GET__unobserved,
);
