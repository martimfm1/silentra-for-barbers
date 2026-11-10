export interface BookingReviewRequestEmailPayload {
  to: string;
  clientName: string;
  serviceName: string;
  barbershopName: string;
  reviewUrl: string;
  language?: 'pt' | 'en';
}

export type ReviewEmailResponse =
  { success: true; messageId?: string } | { success: false; error: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendBookingReviewRequestEmail(
  payload: BookingReviewRequestEmailPayload,
): Promise<ReviewEmailResponse> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL ?? process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !senderEmail) {
    console.error(
      '[BREVO_REVIEW_ERROR] Variáveis BREVO_API_KEY ou SENDER_EMAIL ausentes.',
    );
    return {
      success: false,
      error: 'Configuração do servidor de e-mail incompleta.',
    };
  }

  const safeClientName = escapeHtml(payload.clientName);
  const safeServiceName = escapeHtml(payload.serviceName);
  const safeBarbershopName = escapeHtml(payload.barbershopName);
  const safeReviewUrl = escapeHtml(payload.reviewUrl);
  const isEnglish = payload.language === 'en';
  const copy = isEnglish
    ? {
        subject: `Your opinion matters — ${payload.barbershopName}`,
        eyebrow: 'A MOMENT FOR YOUR FEEDBACK',
        title: 'How was your experience?',
        greeting: `Hi <strong style="color:#18181b;">${safeClientName}</strong>, thanks for visiting us. We hope you enjoyed your appointment.`,
        prompt: 'Would you take a moment to tell us how it went?',
        serviceLabel: 'YOUR SERVICE',
        button: 'Rate my experience',
        reassurance: 'It only takes a minute',
        footer:
          'Your review is completely optional and will only be shared publicly after you submit it.',
        signature: 'Thank you for choosing us.',
        textTitle: 'How was your experience?',
      }
    : {
        subject: `A tua opinião é importante — ${payload.barbershopName}`,
        eyebrow: 'UM MOMENTO PARA A TUA OPINIÃO',
        title: 'Como foi a tua experiência?',
        greeting: `Olá <strong style="color:#18181b;">${safeClientName}</strong>, obrigado por teres escolhido os nossos serviços. Esperamos que tenhas gostado do atendimento.`,
        prompt: 'Tens um minuto para nos dizer como correu?',
        serviceLabel: 'O TEU SERVIÇO',
        button: 'Avaliar a minha experiência',
        reassurance: 'Demora apenas um minuto',
        footer:
          'A avaliação é totalmente opcional e só será partilhada publicamente depois de a submeteres.',
        signature: 'Obrigado pela tua preferência.',
        textTitle: 'Como foi a tua experiência?',
      };

  const htmlContent = `<!doctype html>
<html lang="${isEnglish ? 'en' : 'pt-PT'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${copy.title}</title></head>
<body style="margin:0;padding:32px 14px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;">
    <tr><td style="padding:30px 32px 26px;background:#18181b;">
      <p style="margin:0;color:#a1a1aa;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${safeBarbershopName}</p>
      <div style="width:38px;height:3px;margin:20px 0 18px;background:#ffffff;border-radius:3px;"></div>
      <p style="margin:0;color:#d4d4d8;font-size:10px;font-weight:700;letter-spacing:1.5px;">${copy.eyebrow}</p>
      <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;line-height:1.2;letter-spacing:-.6px;">${copy.title}</h1>
    </td></tr>
    <tr><td style="padding:30px 32px 12px;">
      <p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.75;">${copy.greeting}</p>
      <p style="margin:12px 0 22px;color:#52525b;font-size:14px;line-height:1.7;">${copy.prompt}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;"><tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;color:#71717a;font-size:10px;font-weight:700;letter-spacing:1.2px;">${copy.serviceLabel}</p>
        <p style="margin:0;color:#18181b;font-size:15px;font-weight:700;line-height:1.5;">${safeServiceName}</p>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;"><tr><td align="center" style="border-radius:11px;background:#18181b;">
        <a href="${safeReviewUrl}" target="_blank" rel="noopener noreferrer" style="display:block;padding:16px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;text-align:center;">${copy.button} &nbsp;→</a>
      </td></tr></table>
      <p style="margin:12px 0 0;color:#71717a;font-size:12px;text-align:center;">${copy.reassurance}</p>
    </td></tr>
    <tr><td style="padding:22px 32px 28px;"><div style="height:1px;background:#e4e4e7;"></div>
      <p style="margin:20px 0 8px;color:#52525b;font-size:13px;line-height:1.6;">${copy.signature}</p>
      <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.6;">${copy.footer}</p>
    </td></tr>
  </table>
</body></html>`;
  const textContent = `${copy.textTitle}\n\n${payload.clientName},\n\n${isEnglish ? 'Service' : 'Serviço'}: ${payload.serviceName}\n\n${copy.prompt}\n${payload.reviewUrl}\n\n${copy.footer}\n\n${payload.barbershopName}`;

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
        textContent,
      }),
    });
    const data = (await response.json()) as {
      messageId?: string;
      message?: string;
    };
    if (!response.ok) {
      console.error('[BREVO_REVIEW_API_ERROR]', data);
      return {
        success: false,
        error: data.message || 'Falha ao enviar o pedido de avaliação.',
      };
    }
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error('[BREVO_REVIEW_FETCH_ERROR]', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao comunicar com a API do Brevo.',
    };
  }
}
