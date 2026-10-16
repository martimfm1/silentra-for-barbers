import {
  createCalendarToken,
  getPublicAppUrl,
} from '@/lib/email/calendar-link';

export interface BookingEmailPayload {
  to: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  durationMinutes?: number;
  appointmentId: string;
  barbershopId?: string;
  barbershopName: string;
  barbershopAddress: string;
  language?: 'pt' | 'en';
}

export type SendEmailResponse =
  { success: true; messageId?: string } | { success: false; error: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBarbershopAvatarUrl(barbershopId?: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!supabaseUrl || !barbershopId) return null;
  return `${supabaseUrl}/storage/v1/object/public/avatar/${encodeURIComponent(barbershopId)}/avatar.webp`;
}

function buildCalendarLinks(
  payload: BookingEmailPayload,
  title: string,
  description: string,
  location: string,
) {
  const calendarToken = createCalendarToken(payload.appointmentId);
  const appUrl = getPublicAppUrl();
  const appleCalUrl = `${appUrl}/api/calendar/appointments/${encodeURIComponent(payload.appointmentId)}?token=${encodeURIComponent(calendarToken)}`;
  const start = new Date(`${payload.date}T${payload.time}:00`);
  const end = new Date(
    start.getTime() + Math.max(1, payload.durationMinutes ?? 45) * 60_000,
  );
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(start);
  const get = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '00';
  const startDate = `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}00`;
  const endParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(end);
  const endGet = (type: string) =>
    endParts.find((item) => item.type === type)?.value ?? '00';
  const endDate = `${endGet('year')}${endGet('month')}${endGet('day')}T${endGet('hour')}${endGet('minute')}00`;

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${encodeURIComponent(startDate + '/' + endDate)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
  return { google, apple: appleCalUrl };
}

export async function sendBookingConfirmationEmail(
  payload: BookingEmailPayload,
): Promise<SendEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.error(
      '[BREVO_ERROR] Variáveis BREVO_API_KEY ou SENDER_EMAIL ausentes.',
    );
    return {
      success: false,
      error: 'Configuração do servidor de e-mail incompleta.',
    };
  }

  const safeClientName = escapeHtml(payload.clientName);
  const safeServiceName = escapeHtml(payload.serviceName);
  const safeBarbershopName = escapeHtml(payload.barbershopName);
  const safeBarbershopAddress = escapeHtml(payload.barbershopAddress);
  const isEnglish = payload.language === 'en';
  const copy = isEnglish
    ? {
        subject: `Booking confirmed — ${payload.barbershopName}`,
        title: 'Booking confirmed',
        greeting: `Hello <strong style="color:#fff;">${safeClientName}</strong>, your booking has been confirmed.`,
        service: 'Service', date: 'Date', time: 'Time', location: 'Location',
        addCalendar: 'Add to calendar', openLocation: 'Open location',
        footer: 'Keep this email as confirmation of your booking.',
        description: `Booking for ${payload.serviceName} for ${payload.clientName}.`,
        textTitle: 'Booking confirmed', textAt: 'at',
      }
    : {
        subject: `Agendamento confirmado — ${payload.barbershopName}`,
        title: 'Agendamento confirmado',
        greeting: `Olá <strong style="color:#fff;">${safeClientName}</strong>, a tua marcação ficou confirmada.`,
        service: 'Serviço', date: 'Data', time: 'Hora', location: 'Local',
        addCalendar: 'Adicionar ao calendário', openLocation: 'Abrir localização',
        footer: 'Guarda este email como confirmação da tua marcação.',
        description: `Agendamento de ${payload.serviceName} para ${payload.clientName}.`,
        textTitle: 'Agendamento confirmado', textAt: 'às',
      };
  const formattedDate = new Intl.DateTimeFormat(isEnglish ? 'en-GB' : 'pt-PT', { dateStyle: 'long', timeZone: 'Europe/Lisbon' }).format(new Date(`${payload.date}T12:00:00`));
  const avatarUrl = getBarbershopAvatarUrl(payload.barbershopId);
  const title = `${payload.serviceName} — ${payload.barbershopName}`;
  const description = copy.description;
  const location = [payload.barbershopName, payload.barbershopAddress]
    .filter(Boolean)
    .join(', ');
  const { google, apple } = buildCalendarLinks(
    payload,
    title,
    description,
    location,
  );
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  const appleMaps = `https://maps.apple.com/?address=${encodeURIComponent(payload.barbershopAddress || payload.barbershopName)}`;

  const avatarMarkup = avatarUrl
    ? `<img src="${avatarUrl}" alt="${isEnglish ? `Logo of ${safeBarbershopName}` : `Logótipo da ${safeBarbershopName}`}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:16px;object-fit:cover;border:1px solid #27272a;" />`
    : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="${isEnglish ? 'en' : 'pt-PT'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title}</title></head>
<body style="margin:0;background:#0c0c0e;color:#f4f4f5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:540px;margin:0 auto;background:#141417;border:1px solid #27272a;border-radius:16px;padding:28px;">
${avatarMarkup}
<p style="font-size:12px;color:#a1a1aa;margin:16px 0 0;">${safeBarbershopName}</p>
<h1 style="font-size:24px;color:#fff;margin:8px 0;">${copy.title}</h1>
<p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 20px;">${copy.greeting}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#a1a1aa;">${copy.service}</td><td style="padding:8px 0;color:#fff;text-align:right;font-weight:600;">${safeServiceName}</td></tr><tr><td style="padding:8px 0;color:#a1a1aa;">${copy.date}</td><td style="padding:8px 0;color:#fff;text-align:right;">${escapeHtml(formattedDate)}</td></tr><tr><td style="padding:8px 0;color:#a1a1aa;">${copy.time}</td><td style="padding:8px 0;color:#fff;text-align:right;">${escapeHtml(payload.time)}</td></tr><tr><td style="padding:8px 0;color:#a1a1aa;">${copy.location}</td><td style="padding:8px 0;color:#fff;text-align:right;">${safeBarbershopAddress}</td></tr></table>
<div style="height:1px;background:#27272a;margin:20px 0;"></div>
<p style="font-size:13px;font-weight:700;color:#fff;margin:0 0 10px;">${copy.addCalendar}</p>
<a href="${google}" style="display:block;background:#fff;color:#09090b;text-decoration:none;text-align:center;border-radius:10px;padding:13px 16px;font-size:13px;font-weight:700;margin-bottom:10px;">Google Calendar</a>
<a href="${apple}" style="display:block;background:#1c1c20;color:#fff;text-decoration:none;text-align:center;border:1px solid #3f3f46;border-radius:10px;padding:13px 16px;font-size:13px;font-weight:700;margin-bottom:18px;">Apple Calendar (.ics)</a>
<p style="font-size:13px;font-weight:700;color:#fff;margin:0 0 10px;">${copy.openLocation}</p>
<a href="${googleMaps}" style="display:block;background:#1c1c20;color:#fff;text-decoration:none;text-align:center;border:1px solid #3f3f46;border-radius:10px;padding:12px 16px;font-size:13px;margin-bottom:8px;">Google Maps</a>
<a href="${appleMaps}" style="display:block;background:#1c1c20;color:#fff;text-decoration:none;text-align:center;border:1px solid #3f3f46;border-radius:10px;padding:12px 16px;font-size:13px;">Apple Maps</a>
<p style="font-size:12px;line-height:1.6;color:#71717a;margin:20px 0 0;">${copy.footer}</p>
</div></body></html>`;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: payload.barbershopName, email: senderEmail },
        to: [{ email: payload.to, name: payload.clientName }],
        subject: copy.subject,
        htmlContent,
        textContent: `${copy.textTitle}\n${payload.serviceName}\n${formattedDate} ${copy.textAt} ${payload.time}\n${payload.barbershopName}\n${payload.barbershopAddress}\n\nGoogle Calendar: ${google}\nApple Calendar: ${apple}\nGoogle Maps: ${googleMaps}\nApple Maps: ${appleMaps}`,
      }),
    });
    const data = (await response.json()) as {
      messageId?: string;
      message?: string;
    };
    if (!response.ok) {
      console.error('[BREVO_API_ERROR]', data);
      return {
        success: false,
        error: data.message || 'Falha ao enviar o email.',
      };
    }
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[BREVO_FETCH_ERROR]', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao comunicar com o Brevo.',
    };
  }
}
