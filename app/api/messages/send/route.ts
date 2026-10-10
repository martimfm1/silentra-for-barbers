import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  requireModuleContext,
  moduleErrorResponse,
} from '@/services/modules/authorization';

export const dynamic = 'force-dynamic';

const MAX_SUBJECT_LENGTH = 180;
const MAX_BODY_LENGTH = 8000;

const TEMPLATES = {
  reminder: {
    subject: 'Lembrete da sua marcação',
    body: 'Olá {{nome}},\n\nEstamos a enviar-lhe um lembrete da sua próxima marcação na {{barbearia}}.\n\nSe precisar de alterar a marcação, entre em contacto connosco.\n\nObrigado,\n{{barbearia}}',
  },
  thanks: {
    subject: 'Obrigado pela sua visita',
    body: 'Olá {{nome}},\n\nObrigado por visitar a {{barbearia}}. Esperamos voltar a recebê-lo em breve.\n\nAté à próxima!\n{{barbearia}}',
  },
  custom: { subject: '', body: 'Olá {{nome}},\n\n' },
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getTemplate(
  key: keyof typeof TEMPLATES,
  name: string,
  shopName: string,
) {
  const template = TEMPLATES[key];
  return {
    subject: template.subject
      .replaceAll('{{barbearia}}', shopName)
      .replaceAll('{{nome}}', name),
    body: template.body
      .replaceAll('{{barbearia}}', shopName)
      .replaceAll('{{nome}}', name),
  };
}

async function POST__unobserved(req: Request) {
  try {
    const tenant = await requireModuleContext('messaging', 'messages');
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    if (!payload || typeof payload !== 'object')
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

    const input = payload as Record<string, unknown>;
    const clientId = typeof input.clientId === 'string' ? input.clientId : '';
    const templateKey =
      typeof input.template === 'string' ? input.template : 'custom';
    const subjectInput =
      typeof input.subject === 'string' ? input.subject.trim() : '';
    const bodyInput = typeof input.body === 'string' ? input.body.trim() : '';

    if (!clientId || !['reminder', 'thanks', 'custom'].includes(templateKey))
      return NextResponse.json(
        { error: 'Destinatário ou template inválido.' },
        { status: 400 },
      );

    const { data: client } = await tenant.admin
      .from('users')
      .select('id,name_complete,name,email')
      .eq('id', clientId)
      .eq('barbershop_id', tenant.barbershopId)
      .eq('role', 'client')
      .maybeSingle();
    if (!client?.email)
      return NextResponse.json(
        { error: 'Este cliente não tem um endereço de email válido.' },
        { status: 400 },
      );

    const clientName = client.name_complete || client.name || 'Cliente';
    const shop = await tenant.admin
      .from('barbershops')
      .select('name')
      .eq('id', tenant.barbershopId)
      .maybeSingle();
    const shopName = shop.data?.name || 'Silentra';
    const template = getTemplate(
      templateKey as keyof typeof TEMPLATES,
      clientName,
      shopName,
    );
    const subject = (
      templateKey === 'custom' ? subjectInput : template.subject
    ).trim();
    const body = (templateKey === 'custom' ? bodyInput : template.body).trim();
    if (
      !subject ||
      !body ||
      subject.length > MAX_SUBJECT_LENGTH ||
      body.length > MAX_BODY_LENGTH
    )
      return NextResponse.json(
        { error: 'Assunto ou mensagem inválidos.' },
        { status: 400 },
      );

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_FROM_EMAIL;
    const senderName = process.env.BREVO_FROM_NAME || shopName;
    if (!apiKey || !senderEmail)
      return NextResponse.json(
        { error: 'O envio de email ainda não está configurado.' },
        { status: 503 },
      );

    const htmlContent = `<!doctype html><html lang="pt"><body style="margin:0;padding:32px 16px;background:#09090b;color:#f4f4f5;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:28px;border:1px solid #27272a;border-radius:14px;background:#18181b"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a1a1aa;font-weight:700">${escapeHtml(shopName)}</p><div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#e4e4e7">${escapeHtml(body)}</div><p style="margin-top:28px;font-size:12px;color:#71717a">Mensagem enviada através do Silentra.</p></div></body></html>`;

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: client.email, name: clientName }],
        subject,
        htmlContent,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[MESSAGES_BREVO_ERROR]', data);
      return NextResponse.json(
        { error: 'O Brevo recusou o envio da mensagem.' },
        { status: 502 },
      );
    }

    await tenant.admin.from('audit_logs').insert({
      action: 'manual_email_sent',
      entity_type: 'user',
      entity_id: client.id,
      metadata: { template: templateKey, subject },
    });
    return NextResponse.json({
      success: true,
      messageId: data.messageId ?? null,
    });
  } catch (error) {
    const authorization = moduleErrorResponse(error);
    if (authorization) return authorization;
    console.error('[MESSAGES_SEND_ERROR]', error);
    return NextResponse.json(
      { error: 'Não foi possível enviar a mensagem.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability('/api/messages/send', POST__unobserved);
