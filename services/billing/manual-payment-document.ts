import { Buffer } from 'node:buffer';

export type ManualPaymentDocument = {
  id: string;
  manual_request_id: string;
  subscription_id: string | null;
  user_id: string;
  barbershop_id: string;
  document_type: 'PAYMENT_RECEIPT';
  document_number: string;
  issued_at: string;
  customer_name: string;
  customer_email: string;
  barbershop_name: string;
  plan: string;
  billing_interval: 'month' | 'year';
  payment_method: 'MANUAL';
  description: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  customer_tax_id: string | null;
  customer_phone: string | null;
  customer_address_line1: string | null;
  customer_address_line2: string | null;
  customer_postal_code: string | null;
  customer_city: string | null;
  customer_country: string | null;
  customer_website: string | null;
  seller_name: string;
  seller_website: string;
  pdf_generated_at: string | null;
  email_sent_at: string | null;
  email_message_id: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
};

const CP1252: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
};

function toWinAnsi(value: string): string {
  return Array.from(value)
    .map((character) => {
      const custom = CP1252[character];
      if (custom !== undefined) return String.fromCharCode(custom);
      const code = character.codePointAt(0) ?? 0;
      if (code >= 0x20 && code <= 0xff) return String.fromCharCode(code);
      if (character === '\t' || character === '\n' || character === '\r')
        return ' ';
      return '';
    })
    .join('');
}

function escapePdfText(value: string): string {
  return toWinAnsi(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function money(value: number, currency: string): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeCurrency = /^[A-Z]{3}$/i.test(currency) ? currency.toUpperCase() : 'EUR';
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return safeValue.toFixed(2) + ' ' + safeCurrency;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'long',
        timeZone: 'Europe/Lisbon',
      }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-PT', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Europe/Lisbon',
      }).format(date);
}

function planLabel(value: string): string {
  switch (value.toLowerCase()) {
    case 'enterprise':
      return 'Barbers Enterprise';
    case 'pro':
      return 'Barbers Pro';
    default:
      return value.trim() || 'Subscrição Silentra';
  }
}

function intervalLabel(value: 'month' | 'year'): string {
  return value === 'year' ? 'Anual' : 'Mensal';
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = toWinAnsi(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const originalWord of words) {
    let word = originalWord;
    while (word.length > maxCharacters) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(word.slice(0, maxCharacters));
      word = word.slice(maxCharacters);
    }
    if (!word) continue;

    const next = current ? current + ' ' + word : word;
    if (next.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function generateManualPaymentReceiptPdf(
  document: ManualPaymentDocument,
): Buffer {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 48;
  const right = 547;
  const width = right - left;
  const commands: string[] = [];

  const fillRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => {
    commands.push('q ' + color + ' rg ' + x + ' ' + y + ' ' + w + ' ' + h + ' re f Q');
  };

  const strokeLine = (
    x1: number,
    y: number,
    x2: number,
    color = '0.88 0.89 0.91',
    thickness = 0.7,
  ) => {
    commands.push(
      'q ' + color + ' RG ' + thickness + ' w ' + x1 + ' ' + y + ' m ' + x2 + ' ' + y + ' l S Q',
    );
  };

  const drawText = (
    x: number,
    y: number,
    value: string,
    size = 9,
    bold = false,
    color = '0.13 0.15 0.18',
  ) => {
    const safeText = escapePdfText(value);
    if (!safeText) return;
    commands.push(
      'BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + color + ' rg ' + x + ' ' + y + ' Td (' + safeText + ') Tj ET',
    );
  };

  const drawRightText = (
    rightX: number,
    y: number,
    value: string,
    size = 9,
    bold = false,
    color = '0.13 0.15 0.18',
  ) => {
    const safeText = toWinAnsi(value);
    const estimatedWidth = safeText.length * size * (bold ? 0.56 : 0.52);
    drawText(Math.max(left, rightX - estimatedWidth), y, value, size, bold, color);
  };

  const drawWrapped = (
    x: number,
    y: number,
    value: string,
    maxCharacters: number,
    size = 8,
    bold = false,
    color = '0.35 0.37 0.40',
    maxLines = 6,
    lineHeight = 12,
  ) => {
    const lines = wrapText(value, maxCharacters);
    const visibleLines = lines.slice(0, maxLines);
    visibleLines.forEach((line, index) => {
      const isLastVisibleLine = index === visibleLines.length - 1;
      const rendered =
        isLastVisibleLine && lines.length > maxLines
          ? line.slice(0, Math.max(1, maxCharacters - 3)) + '...'
          : line;
      drawText(x, y - index * lineHeight, rendered, size, bold, color);
    });
    return visibleLines.length * lineHeight;
  };

  const label = (x: number, y: number, value: string) =>
    drawText(x, y, value.toLocaleUpperCase('pt-PT'), 7, true, '0.43 0.46 0.50');

  const safeCustomerName =
    document.customer_name?.trim() ||
    document.customer_email?.trim() ||
    'Cliente';
  const safeSellerName = document.seller_name?.trim() || 'Silentra';
  const safeWebsite = document.seller_website?.trim() || 'https://silentra.me';
  const safePlan = planLabel(document.plan);
  const safeDescription =
    document.description?.trim() ||
    'Subscrição Silentra for Barbers — ' + safePlan;
  const paidAt = formatDate(document.issued_at) + ' · ' + formatTime(document.issued_at);
  const addressLines = [
    document.customer_address_line1,
    document.customer_address_line2,
    [document.customer_postal_code, document.customer_city]
      .filter(Boolean)
      .join(' '),
    document.customer_country,
  ].filter((value): value is string => Boolean(value?.trim()));

  // White page with a restrained brand header, designed for both screen and print.
  fillRect(0, 0, pageWidth, pageHeight, '1 1 1');
  fillRect(0, 730, pageWidth, 112, '0.075 0.09 0.12');
  fillRect(left, 730, 4, 112, '0.20 0.78 0.58');

  drawText(left + 14, 808, 'SILENTRA', 19, true, '1 1 1');
  drawText(left + 14, 789, 'Silentra for Barbers', 9, false, '0.80 0.83 0.86');
  drawText(left + 14, 771, safeWebsite, 8, false, '0.67 0.72 0.77');

  drawRightText(right, 808, 'COMPROVATIVO DE PAGAMENTO', 10, true, '1 1 1');
  drawRightText(right, 786, document.document_number || '—', 13, true, '1 1 1');
  fillRect(385, 753, 162, 20, '0.12 0.28 0.24');
  drawText(397, 760, 'PAGAMENTO CONFIRMADO', 7, true, '0.57 0.94 0.77');

  drawText(left, 695, 'Pagamento recebido e validado', 19, true);
  drawText(
    left,
    676,
    'Comprovativo interno relativo à subscrição Silentra for Barbers.',
    9,
    false,
    '0.42 0.44 0.48',
  );

  // Confirmation metadata.
  fillRect(left, 620, width, 42, '0.95 0.96 0.97');
  label(left + 14, 646, 'Data de confirmação');
  drawText(left + 14, 630, paidAt, 9, true);
  label(258, 646, 'Método');
  drawText(258, 630, 'Pagamento manual validado', 9, true);
  label(440, 646, 'Estado');
  drawText(440, 630, 'Pago', 9, true, '0.10 0.48 0.34');

  // Issuer and customer details; only source-backed information is shown.
  label(left, 594, 'Emitido por');
  drawText(left, 575, safeSellerName, 10, true);
  drawText(left, 560, 'Silentra for Barbers', 8, false, '0.35 0.37 0.40');
  drawWrapped(left, 545, safeWebsite, 48, 8, false, '0.35 0.37 0.40', 1);

  label(302, 594, 'Dados do cliente');
  drawText(302, 575, safeCustomerName, 10, true);
  let customerY = 560;
  const customerDetails = [
    document.barbershop_name?.trim()
      ? 'Barbearia: ' + document.barbershop_name.trim()
      : null,
    document.customer_tax_id?.trim()
      ? 'NIF / ID fiscal: ' + document.customer_tax_id.trim()
      : null,
    document.customer_email?.trim() || null,
    document.customer_phone?.trim() || null,
    ...addressLines,
  ].filter((value): value is string => Boolean(value));

  for (const detail of customerDetails.slice(0, 6)) {
    const used = drawWrapped(
      302,
      customerY,
      detail,
      42,
      7.5,
      false,
      '0.35 0.37 0.40',
      2,
      10,
    );
    customerY -= Math.max(11, used);
  }

  // Subscription detail block.
  label(left, 474, 'Detalhes da subscrição');
  fillRect(left, 449, width, 22, '0.93 0.94 0.95');
  drawText(left + 12, 457, 'DESCRIÇÃO', 7, true, '0.34 0.36 0.39');
  drawText(333, 457, 'PERIODICIDADE', 7, true, '0.34 0.36 0.39');
  drawRightText(right - 12, 457, 'VALOR', 7, true, '0.34 0.36 0.39');

  strokeLine(left, 449, right);
  drawWrapped(left + 12, 429, safeDescription, 48, 8.5, true, '0.13 0.15 0.18', 2, 11);
  drawText(333, 429, intervalLabel(document.billing_interval), 8.5, false);
  drawRightText(
    right - 12,
    429,
    money(Number(document.total), document.currency),
    8.5,
    true,
  );
  strokeLine(left, 401, right);

  // The record stores the confirmed gross amount. No VAT rate or exemption is inferred here.
  fillRect(left, 315, width, 64, '0.075 0.09 0.12');
  drawText(left + 16, 354, 'TOTAL CONFIRMADO', 8, true, '0.73 0.77 0.81');
  drawText(left + 16, 333, 'Valor registado e recebido', 8, false, '0.73 0.77 0.81');
  drawRightText(
    right - 16,
    337,
    money(Number(document.total), document.currency),
    17,
    true,
    '1 1 1',
  );

  // Reference and legal clarification.
  label(left, 285, 'Referência do documento');
  drawText(left, 267, document.document_number || '—', 9, true);
  label(302, 285, 'Subscrição');
  drawText(302, 267, safePlan, 9, true);
  drawText(302, 251, 'Periodicidade: ' + intervalLabel(document.billing_interval), 8, false, '0.35 0.37 0.40');

  strokeLine(left, 225, right, '0.88 0.89 0.91');
  label(left, 207, 'Nota sobre este documento');
  const disclaimer =
    'Este documento comprova o pagamento registado e validado pela Silentra para a subscrição indicada. É um comprovativo interno e não substitui a fatura ou o recibo fiscal que deva ser emitido pelo prestador de serviços.';
  drawWrapped(left, 190, disclaimer, 106, 7.5, false, '0.39 0.41 0.44', 3, 11);
  const recordNote =
    'Os dados do cliente correspondem à informação de faturação disponível no momento da confirmação do pagamento.';
  drawWrapped(left, 153, recordNote, 106, 7.5, false, '0.39 0.41 0.44', 2, 11);

  strokeLine(left, 105, right, '0.91 0.92 0.93');
  drawText(left, 86, 'SILENTRA  ·  barbers.silentra.me', 7, true, '0.48 0.50 0.53');
  drawRightText(right, 86, 'Documento ' + (document.document_number || '—'), 7, false, '0.48 0.50 0.53');

  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];

  let output = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(output, 'latin1');
    output += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    output += String(offsets[index]).padStart(10, '0') + ' 00000 n \n';
  }
  output += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';

  return Buffer.from(output, 'latin1');
}
