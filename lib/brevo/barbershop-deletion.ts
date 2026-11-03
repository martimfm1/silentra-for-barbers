import { sendBrevoEmail } from '@/lib/email/brevo';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendBarbershopDeletionCodeEmail(input: {
  email: string;
  code: string;
  barbershopName: string;
  language: 'pt' | 'en';
}) {
  const english = input.language === 'en';
  const shop = escapeHtml(input.barbershopName);
  const code = escapeHtml(input.code);
  const subject = english
    ? 'Confirm barbershop deletion — Silentra'
    : 'Confirmação da eliminação da barbearia — Silentra';
  const description = english
    ? `Use this code to permanently delete ${shop} and its associated business data. If you did not request this, ignore this email.`
    : `Utiliza este código para apagar permanentemente a ${shop} e os respetivos dados. Se não pediste esta operação, ignora este email.`;
  const expiry = english
    ? 'This code expires in 10 minutes and can only be used once.'
    : 'O código expira em 10 minutos e só pode ser utilizado uma vez.';
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;background:#09090b;color:#f4f4f5;padding:32px 16px">
      <div style="max-width:480px;margin:0 auto;background:#141417;border:1px solid #3f3f46;border-radius:18px;padding:28px">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f87171">SILENTRA · SECURITY</div>
        <h1 style="font-size:22px;margin:12px 0;color:#fff">${english ? 'Delete barbershop' : 'Apagar barbearia'}</h1>
        <p style="color:#a1a1aa;line-height:1.6">${description}</p>
        <div style="text-align:center;background:#09090b;border:1px solid #52525b;border-radius:14px;padding:20px;margin:24px 0">
          <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#fff">${code}</span>
        </div>
        <p style="font-size:12px;color:#a1a1aa;line-height:1.6">${expiry}</p>
      </div>
    </div>`;
  const result = await sendBrevoEmail({
    to: input.email,
    subject,
    htmlContent,
    contactPixelTrackingConsent: false,
  });
  if (!result.success) throw new Error('DELETION_EMAIL_DELIVERY_FAILED');
}
