import { sendBrevoEmail } from '@/lib/email/brevo';

export type AppointmentCancellationEmailPayload = {
  to: string;
  clientName: string;
  serviceName: string;
  professionalName?: string | null;
  dateHour: string;
  appointmentId: string;
  barbershopName: string;
  language?: 'pt' | 'en';
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendAppointmentCancellationEmail(
  payload: AppointmentCancellationEmailPayload,
) {
  const isEnglish = payload.language === 'en';
  const locale = isEnglish ? 'en-GB' : 'pt-PT';
  const safeClientName = escapeHtml(payload.clientName || (isEnglish ? 'Customer' : 'Cliente'));
  const subjectShopName = payload.barbershopName.replace(/[\\r\\n]/g, ' ').slice(0, 100);
  const safeShopName = escapeHtml(payload.barbershopName || (isEnglish ? 'Your barbershop' : 'A tua barbearia'));
  const safeServiceName = escapeHtml(payload.serviceName || (isEnglish ? 'Service' : 'Serviço'));
  const safeProfessionalName = payload.professionalName
    ? escapeHtml(payload.professionalName)
    : null;
  const date = new Date(payload.dateHour);
  const formattedDate = Number.isNaN(date.getTime())
    ? escapeHtml(payload.dateHour)
    : escapeHtml(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'Europe/Lisbon',
        }).format(date),
      );

  const copy = isEnglish
    ? {
        subject: 'Your appointment was cancelled — ' + subjectShopName,
        title: 'Your appointment was cancelled by the barbershop',
        greeting: 'Hello <strong style="color:#fff;">' + safeClientName + '</strong>,',
        message:
          'The barbershop has cancelled your appointment. This booking will no longer take place at the date and time shown below. We apologise for the inconvenience.',
        service: 'Service',
        professional: 'Barber',
        date: 'Date and time',
        footer:
          'This email confirms that the barbershop cancelled your appointment. Please contact the barbershop directly if you need any further information.',
        reference: 'Booking reference',
      }
    : {
        subject: 'A tua marcação foi cancelada — ' + subjectShopName,
        title: 'A tua marcação foi cancelada pela barbearia',
        greeting: 'Olá <strong style="color:#fff;">' + safeClientName + '</strong>,',
        message:
          'A barbearia cancelou a tua marcação. Este atendimento já não se vai realizar na data e hora indicadas abaixo. Pedimos desculpa pelo incómodo.',
        service: 'Serviço',
        professional: 'Barbeiro',
        date: 'Data e hora',
        footer:
          'Este email confirma que a barbearia cancelou a tua marcação. Contacta diretamente a barbearia caso precises de mais informações.',
        reference: 'Referência da marcação',
      };

  const rows = [
    '<tr><td style="padding:11px 0;border-bottom:1px solid #27272a;color:#a1a1aa;">' +
      copy.service +
      '</td><td style="padding:11px 0;border-bottom:1px solid #27272a;color:#fff;text-align:right;font-weight:600;">' +
      safeServiceName +
      '</td></tr>',
    ...(safeProfessionalName
      ? [
          '<tr><td style="padding:11px 0;border-bottom:1px solid #27272a;color:#a1a1aa;">' +
            copy.professional +
            '</td><td style="padding:11px 0;border-bottom:1px solid #27272a;color:#fff;text-align:right;">' +
            safeProfessionalName +
            '</td></tr>',
        ]
      : []),
    '<tr><td style="padding:11px 0;color:#a1a1aa;">' +
      copy.date +
      '</td><td style="padding:11px 0;color:#fff;text-align:right;">' +
      formattedDate +
      '</td></tr>',
  ].join('');

  const htmlContent = [
    '<!doctype html>',
    '<html lang="' + (isEnglish ? 'en' : 'pt-PT') + '">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + copy.title + '</title></head>',
    '<body style="margin:0;padding:28px 14px;background:#0c0c0e;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
    '<main style="max-width:540px;margin:0 auto;padding:30px;background:#141417;border:1px solid #27272a;border-radius:16px;">',
    '<p style="margin:0 0 8px;color:#a1a1aa;font-size:12px;">' + safeShopName + '</p>',
    '<h1 style="margin:0 0 14px;color:#fff;font-size:23px;line-height:1.3;">' + copy.title + '</h1>',
    '<p style="margin:0 0 12px;color:#e4e4e7;font-size:14px;line-height:1.7;">' + copy.greeting + '</p>',
    '<p style="margin:0 0 22px;color:#a1a1aa;font-size:14px;line-height:1.7;">' + copy.message + '</p>',
    '<table role="presentation" style="width:100%;border-collapse:collapse;">' + rows + '</table>',
    '<p style="margin:22px 0 0;color:#71717a;font-size:11px;">' + copy.reference + ': ' + escapeHtml(payload.appointmentId) + '</p>',
    '<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #27272a;color:#71717a;font-size:12px;line-height:1.6;">' + copy.footer + '</p>',
    '</main></body></html>',
  ].join('\n');

  return sendBrevoEmail({
    to: payload.to,
    toName: payload.clientName,
    senderName: payload.barbershopName,
    subject: copy.subject,
    htmlContent,
  });
}
