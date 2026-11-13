import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getDailySchedule,
  isSlotWithinDailySchedule,
  normalizeWeeklySchedule,
  timeToMinutes,
} from '@/lib/scheduling/weekly-schedule';
import { isSafePublicBookingDate, UUID_PATTERN } from '@/lib/validation';
import { isBeforeMinimumBookingNotice } from '@/lib/bookings/minimum-notice';

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

    const selectedDate = new Date(`${dateParam}T12:00:00`);
    const dayOfWeek = selectedDate.getDay();

    const supabase = await createClient();
    const { data: shop, error } = await supabase
      .from('shops')
      .select(
        `
        id,
        barbershop_id,
        barbershops (
          name,
          opening_time,
          closing_time,
          lunch_start,
          lunch_end,
          closed_days,
          weekly_schedule,
          minimum_booking_notice_minutes
        )
      `,
      )
      .eq('id', shopId)
      .single();

    if (error || !shop?.barbershop_id) {
      return NextResponse.json(
        { error: 'Barbearia não encontrada' },
        { status: 404 },
      );
    }

    const barbershop = Array.isArray(shop.barbershops)
      ? shop.barbershops[0]
      : shop.barbershops;
    if (!barbershop) {
      return NextResponse.json(
        { error: 'Configuração da barbearia indisponível.' },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const { data: professionals, error: professionalsError } = await admin
      .from('professionals')
      .select('id,weekly_schedule')
      .eq('barbershop_id', shop.barbershop_id)
      .eq('active', true);

    if (professionalsError) {
      console.error('[API_SLOTS_PROFESSIONALS_ERROR]', professionalsError.code);
      return NextResponse.json(
        { error: 'Não foi possível carregar os horários dos barbeiros.' },
        { status: 503 },
      );
    }

    const shopSchedule = normalizeWeeklySchedule(
      barbershop.weekly_schedule,
      barbershop,
    );
    const minimumNoticeMinutes = Math.max(
      0,
      Math.min(43200, Number(barbershop.minimum_booking_notice_minutes ?? 0)),
    );
    const scheduleSources =
      professionals && professionals.length > 0
        ? professionals.map((professional) =>
            professional.weekly_schedule
              ? normalizeWeeklySchedule(professional.weekly_schedule)
              : shopSchedule,
          )
        : [shopSchedule];

    const slotSet = new Set<string>();
    for (const schedule of scheduleSources) {
      const day = getDailySchedule(schedule, dayOfWeek);
      if (day.day_off) continue;
      for (const period of day.work_intervals) {
        const from = timeToMinutes(period.start);
        const to = timeToMinutes(period.end);
        for (let start = from; start + 30 <= to; start += 30) {
          if (!isSlotWithinDailySchedule(day, start, start + 30)) continue;
          const slot = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
          if (
            !isBeforeMinimumBookingNotice(
              dateParam,
              slot,
              minimumNoticeMinutes,
            )
          )
            slotSet.add(slot);
        }
      }
    }

    const slots = Array.from(slotSet).sort();
    return NextResponse.json(
      {
        shopId,
        date: dateParam,
        isClosed: slots.length === 0,
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
