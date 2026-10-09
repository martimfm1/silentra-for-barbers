import type { BillingPlan } from '@/lib/stripe/constants';

export type BillingEmailContext = {
  customerName?: string | null;
  customerEmail?: string | null;
  barbershopName?: string | null;
  plan: Exclude<BillingPlan, 'free'>;
  billingInterval: 'month' | 'year';
  price: number;
  currency?: string;
  requestId?: string | null;
  createdAt?: string | null;
  paymentLink?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  issuedAt?: string | null;
  documentNumber?: string | null;
  reason?: string | null;
  adminUrl?: string | null;
  dashboardUrl?: string | null;
};

function escapeHtml(value: string) {
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

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function planLabel(plan: Exclude<BillingPlan, 'free'>) {
  return plan === 'enterprise' ? 'Barbers Enterprise' : 'Barbers Pro';
}

function intervalLabel(interval: 'month' | 'year') {
  return interval === 'year' ? 'Anual' : 'Mensal';
}

function money(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function reference(requestId: string | null | undefined) {
  return requestId
    ? requestId.replace(/-/g, '').slice(0, 8).toUpperCase()
    : '—';
}

function getBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://barbers.silentra.me';

  try {
    const parsed = new URL(
      configured.startsWith('http://') || configured.startsWith('https://')
        ? configured
        : `https://${configured}`,
    );
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'https://barbers.silentra.me';
  }
}

function shell(input: {
  preheader: string;
  title: string;
  eyebrow: string;
  intro: string;
  content: string;
  cta?: { label: string; href: string };
  footer?: string;
}) {
  const ctaHref = input.cta ? safeUrl(input.cta.href) : null;

  return {
    html: `<!doctype html>
<html lang="pt">
  <body style="margin:0;padding:0;background:#f5f5f4;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;color:transparent">${escapeHtml(input.preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f5f4">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px">
            <tr>
              <td style="padding:0 4px 14px;color:#71717a;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">
                SILENTRA
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden">
                <div style="height:5px;background:#18181b"></div>
                <div style="padding:32px 28px 30px">
                  <div style="color:#71717a;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(input.eyebrow)}</div>
                  <h1 style="margin:9px 0 12px;font-size:27px;line-height:1.18;letter-spacing:-.03em;color:#09090b">${escapeHtml(input.title)}</h1>
                  <p style="margin:0;color:#52525b;font-size:15px;line-height:1.7">${input.intro}</p>
                  <div style="margin-top:24px">${input.content}</div>
                  ${
                    ctaHref
                      ? `<div style="margin-top:28px">
                    <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:13px 19px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:11px;font-size:14px;font-weight:700">${escapeHtml(input.cta!.label)}</a>
                  </div>`
                      : ''
                  }
                  <div style="margin-top:30px;padding-top:18px;border-top:1px solid #f4f4f5;color:#71717a;font-size:12px;line-height:1.7">
                    ${input.footer ?? 'Este email foi enviado pela Silentra. Se não reconheces esta ação, contacta o suporte.'}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 4px 0;color:#a1a1aa;font-size:11px;line-height:1.6;text-align:center">
                Silentra · Gestão e agendamento para barbearias
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    text: `${input.title}

${input.intro.replace(/<[^>]+>/g, '')}

${input.content.replace(/<[^>]+>/g, '')}

${input.cta ? `${input.cta.label}: ${input.cta.href}` : ''}

${input.footer ?? 'Silentra · Gestão e agendamento para barbearias'}`,
  };
}

function details(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:11px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:12px">${escapeHtml(label)}</td><td align="right" style="padding:11px 0;border-bottom:1px solid #f4f4f5;color:#18181b;font-size:13px;font-weight:700">${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</table>`;
}

export function adminPaymentRequestEmail(context: BillingEmailContext) {
  const adminUrl =
    safeUrl(context.adminUrl) ??
    new URL('/silentra-admin', getBaseUrl()).toString();
  const name = context.customerName || context.customerEmail || 'Cliente';
  const content = details([
    ['Cliente', name],
    ['Email', context.customerEmail || '—'],
    ['Barbearia', context.barbershopName || '—'],
    ['Plano', planLabel(context.plan)],
    ['Período', intervalLabel(context.billingInterval)],
    ['Valor', money(context.price, context.currency)],
    ['Referência', reference(context.requestId)],
    ['Criado em', dateTime(context.createdAt)],
  ]);

  return shell({
    preheader: `Novo pedido ${planLabel(context.plan)} de ${name}.`,
    eyebrow: 'Billing · Novo pedido',
    title: 'Novo pedido de subscrição',
    intro: `Existe um pedido de ${escapeHtml(planLabel(context.plan))} que precisa da tua atenção.`,
    content,
    cta: { label: 'Abrir no Control Center', href: adminUrl },
    footer:
      'Este aviso é interno e foi enviado para o administrador da plataforma.',
  });
}

export function customerPaymentLinkEmail(context: BillingEmailContext) {
  const name = context.customerName || 'Cliente';
  const link = safeUrl(context.paymentLink);
  const requestRef = reference(context.requestId);

  const content =
    details([
      ['Plano', planLabel(context.plan)],
      ['Período', intervalLabel(context.billingInterval)],
      ['Valor', money(context.price, context.currency)],
      ['Referência', requestRef],
    ]) +
    `<p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.7">Usa apenas o botão acima para concluir o pagamento. A Silentra nunca te pede a palavra-passe ou códigos de autenticação através deste email.</p>`;

  return shell({
    preheader: `Pagamento de ${money(context.price, context.currency)} para ativar ${planLabel(context.plan)}.`,
    eyebrow: 'Billing · Pagamento',
    title: 'O teu pagamento está pronto',
    intro: `Olá, ${escapeHtml(name)}. O link de pagamento da tua ${escapeHtml(planLabel(context.plan))} já está disponível.`,
    content,
    cta: link ? { label: 'Efetuar pagamento', href: link } : undefined,
    footer:
      'Depois da confirmação do pagamento, a tua subscrição será ativada pela equipa Silentra.',
  });
}

export function customerSubscriptionActivatedEmail(
  context: BillingEmailContext,
) {
  const dashboardUrl =
    safeUrl(context.dashboardUrl) ??
    new URL('/dashboard/billing', getBaseUrl()).toString();
  const content = details([
    ['Plano', planLabel(context.plan)],
    ['Período', intervalLabel(context.billingInterval)],
    ['Valor', money(context.price, context.currency)],
    ['Ativado em', dateTime(context.startedAt)],
    ['Próxima renovação', dateTime(context.expiresAt)],
    ['Referência', reference(context.requestId)],
  ]);

  return shell({
    preheader: `A tua subscrição ${planLabel(context.plan)} está ativa.`,
    eyebrow: 'Billing · Ativa',
    title: 'Subscrição ativada',
    intro: `O pagamento foi confirmado e a tua subscrição está agora ativa.`,
    content,
    cta: { label: 'Abrir faturação', href: dashboardUrl },
    footer:
      'Podes consultar o estado da tua subscrição e a próxima renovação na área de faturação.',
  });
}

export function customerPaymentRejectedEmail(context: BillingEmailContext) {
  const dashboardUrl =
    safeUrl(context.dashboardUrl) ??
    new URL('/dashboard/billing', getBaseUrl()).toString();
  const reason = context.reason?.trim();

  const reasonBlock = reason
    ? `<div style="margin-top:18px;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#71717a">Nota da equipa</div><div style="margin-top:6px;color:#3f3f46;font-size:13px;line-height:1.7">${escapeHtml(reason)}</div></div>`
    : '';

  const content =
    details([
      ['Pedido', reference(context.requestId)],
      ['Plano', planLabel(context.plan)],
      ['Período', intervalLabel(context.billingInterval)],
      ['Valor', money(context.price, context.currency)],
    ]) +
    reasonBlock +
    `<p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.7">O pedido foi encerrado e não será ativado através deste processo.</p>`;

  return shell({
    preheader: `O pedido ${reference(context.requestId)} precisa de revisão.`,
    eyebrow: 'Billing · Pedido encerrado',
    title: 'Pedido de subscrição rejeitado',
    intro: `Olá, ${escapeHtml(context.customerName || 'Cliente')}. O teu pedido de subscrição não foi aprovado.`,
    content,
    cta: { label: 'Ver faturação', href: dashboardUrl },
    footer:
      'Se acreditas que isto aconteceu por engano, responde ao suporte da Silentra com a referência do pedido.',
  });
}

export function customerPaymentReceiptEmail(context: BillingEmailContext) {
  const dashboardUrl =
    safeUrl(context.dashboardUrl) ??
    new URL('/dashboard/billing', getBaseUrl()).toString();
  const content =
    details([
      ['Comprovativo', context.documentNumber || '—'],
      ['Plano', planLabel(context.plan)],
      ['Período', intervalLabel(context.billingInterval)],
      ['Total pago', money(context.price, context.currency)],
      ['Data', dateTime(context.issuedAt)],
      ['Referência', reference(context.requestId)],
    ]) +
    '<p style="margin:18px 0 0;color:#71717a;font-size:12px;line-height:1.7">O PDF em anexo é um comprovativo interno de pagamento. Não substitui uma fatura ou recibo fiscal certificado.</p>';
  return shell({
    preheader: `Comprovativo ${context.documentNumber || reference(context.requestId)} do teu pagamento Silentra.`,
    eyebrow: 'Billing · Comprovativo',
    title: 'Pagamento confirmado',
    intro:
      'O pagamento da tua subscrição foi confirmado. Enviamos em anexo o teu comprovativo de pagamento em PDF.',
    content,
    cta: { label: 'Abrir faturação', href: dashboardUrl },
    footer: 'Silentra · Gestão e agendamento para barbearias',
  });
}

export function getBillingEmailBaseUrl() {
  return getBaseUrl();
}
