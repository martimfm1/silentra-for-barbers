import { getPublicAppUrl } from '@/lib/email/calendar-link';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type LoyaltyEmailError = { status: number | null };
export class LoyaltyEmailDeliveryError
  extends Error
  implements LoyaltyEmailError
{
  readonly status: number | null;

  constructor(
    status: number | null,
    message = 'Loyalty email delivery failed.',
  ) {
    super(message);
    this.name = 'LoyaltyEmailDeliveryError';
    this.status = status;
  }
}

async function sendBrevoEmail(input: {
  email: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  if (!apiKey || !senderEmail)
    throw new LoyaltyEmailDeliveryError(
      null,
      'Loyalty email configuration is missing.',
    );

  let response: Response;
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: 'Silentra', email: senderEmail },
        to: [{ email: input.email }],
        subject: input.subject,
        htmlContent: input.htmlContent,
        ...(input.textContent ? { textContent: input.textContent } : {}),
      }),
    });
  } catch {
    throw new LoyaltyEmailDeliveryError(null);
  }

  if (!response.ok) {
    let message = 'Loyalty email delivery failed.';
    try {
      const data = (await response.json()) as { message?: string };
      message = data.message || message;
    } catch {
      // Ignore invalid provider response bodies.
    }
    throw new LoyaltyEmailDeliveryError(response.status, message);
  }
}

export async function sendLoyaltyCodeEmail(
  email: string,
  code: string,
  barbershopName: string,
  language: 'pt' | 'en' = 'pt',
): Promise<void> {
  const isEnglish = language === 'en';
  const copy = isEnglish
    ? {
        program: 'Loyalty programme',
        title: 'Access code',
        description: `Use this code to join the loyalty programme at ${escapeHtml(barbershopName)}.`,
        expiry:
          'The code expires in 10 minutes and can only be used once. If you did not request it, ignore this email.',
        subject: `Loyalty access code — ${barbershopName}`,
        text: `Loyalty access code for ${barbershopName}: ${code}. The code expires in 10 minutes.`,
      }
    : {
        program: 'Programa de fidelização',
        title: 'Código de acesso',
        description: `Usa este código para entrar na fidelização da ${escapeHtml(barbershopName)}.`,
        expiry:
          'O código expira em 10 minutos e só pode ser utilizado uma vez. Se não pediste este código, ignora este email.',
        subject: `Código da fidelização — ${barbershopName}`,
        text: `Código de acesso à fidelização de ${barbershopName}: ${code}. O código expira em 10 minutos.`,
      };
  const safeCode = escapeHtml(code);
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;background:#09090b;color:#f4f4f5;padding:32px 16px;">
      <div style="max-width:480px;margin:0 auto;background:#141417;border:1px solid #27272a;border-radius:18px;padding:28px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#86efac;">${copy.program}</div>
        <h1 style="font-size:22px;margin:10px 0 8px;color:#fff;">${copy.title}</h1>
        <p style="color:#a1a1aa;line-height:1.5;margin:0 0 22px;">${copy.description}</p>
        <div style="text-align:center;background:#09090b;border:1px solid #3f3f46;border-radius:14px;padding:20px;">
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#fff;">${safeCode}</div>
        </div>
        <p style="font-size:12px;line-height:1.6;color:#71717a;margin:20px 0 0;">${copy.expiry}</p>
      </div>
    </div>`;

  await sendBrevoEmail({
    email,
    subject: copy.subject,
    htmlContent,
    textContent: copy.text,
  });
}

type LoyaltyRedemptionEmailInput = {
  email: string;
  customerName: string | null;
  barbershopName: string;
  rewardName: string;
  rewardDescription: string | null;
  pointsCost: number;
  remainingPoints: number;
  code: string;
  qrPayload: string;
  expiresAt: string;
  language?: 'pt' | 'en';
};

export async function sendLoyaltyRedemptionEmail(
  input: LoyaltyRedemptionEmailInput,
): Promise<void> {
  const isEnglish = input.language === 'en';
  const copy = isEnglish
    ? {
        greeting: 'Hello',
        title: 'Your voucher is ready',
        success: 'your redemption at',
        created: 'was created successfully.',
        reward: 'Reward',
        used: 'points used',
        remaining: 'points remaining',
        qrTitle: 'Voucher QR code',
        qrHelp:
          'Show this QR code at the barbershop. The code is also available below as an accessible alternative.',
        codeTitle: 'Redemption code',
        codeHelp: 'Show this code if the QR code cannot be scanned.',
        valid: 'Valid for 1 hour',
        expires: 'This voucher expires at',
        expired: 'After this time, it can no longer be used.',
        warning:
          'Do not share this QR code or code. The voucher is single-use and is validated directly by the team at',
        textQr: 'The QR code is available in the HTML version of this email.',
        subject: `Loyalty voucher — ${input.rewardName} — ${input.barbershopName}`,
      }
    : {
        greeting: 'Olá',
        title: 'O teu voucher está pronto',
        success: 'o teu resgate na',
        created: 'foi criado com sucesso.',
        reward: 'Recompensa',
        used: 'pontos utilizados',
        remaining: 'pontos restantes',
        qrTitle: 'QR Code do voucher',
        qrHelp:
          'Mostra este QR na barbearia. O código também está disponível abaixo como alternativa acessível.',
        codeTitle: 'Código de utilização',
        codeHelp: 'Podes mostrar este código caso o QR não possa ser lido.',
        valid: 'Válido durante 1 hora',
        expires: 'Este voucher expira em',
        expired: 'Depois dessa hora, deixa de poder ser utilizado.',
        warning:
          'Não partilhes este QR ou código. O voucher é de utilização única e é validado diretamente pela equipa da',
        textQr: 'O QR Code está disponível na versão HTML deste email.',
        subject: `Voucher de fidelização — ${input.rewardName} — ${input.barbershopName}`,
      };
  const appUrl = getPublicAppUrl();
  const qrImageUrl = `${appUrl}/api/loyalty/redemption/qr?token=${encodeURIComponent(input.qrPayload)}`;
  const safeName = escapeHtml(
    input.customerName?.trim() || (isEnglish ? 'there' : 'cliente'),
  );
  const safeShop = escapeHtml(input.barbershopName);
  const safeReward = escapeHtml(input.rewardName);
  const safeDescription = escapeHtml(input.rewardDescription || copy.reward);
  const safeCode = escapeHtml(input.code);
  const expiresAt = new Date(input.expiresAt);
  const expiryLabel = new Intl.DateTimeFormat(isEnglish ? 'en-GB' : 'pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  }).format(expiresAt);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${isEnglish ? 'en' : 'pt-PT'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${copy.title}</title>
      </head>
      <body style="margin:0;background:#09090b;color:#f4f4f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#141417;border:1px solid #27272a;border-radius:20px;overflow:hidden;">
          <div style="padding:28px 28px 20px;background:#17171a;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#86efac;">${isEnglish ? 'Loyalty' : 'Fidelização'} · ${safeShop}</div>
            <h1 style="font-size:24px;line-height:1.2;margin:10px 0 8px;color:#fff;">${copy.title}</h1>
            <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0;">${copy.greeting} ${safeName}, ${copy.success} <strong style="color:#fff;">${safeShop}</strong> ${copy.created}</p>
          </div>
          <div style="padding:24px 28px 28px;">
            <div style="border:1px solid #3f3f46;border-radius:16px;padding:18px;background:#0b0b0d;">
              <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">${copy.reward}</div>
              <div style="font-size:20px;font-weight:700;color:#fff;margin-top:6px;">${safeReward}</div>
              <div style="font-size:13px;line-height:1.5;color:#a1a1aa;margin-top:6px;">${safeDescription}</div>
              <div style="font-size:13px;color:#86efac;margin-top:12px;">${input.pointsCost} ${copy.used} · ${input.remainingPoints} ${copy.remaining}</div>
            </div>

            <div style="margin-top:24px;text-align:center;">
              <p style="font-size:13px;font-weight:700;color:#fff;margin:0 0 10px;">${copy.qrTitle}</p>
              <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0 0 14px;">${copy.qrHelp}</p>
              <div style="display:inline-block;background:#fff;border-radius:18px;padding:14px;">
                <img src="${qrImageUrl}" alt="${isEnglish ? 'QR code to redeem' : 'QR Code para validar'} ${safeReward} ${isEnglish ? 'at' : 'na'} ${safeShop}" width="260" height="260" style="display:block;width:260px;height:260px;max-width:100%;" />
              </div>
            </div>

            <div style="margin-top:22px;text-align:center;border:1px solid #27272a;background:#0b0b0d;border-radius:14px;padding:18px;">
              <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">${copy.codeTitle}</div>
              <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#fff;margin-top:8px;">${safeCode}</div>
              <p style="font-size:12px;line-height:1.5;color:#71717a;margin:10px 0 0;">${copy.codeHelp}</p>
            </div>

            <div style="margin-top:20px;border:1px solid #7f1d1d;background:#2a0f12;border-radius:12px;padding:14px;">
              <div style="font-size:13px;font-weight:700;color:#fecaca;">${copy.valid}</div>
              <div style="font-size:12px;line-height:1.5;color:#fca5a5;margin-top:4px;">${copy.expires} ${escapeHtml(expiryLabel)}. ${copy.expired}</div>
            </div>

            <p style="font-size:12px;line-height:1.6;color:#71717a;margin:22px 0 0;">${copy.warning} ${safeShop}.</p>
          </div>
        </div>
      </body>
    </html>`;

  const textContent = [
    `${copy.title} — ${input.barbershopName}`,
    `${copy.greeting} ${input.customerName?.trim() || ''}, ${input.rewardName} ${copy.created}`,
    `${input.pointsCost} ${copy.used}. ${input.remainingPoints} ${copy.remaining}.`,
    `${copy.codeTitle}: ${input.code}.`,
    `${copy.expires}: ${expiryLabel}.`,
    copy.textQr,
  ].join('\n\n');

  await sendBrevoEmail({
    email: input.email,
    subject: copy.subject,
    htmlContent,
    textContent,
  });
}
