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
  const senderEmail = process.env.SENDER_EMAIL;

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
        subject: `How was your experience at ${payload.barbershopName}?`,
        title: 'How was your visit?',
        greeting: `Hi <strong style="color:#fff">${safeClientName}</strong>, thank you for choosing our barbershop. We would love to hear about your experience.`,
        button: 'Leave a review', service: 'Service:',
        meta: 'It takes less than a minute and helps us improve.',
        footer: 'Your feedback is optional and will only appear on the public barbershop page after you submit it.',
      }
    : {
        subject: copy.subject,
        title: 'Como correu o teu atendimento?',
        greeting: `Olá <strong style="color:#fff">${safeClientName}</strong>, obrigado por escolheres a nossa barbearia. Gostávamos de saber como correu a tua experiência.`,
        button: 'Deixar uma avaliação', service: 'Serviço:',
        meta: 'Leva menos de um minuto e ajuda-nos a melhorar.',
        footer: 'A tua opinião é opcional e será publicada na página pública da barbearia apenas depois de a submeteres.',
      };

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${isEnglish ? 'en' : 'pt-PT'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${copy.title}</title>
        <style>
          body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0c0c0e;color:#f4f4f5;margin:0;padding:24px 12px; }
          .card { max-width:520px;margin:0 auto;background:#141417;border:1px solid #27272a;border-radius:18px;padding:32px 24px; }
          .eyebrow { font-size:12px;color:#a1a1aa;margin-bottom:8px; }
          .title { font-size:24px;line-height:1.2;font-weight:750;color:#fff;margin:0 0 12px; }
          .copy { font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 22px; }
          .button { display:block;text-align:center;text-decoration:none;background:#fff;color:#09090b !important;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:700; }
          .meta { margin-top:20px;padding:14px 16px;border:1px solid #27272a;border-radius:12px;background:#101012;color:#d4d4d8;font-size:13px;line-height:1.5; }
          .footer { margin-top:24px;text-align:center;color:#66666e;font-size:12px;line-height:1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="eyebrow">${safeBarbershopName}</div>
          <h1 class="title">${copy.title}</h1>
          <p class="copy">${copy.greeting}</p>
          <a class="button" href="${safeReviewUrl}" target="_blank" rel="noopener noreferrer">${copy.button}</a>
          <div class="meta"><strong style="color:#fff">${copy.service}</strong> ${safeServiceName}<br>${copy.meta}</div>
          <div class="footer">${copy.footer}</div>
        </div>
      </body>
    </html>
  `;

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
        subject: `Como correu a tua experiência em ${payload.barbershopName}?`,
        htmlContent,
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
