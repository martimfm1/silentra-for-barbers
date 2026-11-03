import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readJsonObject } from '@/lib/security/request-validation';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { getOwnedBarbershopForDeletion, verifyAccountPassword } from '@/lib/security/barbershop-deletion-auth';
import { generateBarbershopDeletionCode, hashBarbershopDeletionCode } from '@/lib/security/barbershop-deletion';
import { sendBarbershopDeletionCodeEmail } from '@/lib/brevo/barbershop-deletion';

export const runtime = 'nodejs';

async function POST__unobserved(request: Request) {
  try {
    const parsed = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['password'],
    });
    if (!parsed.ok) return parsed.response;
    const password = typeof parsed.value.password === 'string' ? parsed.value.password : '';
    if (!password || password.length > 128) {
      return NextResponse.json({ error: 'Introduz a palavra-passe da conta.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'A sessão expirou. Inicia sessão novamente.' }, { status: 401 });
    }

    const shop = await getOwnedBarbershopForDeletion(user.id);
    const allowed = await consumePublicRateLimit(
      request,
      'barbershop-deletion-request',
      user.id,
      3,
      15 * 60,
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Atingiste o limite de pedidos. Tenta novamente mais tarde.' }, { status: 429 });
    }

    const passwordValid = await verifyAccountPassword(user.email, password);
    if (!passwordValid) {
      return NextResponse.json({ error: 'A palavra-passe está incorreta.' }, { status: 401 });
    }

    if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL || !process.env.RATE_LIMIT_SECRET) {
      return NextResponse.json({ error: 'O serviço de confirmação por email não está disponível.' }, { status: 503 });
    }

    const admin = createAdminClient();
    const code = generateBarbershopDeletionCode();
    const codeHash = hashBarbershopDeletionCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: cleanupError } = await admin
      .from('barbershop_deletion_verifications')
      .delete()
      .eq('barbershop_id', shop.barbershopId)
      .eq('user_id', user.id)
      .is('consumed_at', null);
    if (cleanupError) throw cleanupError;

    const { error: insertError } = await admin
      .from('barbershop_deletion_verifications')
      .insert({
        barbershop_id: shop.barbershopId,
        user_id: user.id,
        email: user.email.toLowerCase(),
        code_hash: codeHash,
        expires_at: expiresAt,
      });
    if (insertError) throw insertError;

    try {
      await sendBarbershopDeletionCodeEmail({
        email: user.email,
        code,
        barbershopName: shop.barbershopName,
        language: shop.language,
      });
    } catch {
      await admin
        .from('barbershop_deletion_verifications')
        .delete()
        .eq('barbershop_id', shop.barbershopId)
        .eq('user_id', user.id)
        .eq('code_hash', codeHash);
      return NextResponse.json({ error: 'Não foi possível enviar o código. Tenta novamente.' }, { status: 503 });
    }

    return NextResponse.json(
      { success: true, email: user.email, expiresInSeconds: 600 },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'BARBERSHOP_OWNER_REQUIRED') {
      return NextResponse.json({ error: 'Só o proprietário pode apagar a barbearia.' }, { status: 403 });
    }
    console.error('[BARBERSHOP_DELETION_CODE_REQUEST_FAILED]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Não foi possível iniciar a confirmação.' }, { status: 500 });
  }
}

export const POST = withApiObservability(
  '/api/dashboard/barbershop-deletion/request-code',
  POST__unobserved,
);
