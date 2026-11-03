import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { readJsonObject } from '@/lib/security/request-validation';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { getOwnedBarbershopForDeletion, verifyAccountPassword } from '@/lib/security/barbershop-deletion-auth';
import { hashBarbershopDeletionCode } from '@/lib/security/barbershop-deletion';

export const runtime = 'nodejs';

async function POST__unobserved(request: Request) {
  try {
    const parsed = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['password', 'code'],
    });
    if (!parsed.ok) return parsed.response;
    const password = typeof parsed.value.password === 'string' ? parsed.value.password : '';
    const code = typeof parsed.value.code === 'string' ? parsed.value.code.trim() : '';
    if (!password || password.length > 128 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Confirma a palavra-passe e introduz o código de 6 dígitos.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'A sessão expirou. Inicia sessão novamente.' }, { status: 401 });
    }

    const shop = await getOwnedBarbershopForDeletion(user.id);
    const allowed = await consumePublicRateLimit(
      request,
      'barbershop-deletion-confirm',
      user.id,
      5,
      15 * 60,
    );
    if (!allowed) {
      return NextResponse.json({ error: 'Demasiadas tentativas. Pede um novo código mais tarde.' }, { status: 429 });
    }

    const passwordValid = await verifyAccountPassword(user.email, password);
    if (!passwordValid) {
      return NextResponse.json({ error: 'A palavra-passe está incorreta.' }, { status: 401 });
    }

    const admin = createAdminClient();
    const codeHash = hashBarbershopDeletionCode(code);
    const { data: verification, error: verificationError } = await admin.rpc(
      'verify_barbershop_deletion_code',
      {
        p_barbershop_id: shop.barbershopId,
        p_actor_user_id: user.id,
        p_code_hash: codeHash,
      },
    );
    if (verificationError) throw verificationError;
    if (verification !== 'OK') {
      const message = verification === 'CODE_LOCKED'
        ? 'Atingiste o limite de tentativas. Pede um novo código.'
        : 'O código está incorreto ou expirou.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const subscription = await BarbershopStripeService.getSubscriptionForBarbershop(shop.barbershopId);
    if (
      subscription?.payment_method !== 'MANUAL' &&
      subscription?.stripe_subscription_id
    ) {
      const stripe = getStripeClient();
      const remote = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      if (!['canceled', 'incomplete_expired'].includes(remote.status)) {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }
    }

    const { data: deleted, error: deleteError } = await admin.rpc(
      'delete_barbershop_after_verification',
      {
        p_barbershop_id: shop.barbershopId,
        p_actor_user_id: user.id,
        p_code_hash: codeHash,
      },
    );
    if (deleteError) throw deleteError;
    if (deleted !== 'DELETED') {
      return NextResponse.json({ error: 'A confirmação expirou. Pede um novo código e tenta novamente.' }, { status: 409 });
    }

    const storageResults = await Promise.all([
      admin.storage.from('avatar').remove([`${shop.barbershopId}/avatar.webp`]),
      admin.storage.from('banner').remove([`${shop.barbershopId}/banner.webp`]),
    ]);
    if (storageResults.some((result) => result.error)) {
      console.error('[BARBERSHOP_DELETION_STORAGE_CLEANUP_FAILED]', {
        avatarFailed: Boolean(storageResults[0].error),
        bannerFailed: Boolean(storageResults[1].error),
      });
    }

    return NextResponse.json(
      { success: true, redirectTo: '/onboarding' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'BARBERSHOP_OWNER_REQUIRED') {
      return NextResponse.json({ error: 'Só o proprietário pode apagar a barbearia.' }, { status: 403 });
    }
    console.error('[BARBERSHOP_DELETION_FAILED]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Não foi possível apagar a barbearia. A subscrição poderá já ter sido cancelada; contacta o suporte se o problema persistir.' }, { status: 500 });
  }
}

export const POST = withApiObservability(
  '/api/dashboard/barbershop-deletion/confirm',
  POST__unobserved,
);
