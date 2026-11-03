import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { readJsonObject } from '@/lib/security/request-validation';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { getWebPushPublicKey, isWebPushConfigured } from '@/lib/notifications/providers/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PUSH_ALLOWED_ROLES = ['owner', 'admin', 'manager', 'barber', 'receptionist', 'staff'] as const;

function authorizationError(status: number) {
  return NextResponse.json(
    { success: false, error: status === 401 ? 'Não autenticado.' : 'Sem permissão para gerir notificações.' },
    { status },
  );
}
async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, PUSH_ALLOWED_ROLES);
  if (!tenant.ok) return authorizationError(tenant.status);
  const { data, error } = await tenant.admin.from('notification_subscriptions')
    .select('id,platform,created_at').eq('user_id', tenant.userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[PUSH_SUBSCRIPTION_STATUS_ERROR]', error.code ?? 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Não foi possível consultar as notificações.' }, { status: 503 });
  }
  return NextResponse.json({
    success: true,
    configured: isWebPushConfigured(),
    publicKey: getWebPushPublicKey(),
    deviceCount: data?.length ?? 0,
    devices: (data ?? []).map((item) => ({ id: item.id, platform: item.platform, createdAt: item.created_at })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost = host === 'push.apple.com' || host.endsWith('.push.apple.com') ||
      host.endsWith('.googleapis.com') || host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.services.mozilla.com') || host.endsWith('.notify.windows.com');
    return url.protocol === 'https:' && (!url.port || url.port === '443') &&
      !url.username && !url.password && allowedHost && value.length <= 2048;
  } catch { return false; }
}
async function POST__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, PUSH_ALLOWED_ROLES);
  if (!tenant.ok) return authorizationError(tenant.status);
  const parsed = await readJsonObject(request, { maxBytes: 8 * 1024, allowedKeys: ['subscription', 'platform', 'action', 'endpoint'] });
  if (!parsed.ok) return parsed.response;
  if (parsed.value.action === 'status') {
    const endpoint = typeof parsed.value.endpoint === 'string' ? parsed.value.endpoint.trim() : '';
    if (!isAllowedPushEndpoint(endpoint)) return NextResponse.json({ success: false, error: 'Endpoint inválido.' }, { status: 400 });
    const { data, error } = await tenant.admin.from('notification_subscriptions')
      .select('id').eq('user_id', tenant.userId).eq('endpoint', endpoint).maybeSingle();
    if (error) return NextResponse.json({ success: false, error: 'Não foi possível consultar a subscrição.' }, { status: 503 });
    return NextResponse.json({ success: true, subscribed: Boolean(data) });
  }
  if (parsed.value.action !== undefined) return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 });
  if (!isWebPushConfigured()) {
    return NextResponse.json({ success: false, error: 'As notificações push ainda não estão configuradas.' }, { status: 503 });
  }
  const subscription = parsed.value.subscription;
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    return NextResponse.json({ success: false, error: 'Subscrição inválida.' }, { status: 400 });
  }
  const value = subscription as Record<string, unknown>;
  const keys = value.keys && typeof value.keys === 'object' && !Array.isArray(value.keys)
    ? value.keys as Record<string, unknown> : {};
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';
  const platform = typeof parsed.value.platform === 'string' && ['ios', 'android', 'desktop'].includes(parsed.value.platform)
    ? parsed.value.platform : 'unknown';
  if (!isAllowedPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{80,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,100}$/.test(auth)) {
    return NextResponse.json({ success: false, error: 'Os dados da subscrição push não são válidos.' }, { status: 400 });
  }
  const { error } = await tenant.admin.from('notification_subscriptions').upsert({
    user_id: tenant.userId, endpoint, p256dh, auth, platform, updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error('[PUSH_SUBSCRIPTION_SAVE_ERROR]', error.code ?? 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Não foi possível ativar as notificações.' }, { status: 503 });
  }
  return NextResponse.json({ success: true });
}
async function DELETE__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, PUSH_ALLOWED_ROLES);
  if (!tenant.ok) return authorizationError(tenant.status);
  const parsed = await readJsonObject(request, { maxBytes: 4 * 1024, allowedKeys: ['endpoint'] });
  if (!parsed.ok) return parsed.response;
  const endpoint = typeof parsed.value.endpoint === 'string' ? parsed.value.endpoint.trim() : '';
  if (!isAllowedPushEndpoint(endpoint)) return NextResponse.json({ success: false, error: 'Endpoint inválido.' }, { status: 400 });
  const { error } = await tenant.admin.from('notification_subscriptions').delete()
    .eq('user_id', tenant.userId).eq('endpoint', endpoint);
  if (error) {
    console.error('[PUSH_SUBSCRIPTION_DELETE_ERROR]', error.code ?? 'UNKNOWN');
    return NextResponse.json({ success: false, error: 'Não foi possível desativar as notificações.' }, { status: 503 });
  }
  return NextResponse.json({ success: true });
}
export const GET = withApiObservability('/api/notifications/push', GET__unobserved);
export const POST = withApiObservability('/api/notifications/push', POST__unobserved);
export const DELETE = withApiObservability('/api/notifications/push', DELETE__unobserved);
