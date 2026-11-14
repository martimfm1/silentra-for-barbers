import { sendBrevoEmail } from '@/lib/email/brevo';
import { sendWebPushToUsers } from '@/lib/notifications/providers/push';
import { createAdminClient } from '@/lib/supabase/admin';

type AppointmentChangeBase = {
  appointmentId: string;
  barbershopId: string;
  professionalId: string | null;
  customerName: string;
  serviceName: string;
};

export type BarberAppointmentChange =
  | (AppointmentChangeBase & {
      event: 'cancelled';
      dateHour: string;
    })
  | (AppointmentChangeBase & {
      event: 'rescheduled';
      previousDateHour: string;
      newDateHour: string;
    });

export type BarberAppointmentChangeResult = {
  recipients: number;
  emailsSent: number;
  pushSent: number;
};

type Language = 'pt' | 'en';

function escapeHtml(value: string): string {
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

function safeSubject(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function formatDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
    dateStyle: 'full',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

function formatTime(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

function appointmentDateTime(value: string, language: Language): string {
  const date = formatDate(value, language);
  const time = formatTime(value, language);
  return time ? `${date} · ${time}` : date;
}

async function getBarberRecipients(
  barbershopId: string,
  professionalId: string | null,
): Promise<Array<{ userId: string; email: string | null; name: string }>> {
  const admin = createAdminClient();

  if (professionalId) {
    const { data: professional, error: professionalError } = await admin
      .from('professionals')
      .select('user_id,name')
      .eq('id', professionalId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (professionalError) {
      console.error(
        '[BARBER_APPOINTMENT_CHANGE_PROFESSIONAL_LOOKUP_FAILED]',
        professionalError.code ?? 'UNKNOWN',
      );
    }

    if (professional?.user_id) {
      const { data: user, error: userError } = await admin
        .from('users')
        .select('id,email,name_complete')
        .eq('id', professional.user_id)
        .eq('barbershop_id', barbershopId)
        .maybeSingle();

      if (userError) {
        console.error(
          '[BARBER_APPOINTMENT_CHANGE_USER_LOOKUP_FAILED]',
          userError.code ?? 'UNKNOWN',
        );
      }

      if (user?.id) {
        return [{
          userId: user.id,
          email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : null,
          name: user.name_complete?.trim() || professional.name?.trim() || 'Barbeiro',
        }];
      }
    }
  }

  const { data: staff, error } = await admin
    .from('users')
    .select('id,email,name_complete')
    .eq('barbershop_id', barbershopId)
    .in('role', ['barber', 'owner', 'admin']);

  if (error) {
    console.error(
      '[BARBER_APPOINTMENT_CHANGE_RECIPIENT_LOOKUP_FAILED]',
      error.code ?? 'UNKNOWN',
    );
    return [];
  }

  return (staff ?? []).map((user) => ({
    userId: user.id,
    email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : null,
    name: user.name_complete?.trim() || 'Barbeiro',
  }));
}

function buildBarberEmail(input: BarberAppointmentChange, shopName: string, language: Language) {
  const isEnglish = language === 'en';
  const cancelled = input.event === 'cancelled';
  const eventDate = cancelled
    ? appointmentDateTime(input.dateHour, language)
    : appointmentDateTime(input.newDateHour, language);
  const previousDate = input.event === 'rescheduled'
    ? appointmentDateTime(input.previousDateHour, language)
    : null;
  const subject = cancelled
    ? isEnglish
      ? `Customer cancelled a booking — ${input.customerName} — ${eventDate}`
      : `Cliente cancelou uma marcação — ${input.customerName} — ${eventDate}`
    : isEnglish
      ? `Customer changed a booking — ${input.customerName} — ${eventDate}`
      : `Cliente reagendou uma marcação — ${input.customerName} — ${eventDate}`;
  const title = cancelled
    ? isEnglish ? 'The customer cancelled an appointment' : 'O cliente cancelou a marcação'
    : isEnglish ? 'The customer rescheduled an appointment' : 'O cliente reagendou a marcação';
  const description = cancelled
    ? isEnglish
      ? 'The customer cancelled this appointment through the customer portal. The time slot is now available again.'
      : 'O cliente cancelou esta marcação através do portal. O horário ficou novamente disponível.'
    : isEnglish
      ? 'The customer changed the date or time of this appointment through the customer portal.'
      : 'O cliente alterou a data ou hora desta marcação através do portal.';
  const rows: Array<[string, string]> = [
    [isEnglish ? 'Customer' : 'Cliente', input.customerName],
    [isEnglish ? 'Service' : 'Serviço', input.serviceName],
    ...(previousDate
      ? [[isEnglish ? 'Previous time' : 'Horário anterior', previousDate] as [string, string]]
      : []),
    [isEnglish ? (cancelled ? 'Cancelled time' : 'New time') : (cancelled ? 'Horário cancelado' : 'Novo horário'), eventDate],
  ];

  return {
    subject: safeSubject(subject),
    htmlContent: `<!doctype html><html lang="${isEnglish ? 'en' : 'pt-PT'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4e4e7;border-radius:16px"><p style="margin:0 0 8px;color:#71717a;font-size:13px">${escapeHtml(shopName)}</p><h1 style="margin:0 0 12px;font-size:24px">${title}</h1><p style="margin:0 0 20px;line-height:1.6">${description}</p><table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;color:#71717a;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:600;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table><p style="margin:20px 0 0;color:#71717a;font-size:12px">${isEnglish ? 'Booking reference' : 'Referência da marcação'}: ${escapeHtml(input.appointmentId)}</p><p style="margin:18px 0 0;color:#71717a;font-size:12px">${isEnglish ? 'Open your dashboard to view the appointment.' : 'Abre a tua dashboard para consultares a marcação.'}</p></main></body></html>`,
    title,
    pushBody: cancelled
      ? `${input.customerName} · ${input.serviceName} · ${eventDate}`
      : `${input.customerName} · ${input.serviceName} · ${eventDate}`,
  };
}

export async function notifyBarberOfAppointmentChange(
  input: BarberAppointmentChange,
): Promise<BarberAppointmentChangeResult> {
  try {
    const admin = createAdminClient();
    const [{ data: shop, error: shopError }, recipients] = await Promise.all([
      admin
        .from('barbershops')
        .select('name,default_language')
        .eq('id', input.barbershopId)
        .maybeSingle(),
      getBarberRecipients(input.barbershopId, input.professionalId),
    ]);

    if (shopError || !shop) {
      console.error(
        '[BARBER_APPOINTMENT_CHANGE_SHOP_LOOKUP_FAILED]',
        shopError?.code ?? 'UNKNOWN',
      );
      return { recipients: 0, emailsSent: 0, pushSent: 0 };
    }

    const uniqueRecipients = [
      ...new Map(recipients.map((recipient) => [recipient.userId, recipient])).values(),
    ];
    if (uniqueRecipients.length === 0) {
      console.warn('[BARBER_APPOINTMENT_CHANGE_NO_RECIPIENT]');
      return { recipients: 0, emailsSent: 0, pushSent: 0 };
    }

    const language: Language = String(shop.default_language ?? '')
      .toLowerCase()
      .startsWith('en') ? 'en' : 'pt';
    const shopName = String(shop.name || 'Silentra for Barbers').trim();
    const email = buildBarberEmail(input, shopName, language);
    const emailRecipients = [
      ...new Map(
        uniqueRecipients
          .filter((recipient) => recipient.email)
          .map((recipient) => [recipient.email, recipient]),
      ).values(),
    ];

    const emailResults = await Promise.all(emailRecipients.map(async (recipient) => {
      const result = await sendBrevoEmail({
        to: recipient.email!,
        toName: recipient.name,
        senderName: shopName,
        subject: email.subject,
        htmlContent: email.htmlContent,
      });
      if (!result.success)
        console.error('[BARBER_APPOINTMENT_CHANGE_EMAIL_FAILED]');
      return result.success;
    }));

    const push = await sendWebPushToUsers(
      uniqueRecipients.map((recipient) => recipient.userId),
      {
        title: email.title,
        body: email.pushBody,
        url: '/dashboard/agenda',
        tag: `appointment-change-${input.appointmentId}`,
      },
    );

    return {
      recipients: uniqueRecipients.length,
      emailsSent: emailResults.filter(Boolean).length,
      pushSent: push.sent,
    };
  } catch (error) {
    console.error(
      '[BARBER_APPOINTMENT_CHANGE_NOTIFICATION_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return { recipients: 0, emailsSent: 0, pushSent: 0 };
  }
}

export async function sendCustomerAppointmentRescheduledEmail(input: {
  to: string;
  customerName: string;
  barbershopName: string;
  serviceName: string;
  previousDateHour: string;
  newDateHour: string;
  appointmentId: string;
  status: 'pending' | 'scheduled';
  language?: Language;
}) {
  const language = input.language ?? 'pt';
  const isEnglish = language === 'en';
  const previousDate = appointmentDateTime(input.previousDateHour, language);
  const newDate = appointmentDateTime(input.newDateHour, language);
  const shopName = String(input.barbershopName || 'Silentra for Barbers').trim();
  const customerName = input.customerName || (isEnglish ? 'Customer' : 'Cliente');
  const serviceName = input.serviceName || (isEnglish ? 'Service' : 'Serviço');
  const subject = isEnglish
    ? `Your appointment was rescheduled — ${shopName}`
    : `A tua marcação foi alterada — ${shopName}`;
  const title = isEnglish ? 'Your appointment was rescheduled' : 'A tua marcação foi alterada';
  const statusMessage = input.status === 'scheduled'
    ? isEnglish
      ? 'Your appointment remains confirmed for the new time below.'
      : 'A tua marcação continua confirmada para o novo horário abaixo.'
    : isEnglish
      ? 'Your appointment is still awaiting confirmation from the barbershop. The new time will be used once it is confirmed.'
      : 'A tua marcação continua pendente de confirmação da barbearia. O novo horário será utilizado assim que for confirmada.';

  const htmlContent = `<!doctype html><html lang="${isEnglish ? 'en' : 'pt-PT'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:560px;margin:auto;padding:28px;border:1px solid #e4e4e7;border-radius:16px;background:#fff"><p style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#52525b">${escapeHtml(shopName)}</p><h1 style="font-size:24px;margin-bottom:12px">${title}</h1><p>${isEnglish ? 'Hello' : 'Olá'} ${escapeHtml(customerName)},</p><p>${isEnglish ? 'The barbershop changed the date or time of your appointment. Check the updated details below.' : 'A barbearia alterou a data ou hora da tua marcação. Consulta os novos detalhes abaixo.'}</p><p>${statusMessage}</p><p><strong>${isEnglish ? 'Service' : 'Serviço'}:</strong> ${escapeHtml(serviceName)}</p><div style="margin:20px 0;padding:16px;border-radius:12px;background:#f4f4f5"><p style="margin:0 0 8px;color:#71717a;font-size:12px">${isEnglish ? 'PREVIOUS TIME' : 'HORÁRIO ANTERIOR'}</p><p style="margin:0;text-decoration:line-through">${escapeHtml(previousDate)}</p><p style="margin:18px 0 8px;color:#047857;font-size:12px;font-weight:bold">${isEnglish ? 'NEW TIME' : 'NOVO HORÁRIO'}</p><p style="margin:0;font-size:18px;font-weight:bold">${escapeHtml(newDate)}</p></div><p>${isEnglish ? 'If this time does not work for you, contact the barbershop to arrange an alternative.' : 'Se este horário não te for conveniente, contacta a barbearia para combinar uma alternativa.'}</p><p style="margin-top:28px;color:#71717a;font-size:12px">${isEnglish ? 'Automatic message sent by Silentra for Barbers.' : 'Mensagem automática enviada pela Silentra for Barbers.'}</p><p style="margin-top:12px;color:#71717a;font-size:11px">${isEnglish ? 'Booking reference' : 'Referência da marcação'}: ${escapeHtml(input.appointmentId)}</p></main></body></html>`;

  return sendBrevoEmail({
    to: input.to,
    toName: customerName,
    senderName: shopName,
    subject: safeSubject(subject),
    htmlContent,
  });
}
