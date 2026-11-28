import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { getPortalSession } from '@/lib/customer-booking-portal';
import { readJsonObject } from '@/lib/security/request-validation';
import { assertSameOrigin } from '@/services/billing/http';
import {
  getWebPushPublicKey,
  isWebPushConfigured,
} from '@/lib/notifications/providers/push';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function error(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === 'push.apple.com' ||
      host.endsWith('.push.apple.com') ||
      host.endsWith('.googleapis.com') ||
      host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.services.mozilla.com') ||
      host.endsWith('.notify.windows.com');
    return (
      url.protocol === 'https:' &&
      (!url.port || url.port === '443') &&
      !url.username &&
      !url.password &&
      allowedHost &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}

async function GET__unobserved(request: Request) {
  const session = await getPortalSession(request);
  if (!session) return error('Confirma novamente o teu email para gerir notificações.', 401);

  const admin = createAdminClient();
  const { count, error: lookupError } = await admin
    .from('customer_notification_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('email', session.email);

  if (lookupError) {
    console.error('[CUSTOMER_PUSH_STATUS_ERROR]', lookupError.code ?? 'UNKNOWN');
    return error('Não foi possível consultar as notificações.', 503);
  }

  return NextResponse.json(
    {
      success: true,
      configured: isWebPushConfigured(),
      publicKey: getWebPushPublicKey(),
      deviceCount: count ?? 0,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return error('A origem do pedido não pôde ser validada.', 403);
  }

  const session = await getPortalSession(request);
  if (!session) return error('Confirma novamente o teu email para gerir notificações.', 401);

  const parsed = await readJsonObject(request, {
    maxBytes: 8 * 1024,
    allowedKeys: ['subscription', 'platform', 'action', 'endpoint'],
  });
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  if (parsed.value.action === 'status') {
    const endpoint =
      typeof parsed.value.endpoint === 'string'
        ? parsed.value.endpoint.trim()
        : '';
    if (!isAllowedPushEndpoint(endpoint)) return error('Endpoint inválido.', 400);

    const { data, error: statusError } = await admin
      .from('customer_notification_subscriptions')
      .select('id')
      .eq('email', session.email)
      .eq('endpoint', endpoint)
      .maybeSingle();
    if (statusError) return error('Não foi possível consultar esta subscrição.', 503);

    return NextResponse.json(
      { success: true, subscribed: Boolean(data) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (parsed.value.action !== undefined) return error('Ação inválida.', 400);
  if (!isWebPushConfigured()) {
    return error('As notificações ainda não estão configuradas.', 503);
  }

  const subscription = parsed.value.subscription;
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    return error('Subscrição inválida.', 400);
  }

  const value = subscription as Record<string, unknown>;
  const keys =
    value.keys && typeof value.keys === 'object' && !Array.isArray(value.keys)
      ? (value.keys as Record<string, unknown>)
      : {};
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  const platform =
    typeof parsed.value.platform === 'string' &&
    ['ios', 'android', 'desktop'].includes(parsed.value.platform)
      ? parsed.value.platform
      : 'unknown';

  if (
    !isAllowedPushEndpoint(endpoint) ||
    !/^[A-Za-z0-9_-]{80,200}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(auth)
  ) {
    return error('Os dados da subscrição push não são válidos.', 400);
  }

  const { error: saveError } = await admin
    .from('customer_notification_subscriptions')
    .upsert(
      {
        email: session.email,
        endpoint,
        p256dh,
        auth,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (saveError) {
    console.error('[CUSTOMER_PUSH_SUBSCRIPTION_SAVE_ERROR]', saveError.code ?? 'UNKNOWN');
    return error('Não foi possível ativar as notificações.', 503);
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}

async function DELETE__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return error('A origem do pedido não pôde ser validada.', 403);
  }

  const session = await getPortalSession(request);
  if (!session) return error('Confirma novamente o teu email para gerir notificações.', 401);

  const parsed = await readJsonObject(request, {
    maxBytes: 4 * 1024,
    allowedKeys: ['endpoint'],
  });
  if (!parsed.ok) return parsed.response;

  const endpoint =
    typeof parsed.value.endpoint === 'string'
      ? parsed.value.endpoint.trim()
      : '';
  if (!isAllowedPushEndpoint(endpoint)) return error('Endpoint inválido.', 400);

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from('customer_notification_subscriptions')
    .delete()
    .eq('email', session.email)
    .eq('endpoint', endpoint);

  if (deleteError) {
    console.error('[CUSTOMER_PUSH_SUBSCRIPTION_DELETE_ERROR]', deleteError.code ?? 'UNKNOWN');
    return error('Não foi possível desativar as notificações.', 503);
  }

  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = withApiObservability('/api/customer-portal/notifications', GET__unobserved);
export const POST = withApiObservability('/api/customer-portal/notifications', POST__unobserved);
export const DELETE = withApiObservability('/api/customer-portal/notifications', DELETE__unobserved);
