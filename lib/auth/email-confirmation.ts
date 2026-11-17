function getBaseUrl(request?: Request): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const origin = request?.headers.get('origin')?.trim();
  if (origin) return origin.replace(/\/$/, '');

  const forwardedHost = request?.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const forwardedProto =
    request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  throw new Error('Não foi possível determinar o URL público da aplicação.');
}

const INVITE_CODE = /^BARB-(?:[0-9A-HJ-NP-Z]{4}-){1,2}[0-9A-HJ-NP-Z]{4}$/;
const LEGACY_INVITE_CODE = /^[0-9A-F]{10}$/;
const INVITE_LINK_TOKEN = /^SIL-[0-9A-F]{32}$/;

/**
 * Only forwards a same-origin onboarding invitation. Other redirect values
 * are intentionally discarded so the confirmation flow cannot become an
 * open redirect.
 */
export function sanitizeInviteRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  try {
    const target = new URL(value, 'https://silentra.invalid');
    if (target.origin !== 'https://silentra.invalid' || target.pathname !== '/onboarding') {
      return null;
    }

    const invite = (target.searchParams.get('invite') ?? '').toUpperCase();
    if (
      !INVITE_CODE.test(invite) &&
      !LEGACY_INVITE_CODE.test(invite) &&
      !INVITE_LINK_TOKEN.test(invite)
    ) {
      return null;
    }

    return `/onboarding?invite=${encodeURIComponent(invite)}`;
  } catch {
    return null;
  }
}

/**
 * URL único usado pelo Supabase Auth para confirmação de email. O callback
 * valida o destino novamente antes de redirecionar para um convite.
 */
export function getAuthCallbackUrl(
  request?: Request,
  next?: unknown,
): string {
  const callback = new URL('/api/auth/callback', getBaseUrl(request));
  const safeNext = sanitizeInviteRedirect(next);
  if (safeNext) callback.searchParams.set('next', safeNext);
  return callback.toString();
}

export function getClientAuthCallbackUrl(next?: unknown): string {
  if (typeof window === 'undefined') {
    throw new Error('getClientAuthCallbackUrl só pode ser usado no browser.');
  }

  const callback = new URL('/api/auth/callback', window.location.origin);
  const safeNext = sanitizeInviteRedirect(next);
  if (safeNext) callback.searchParams.set('next', safeNext);
  return callback.toString();
}
