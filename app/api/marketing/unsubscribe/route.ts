import { createAdminClient } from '@/lib/supabase/admin';
import { verifyMarketingUnsubscribeToken } from '@/lib/marketing/consent';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(message: string, token?: string, status = 200) {
  const safeMessage = message.replace(/[&<>"']/g, (char) =>
    ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char] ?? char,
  );
  const safeToken = (token ?? '').replace(/[^a-zA-Z0-9._-]/g, '');
  const content = token
    ? '<form method="post"><input type="hidden" name="token" value="' +
      safeToken +
      '"><button type="submit" style="border:0;border-radius:999px;background:#18181b;color:#fff;padding:14px 22px;font-weight:700;cursor:pointer;">Cancelar subscrição</button></form>'
    : '';
  return new NextResponse(
    '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferências de email</title><body style="margin:0;background:#f4f2ed;font-family:Arial,sans-serif;color:#18181b;min-height:100vh;display:grid;place-items:center;padding:24px"><main style="max-width:480px;background:white;border:1px solid #e7e3db;border-radius:20px;padding:32px;box-shadow:0 16px 50px #00000010"><div style="font-size:11px;letter-spacing:2px;color:#a18752;font-weight:700">PREFERÊNCIAS DE EMAIL</div><h1 style="font-size:26px;margin:14px 0">Gerir subscrição</h1><p style="line-height:1.7;color:#52525b">' +
      safeMessage +
      '</p>' + content +
      '<p style="margin-top:26px;color:#a1a1aa;font-size:11px">Silentra · Preferências de comunicação</p></main></body></html>',
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  try {
    if (!verifyMarketingUnsubscribeToken(token)) {
      return page('Este link de cancelamento não é válido ou já foi alterado.', undefined, 400);
    }
    return page(
      'Confirma que pretendes deixar de receber campanhas e novidades por email desta barbearia.',
      token,
    );
  } catch (error) {
    console.error('[MARKETING_UNSUBSCRIBE_VERIFY]', error);
    return page('Não foi possível validar este link.', undefined, 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    const payload = verifyMarketingUnsubscribeToken(token);
    if (!payload) return page('Este link de cancelamento não é válido.', undefined, 400);

    const admin = createAdminClient();
    const { error } = await admin
      .from('marketing_contact_preferences')
      .update({
        email_unsubscribed_at: new Date().toISOString(),
        email_preference_updated_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('barbershop_id', payload.barbershopId)
      .eq('email', payload.email);
    if (error) throw error;

    return page('A subscrição foi cancelada. Não voltarás a receber campanhas promocionais desta barbearia.');
  } catch (error) {
    console.error('[MARKETING_UNSUBSCRIBE_POST]', error);
    return page('Não foi possível guardar a tua preferência. Tenta novamente.', undefined, 500);
  }
}
