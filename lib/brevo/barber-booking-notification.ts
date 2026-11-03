import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { sendWebPushToUsers } from '@/lib/notifications/providers/push';

type BookingNotification = {
  appointmentId: string;
  barbershopId: string;
  professionalId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: 'confirmed' | 'pending';
  prepaymentReview?: { amount: number; expiresAt: string; method: 'mbway' };
};
type BookingNotificationOptions = { sendEmail?: boolean };
type BookingRecipient = { userId: string; email: string | null; name: string };

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

function formatBookingDate(value: string, language: 'pt' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'pt-PT', {
    dateStyle: 'long',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(`${value}T12:00:00`));
}

export async function notifyBarbersOfNewBooking(
  input: BookingNotification,
  options: BookingNotificationOptions = {},
): Promise<void> {
  const admin = createAdminClient();
  const { data: shop, error: shopError } = await admin
    .from('barbershops')
    .select('name,address,default_language')
    .eq('id', input.barbershopId)
    .maybeSingle();
  if (shopError || !shop) {
    console.error(
      '[BARBER_BOOKING_NOTIFICATION_SHOP_LOOKUP_FAILED]',
      shopError?.code ?? 'UNKNOWN',
    );
    return;
  }

  const language: 'pt' | 'en' = String(shop.default_language ?? '')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'pt';
  let recipients: BookingRecipient[] = [];

  if (input.professionalId) {
    const { data: professional, error } = await admin
      .from('professionals')
      .select('user_id,name')
      .eq('id', input.professionalId)
      .eq('barbershop_id', input.barbershopId)
      .eq('active', true)
      .maybeSingle();
    if (error) {
      console.error('[BARBER_BOOKING_NOTIFICATION_PROFESSIONAL_LOOKUP_FAILED]', error.code ?? 'UNKNOWN');
    }
    if (professional?.user_id) {
      const { data: user, error: userError } = await admin
        .from('users')
        .select('id,email,name_complete,role')
        .eq('id', professional.user_id)
        .eq('barbershop_id', input.barbershopId)
        .eq('role', 'barber')
        .maybeSingle();
      if (userError) {
        console.error('[BARBER_BOOKING_NOTIFICATION_USER_LOOKUP_FAILED]', userError.code ?? 'UNKNOWN');
      }
      if (user?.id) {
        recipients = [{
          userId: user.id,
          email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : null,
          name: user.name_complete?.trim() || professional.name?.trim() || 'Barbeiro',
        }];
      }
    }
  }

  if (recipients.length === 0) {
    const { data: barbers, error } = await admin
      .from('users')
      .select('id,email,name_complete')
      .eq('barbershop_id', input.barbershopId)
      .in('role', ['barber', 'owner', 'admin']);
    if (error) {
      console.error('[BARBER_BOOKING_NOTIFICATION_RECIPIENT_LOOKUP_FAILED]', error.code ?? 'UNKNOWN');
      return;
    }
    recipients = (barbers ?? []).map((barber) => ({
      userId: barber.id,
      email: typeof barber.email === 'string' ? barber.email.trim().toLowerCase() : null,
      name: barber.name_complete?.trim() || 'Barbeiro',
    }));
  }

  const uniqueRecipients = [
    ...new Map(recipients.map((recipient) => [recipient.userId, recipient])).values(),
  ];
  if (!uniqueRecipients.length) {
    console.warn('[BARBER_BOOKING_NOTIFICATION_NO_RECIPIENT]');
    return;
  }

  const isEnglish = language === 'en';
  const date = formatBookingDate(input.date, language);
  const statusLabel = input.prepaymentReview
    ? isEnglish
      ? 'MB WAY payment awaiting review'
      : 'Pré-pagamento MB WAY por validar'
    : input.status === 'confirmed'
      ? isEnglish
        ? 'Confirmed'
        : 'Confirmada'
      : isEnglish
        ? 'Awaiting approval'
        : 'A aguardar confirmação';
  const subject = input.prepaymentReview
    ? isEnglish
      ? `MB WAY prepayment to review — ${input.customerName} — ${date}`
      : `Pré-pagamento MB WAY para analisar — ${input.customerName} — ${date}`
    : isEnglish
      ? `New booking — ${input.customerName} — ${date} at ${input.time}`
      : `Nova marcação — ${input.customerName} — ${date} às ${input.time}`;
  const rows: Array<[string, string]> = [
    [isEnglish ? 'Customer' : 'Cliente', input.customerName],
    [isEnglish ? 'Phone' : 'Telefone', input.customerPhone],
    [isEnglish ? 'Email' : 'Email', input.customerEmail],
    [isEnglish ? 'Service' : 'Serviço', input.serviceName],
    [isEnglish ? 'Date' : 'Data', date],
    [isEnglish ? 'Time' : 'Hora', input.time],
    [isEnglish ? 'Duration' : 'Duração', `${input.durationMinutes} min`],
    [isEnglish ? 'Status' : 'Estado', statusLabel],
    ...(input.prepaymentReview
      ? [
          [isEnglish ? 'Payment' : 'Pagamento', 'MB WAY'] as [string, string],
          [isEnglish ? 'Amount to verify' : 'Valor a validar', `${input.prepaymentReview.amount.toFixed(2)} €`] as [string, string],
          [isEnglish ? 'Review before' : 'Validar até', new Date(input.prepaymentReview.expiresAt).toLocaleTimeString(isEnglish ? 'en-GB' : 'pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' })] as [string, string],
        ]
      : []),
  ];
  const htmlContent = `<!doctype html><html lang="${isEnglish ? 'en' : 'pt-PT'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e4e4e7;border-radius:16px"><p style="margin:0 0 8px;color:#71717a;font-size:13px">${escapeHtml(shop.name)}</p><h1 style="margin:0 0 12px;font-size:24px">${isEnglish ? 'You have a new booking' : 'Tens uma nova marcação'}</h1><p style="margin:0 0 20px;line-height:1.6">${input.prepaymentReview ? (isEnglish ? 'A new booking with MB WAY prepayment is waiting for you to verify the transfer and confirm the appointment.' : 'Tens uma nova marcação com pré-pagamento MB WAY. Verifica a transferência e confirma a marcação na dashboard.') : (isEnglish ? 'A new appointment has been booked at your barbershop.' : 'Foi feita uma nova marcação na tua barbearia.')}</p><table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;color:#71717a;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:600;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table><p style="margin:20px 0 0;color:#71717a;font-size:12px">${isEnglish ? 'Booking reference' : 'Referência da marcação'}: ${escapeHtml(input.appointmentId)}</p></main></body></html>`;

  if (options.sendEmail !== false) {
    const emailRecipients = [
      ...new Map(
        uniqueRecipients
          .filter(
            (recipient): recipient is BookingRecipient & { email: string } =>
              Boolean(recipient.email),
          )
          .map((recipient) => [recipient.email, recipient]),
      ).values(),
    ];
    const results = await Promise.all(emailRecipients.map(async (recipient) => {
      const result = await sendBrevoEmail({
        to: recipient.email,
        toName: recipient.name,
        senderName: shop.name || 'Silentra for Barbers',
        subject,
        htmlContent,
      });
      if (!result.success) console.error('[BARBER_BOOKING_NOTIFICATION_SEND_FAILED]', { reason: result.error });
      return result.success;
    }));
    if (results.some((success) => !success)) {
      console.error('[BARBER_BOOKING_NOTIFICATION_PARTIAL_FAILURE]', {
        attempted: results.length,
        failed: results.filter((success) => !success).length,
      });
    }
  }

  try {
    await sendWebPushToUsers(uniqueRecipients.map((recipient) => recipient.userId), {
      title: input.prepaymentReview
        ? (isEnglish ? 'MB WAY payment to review' : 'Pré-pagamento MB WAY por validar')
        : (isEnglish ? 'New booking' : 'Nova marcação'),
      body: [input.serviceName, `${date} · ${input.time}`].filter(Boolean).join(' · '),
      url: '/dashboard/agenda',
      tag: `booking-${input.appointmentId}`,
    });
  } catch (pushError) {
    console.error('[BARBER_BOOKING_PUSH_NOTIFICATION_ERROR]',
      pushError instanceof Error ? pushError.name : 'UNKNOWN');
  }
}
