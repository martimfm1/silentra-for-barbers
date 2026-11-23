function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char] ?? char,
  );
}

export function renderMarketingEmail(input: {
  body: string;
  shopName: string;
  bookingUrl: string;
  unsubscribeUrl: string;
  kind?: 'birthday' | 'campaign';
}) {
  const shopName = escapeHtml(input.shopName);
  const body = input.body
    .split(/\n\s*\n/)
    .map(
      (paragraph) =>
        '<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.75;">' +
        escapeHtml(paragraph).replaceAll('\n', '<br>') +
        '</p>',
    )
    .join('');
  const birthday = input.kind === 'birthday';
  const preheader = birthday
    ? 'Uma mensagem especial da tua barbearia.'
    : 'Uma mensagem de ' + input.shopName + '.';
  const heroLabel = birthday ? 'UM DIA ESPECIAL' : 'NOVIDADES DA BARBEARIA';
  const heroTitle = birthday ? 'Feliz aniversário! 🎂' : 'Uma mensagem para ti.';
  const ctaLabel = birthday ? 'Marcar a próxima visita' : 'Ver horários disponíveis';

  return '<!doctype html>' +
    '<html lang="pt-PT"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>' + heroTitle + '</title></head>' +
    '<body style="margin:0;padding:0;background:#f4f2ed;font-family:Arial,Helvetica,sans-serif;color:#18181b;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + escapeHtml(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f2ed;"><tr><td align="center" style="padding:36px 16px;">' +
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">' +
    '<tr><td style="padding:0 8px 14px;text-align:left;color:#71717a;font-size:12px;letter-spacing:2px;text-transform:uppercase;">' + shopName + '</td></tr>' +
    '<tr><td style="overflow:hidden;border:1px solid #e7e3db;border-radius:22px;background:#ffffff;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    '<tr><td style="padding:34px 30px;background:#18181b;color:#ffffff;">' +
    '<div style="font-size:11px;letter-spacing:2.5px;color:#d6bd8a;font-weight:700;">' + heroLabel + '</div>' +
    '<div style="margin-top:14px;font-size:30px;line-height:1.2;font-weight:700;">' + heroTitle + '</div>' +
    '<div style="margin-top:12px;font-size:14px;line-height:1.6;color:#d4d4d8;">' +
    (birthday
      ? 'A equipa preparou uma pequena mensagem para assinalar a ocasião.'
      : 'Recebeste esta mensagem porque autorizaste novidades por email.') +
    '</div></td></tr>' +
    '<tr><td style="padding:32px 30px 12px;">' + body +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px;"><tr><td bgcolor="#18181b" style="border-radius:999px;">' +
    '<a href="' + escapeHtml(input.bookingUrl) + '" style="display:inline-block;padding:15px 23px;border-radius:999px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">' + ctaLabel + '</a>' +
    '</td></tr></table>' +
    '<p style="margin:0 0 22px;color:#71717a;font-size:12px;line-height:1.6;">Até breve,<br><strong style="color:#27272a;">' + shopName + '</strong></p>' +
    '</td></tr></table></td></tr>' +
    '<tr><td style="padding:20px 12px;text-align:center;color:#a1a1aa;font-size:11px;line-height:1.7;">' +
    'Enviado por ' + shopName + ' através da Silentra.<br>' +
    'Recebeste esta mensagem porque aceitaste receber comunicações desta barbearia.<br>' +
    '<a href="' + escapeHtml(input.unsubscribeUrl) + '" style="color:#71717a;text-decoration:underline;">Cancelar subscrição</a>' +
    '</td></tr></table></td></tr></table></body></html>';
}
