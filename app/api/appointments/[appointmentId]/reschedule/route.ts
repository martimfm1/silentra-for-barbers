import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { UUID_PATTERN, isValidDate } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import { hasPlanFeature } from '@/lib/billing/plan-features';
import { resolveAccessPlanForUser } from '@/services/billing/plan-access.guard';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { sendBrevoEmail } from '@/lib/email/brevo';

const ROLES = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
] as const;

function hasAgendaGrant(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  return permissions.agenda === true || permissions.appointments === true;
}

function minutes(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function getLisbonOffsetMinutes(instant: Date): number {
  const value = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(value ?? 'GMT');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0));
}

function getLisbonDayBounds(date: string): {
  start: string;
  endExclusive: string;
} {
  const [year, month, day] = date.split('-').map(Number);
  const startUtc = Date.UTC(year, month - 1, day);
  const nextDayUtc = Date.UTC(year, month - 1, day + 1);
  const startOffset = getLisbonOffsetMinutes(new Date(startUtc));
  const nextOffset = getLisbonOffsetMinutes(new Date(nextDayUtc));
  return {
    start: new Date(startUtc - startOffset * 60_000).toISOString(),
    endExclusive: new Date(nextDayUtc - nextOffset * 60_000).toISOString(),
  };
}

function getLisbonParts(value: string | Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value instanceof Date ? value.getTime() : value));
  const field = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: field('year') + '-' + field('month') + '-' + field('day'),
    time: field('hour') + ':' + field('minute'),
  };
}

function toLisbonISOString(date: string, time: string): string | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getLisbonOffsetMinutes(new Date(wallClockAsUtc));
  const firstInstant = new Date(wallClockAsUtc - firstOffset * 60_000);
  const actualOffset = getLisbonOffsetMinutes(firstInstant);
  const instant = new Date(wallClockAsUtc - actualOffset * 60_000);
  const local = getLisbonParts(instant);
  if (local.date !== date || local.time !== time) return null;
  return instant.toISOString();
}

function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function formatLisbonDate(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'full',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value instanceof Date ? value.getTime() : value));
}

function formatLisbonTime(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value instanceof Date ? value.getTime() : value));
}

async function PATCH__unobserved(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const { appointmentId } = await context.params;
    if (!UUID_PATTERN.test(appointmentId)) {
      return NextResponse.json(
        { success: false, error: 'Identificador de marcação inválido.' },
        { status: 400 },
      );
    }

    const tenant = await requireTenantAuthorization(request, ROLES);
    if (!tenant.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            tenant.status === 401
              ? 'Sessão inválida.'
              : 'Sem permissão para alterar marcações.',
        },
        { status: tenant.status },
      );
    }
    if (tenant.role !== 'owner') {
      const { data: grant, error: grantError } = await tenant.admin
        .from('barbershop_member_permissions')
        .select('permissions')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('user_id', tenant.userId)
        .maybeSingle();
      if (grantError)
        return NextResponse.json(
          {
            success: false,
            error: 'Não foi possível validar as permissões da agenda.',
          },
          { status: 503 },
        );
      let allowed = grant ? hasAgendaGrant(grant.permissions) : false;
      if (!grant) {
        const { data: legacy, error } = await tenant.admin
          .from('staff_permissions')
          .select('allowed')
          .eq('barbershop_id', tenant.barbershopId)
          .eq('user_id', tenant.userId)
          .in('permission', ['agenda', 'appointments'])
          .eq('allowed', true)
          .limit(1)
          .maybeSingle();
        if (error)
          return NextResponse.json(
            {
              success: false,
              error: 'Não foi possível validar as permissões da agenda.',
            },
            { status: 503 },
          );
        allowed = legacy?.allowed === true;
      }
      if (!allowed)
        return NextResponse.json(
          { success: false, error: 'Sem permissão para alterar marcações.' },
          { status: 403 },
        );
    }
    const plan = await resolveAccessPlanForUser(tenant.userId);
    if (!hasPlanFeature(plan, 'appointments'))
      return NextResponse.json(
        {
          success: false,
          error: 'A agenda não está incluída no plano desta barbearia.',
        },
        { status: 403 },
      );

    const bodyResult = await readJsonObject(request, {
      maxBytes: 2048,
      allowedKeys: ['date', 'time'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const date =
      typeof bodyResult.value.date === 'string' ? bodyResult.value.date : '';
    const time =
      typeof bodyResult.value.time === 'string' ? bodyResult.value.time : '';
    if (!isValidDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return NextResponse.json(
        { success: false, error: 'Indica uma data e hora válidas.' },
        { status: 400 },
      );
    }

    const { admin, barbershopId } = tenant;
    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select(
        'id,status,date_hour,duration_minutes,professional_id,service_id,manual_email,manual_name,client_id',
      )
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (appointmentError)
      return NextResponse.json(
        { success: false, error: 'Não foi possível consultar a marcação.' },
        { status: 503 },
      );
    if (!appointment)
      return NextResponse.json(
        { success: false, error: 'Marcação não encontrada.' },
        { status: 404 },
      );
    if (!['pending', 'scheduled'].includes(appointment.status))
      return NextResponse.json(
        {
          success: false,
          error: 'Só podes remarcar marcações pendentes ou confirmadas.',
        },
        { status: 409 },
      );

    const todayParts = getLisbonParts(new Date());
    if (
      date < todayParts.date ||
      (date === todayParts.date && time <= todayParts.time)
    ) {
      return NextResponse.json(
        { success: false, error: 'A nova data tem de estar no futuro.' },
        { status: 400 },
      );
    }
    const newDateHour = toLisbonISOString(date, time);
    if (!newDateHour) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Esta hora local não existe devido à mudança de hora. Escolhe outro horário.',
        },
        { status: 400 },
      );
    }
    const duration = Math.min(
      Math.max(Number(appointment.duration_minutes ?? 30), 1),
      1440,
    );
    const startMinutes = minutes(time);
    const endMinutes = startMinutes + duration;

    const [
      { data: shop, error: shopError },
      { data: blocks, error: blocksError },
      { data: others, error: othersError },
    ] = await Promise.all([
      admin
        .from('barbershops')
        .select(
          'name,address,opening_time,closing_time,lunch_start,lunch_end,closed_days',
        )
        .eq('id', barbershopId)
        .maybeSingle(),
      admin
        .from('schedule_blocks')
        .select('professional_id,start_time,end_time,reason')
        .eq('barbershop_id', barbershopId)
        .eq('date', date),
      (() => {
        const bounds = getLisbonDayBounds(date);
        return admin
          .from('appointments')
          .select('id,date_hour,duration_minutes,professional_id')
          .eq('barbershop_id', barbershopId)
          .gte('date_hour', bounds.start)
          .lt('date_hour', bounds.endExclusive)
          .in('status', ['pending', 'scheduled'])
          .neq('id', appointmentId);
      })(),
    ]);
    if (shopError || blocksError || othersError)
      return NextResponse.json(
        {
          success: false,
          error: 'Não foi possível validar a disponibilidade.',
        },
        { status: 503 },
      );

    const closedDays = Array.isArray(shop?.closed_days)
      ? shop.closed_days
      : String(shop?.closed_days ?? '')
          .split(',')
          .map((day) => day.trim().toLowerCase());
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const weekdayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    if (
      closedDays.includes(weekday) ||
      closedDays.includes(weekdayNames[weekday])
    )
      return NextResponse.json(
        { success: false, error: 'A barbearia está fechada nesse dia.' },
        { status: 409 },
      );
    const opening = minutes(String(shop?.opening_time ?? '09:00'));
    const closing = minutes(String(shop?.closing_time ?? '19:00'));
    if (startMinutes < opening || endMinutes > closing)
      return NextResponse.json(
        {
          success: false,
          error: 'O horário está fora do horário de funcionamento.',
        },
        { status: 409 },
      );
    if (
      shop?.lunch_start &&
      shop?.lunch_end &&
      startMinutes < minutes(shop.lunch_end) &&
      endMinutes > minutes(shop.lunch_start)
    )
      return NextResponse.json(
        {
          success: false,
          error: 'O horário coincide com a pausa da barbearia.',
        },
        { status: 409 },
      );

    const block = (blocks ?? []).find(
      (item) =>
        (!item.professional_id ||
          item.professional_id === appointment.professional_id) &&
        (!item.start_time ||
          !item.end_time ||
          (startMinutes < minutes(item.end_time) &&
            endMinutes > minutes(item.start_time))),
    );
    if (block)
      return NextResponse.json(
        {
          success: false,
          error: String(block.reason || 'O horário está bloqueado.'),
        },
        { status: 409 },
      );
    const conflict = (others ?? []).some((item) => {
      if (item.professional_id !== appointment.professional_id) return false;
      const local = getLisbonParts(String(item.date_hour ?? ''));
      if (local.date !== date) return false;
      const otherStart = minutes(local.time);
      const otherEnd =
        otherStart +
        Math.min(Math.max(Number(item.duration_minutes ?? 30), 1), 1440);
      return startMinutes < otherEnd && endMinutes > otherStart;
    });
    if (conflict)
      return NextResponse.json(
        {
          success: false,
          error: 'Este horário já está ocupado. Escolhe outro.',
        },
        { status: 409 },
      );

    const { data: updated, error: updateError } = await admin
      .from('appointments')
      .update({ date_hour: newDateHour })
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId)
      .in('status', ['pending', 'scheduled'])
      .select('id,date_hour,status')
      .maybeSingle();
    if (updateError) {
      if (updateError.code === '23P01' || updateError.code === '23505')
        return NextResponse.json(
          {
            success: false,
            error: 'Este horário acabou de ser ocupado. Escolhe outro.',
          },
          { status: 409 },
        );
      console.error(
        '[PRO_APPOINTMENT_RESCHEDULE_ERROR]',
        updateError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { success: false, error: 'Não foi possível remarcar a marcação.' },
        { status: 503 },
      );
    }
    if (!updated)
      return NextResponse.json(
        {
          success: false,
          error:
            'A marcação já foi alterada. Atualiza a agenda e tenta novamente.',
        },
        { status: 409 },
      );
    const [{ data: service }, { data: client }] = await Promise.all([
      appointment.service_id
        ? admin
            .from('services')
            .select('name')
            .eq('id', appointment.service_id)
            .eq('barbershop_id', barbershopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appointment.client_id
        ? admin
            .from('users')
            .select('email,name_complete')
            .eq('id', appointment.client_id)
            .eq('barbershop_id', barbershopId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const recipientEmail =
      appointment.manual_email?.trim().toLowerCase() ||
      client?.email?.trim().toLowerCase() ||
      '';
    const recipientName =
      appointment.manual_name?.trim() ||
      client?.name_complete?.trim() ||
      'Cliente';
    let notificationSent = false;
    if (recipientEmail) {
      try {
        const previousDate = formatLisbonDate(appointment.date_hour);
        const previousTime = formatLisbonTime(appointment.date_hour);
        const nextDate = formatLisbonDate(updated.date_hour);
        const nextTime = formatLisbonTime(updated.date_hour);
        const barbershopName = String(shop?.name || 'A tua barbearia').trim();
        const serviceName = String(service?.name || 'Serviço').trim();
        const htmlContent = `<!doctype html><html lang="pt-PT"><body style="margin:0;padding:24px;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:560px;margin:auto;padding:28px;border:1px solid #e4e4e7;border-radius:16px;background:#fff"><p style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#52525b">${escapeEmailHtml(barbershopName)}</p><h1 style="font-size:24px;margin-bottom:12px">A tua marcação foi alterada</h1><p>Olá ${escapeEmailHtml(recipientName)},</p><p>A barbearia alterou a data ou hora da tua marcação. Consulta os novos detalhes abaixo.</p><p><strong>Serviço:</strong> ${escapeEmailHtml(serviceName)}</p><div style="margin:20px 0;padding:16px;border-radius:12px;background:#f4f4f5"><p style="margin:0 0 8px;color:#71717a;font-size:12px">HORÁRIO ANTERIOR</p><p style="margin:0;text-decoration:line-through">${escapeEmailHtml(previousDate)} às ${escapeEmailHtml(previousTime)}</p><p style="margin:18px 0 8px;color:#047857;font-size:12px;font-weight:bold">NOVO HORÁRIO</p><p style="margin:0;font-size:18px;font-weight:bold">${escapeEmailHtml(nextDate)} às ${escapeEmailHtml(nextTime)}</p></div><p>Se este horário não te for conveniente, contacta a barbearia para combinar uma alternativa.</p><p style="margin-top:28px;color:#71717a;font-size:12px">Mensagem automática enviada pela Silentra for Barbers.</p></main></body></html>`;
        const result = await sendBrevoEmail({
          to: recipientEmail,
          toName: recipientName,
          senderName: barbershopName,
          subject: `A tua marcação foi alterada — ${barbershopName}`,
          htmlContent,
        });
        notificationSent = result.success;
      } catch (emailError) {
        console.error(
          '[PRO_APPOINTMENT_RESCHEDULE_EMAIL_ERROR]',
          emailError instanceof Error ? emailError.name : 'UNKNOWN',
        );
      }
      if (!notificationSent)
        console.error('[PRO_APPOINTMENT_RESCHEDULE_EMAIL_FAILED]');
    }

    await admin.from('audit_logs').insert({
      action: 'professional_appointment_reschedule',
      entity_type: 'appointment',
      entity_id: appointmentId,
      metadata: {
        from: appointment.date_hour,
        to: newDateHour,
        actorId: tenant.userId,
        notificationSent,
      },
    });
    return NextResponse.json(
      { success: true, appointment: updated, notificationSent },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[PRO_APPOINTMENT_RESCHEDULE_CRITICAL]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { success: false, error: 'Erro interno ao remarcar a marcação.' },
      { status: 500 },
    );
  }
}

export const PATCH = withApiObservability(
  '/api/appointments/[appointmentId]/reschedule',
  PATCH__unobserved,
);
