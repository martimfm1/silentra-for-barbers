import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export async function getPlatformAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const allowedUserId = process.env.SILENTRA_PLATFORM_ADMIN_USER_ID?.trim();
  const allowedEmail = normalized(process.env.SILENTRA_PLATFORM_ADMIN_EMAIL);

  // Fail closed: never expose the internal panel unless an explicit admin
  // identity has been configured for this deployment.
  if (!allowedUserId && !allowedEmail) return null;

  const userMatches = allowedUserId ? user.id === allowedUserId : false;
  const emailMatches = allowedEmail
    ? normalized(user.email) === allowedEmail
    : false;

  // When both allowlist values are configured, require both to match. This
  // gives production a stable identity check plus an independent email check.
  if (allowedUserId && allowedEmail) {
    if (!userMatches || !emailMatches) return null;
  } else if (!userMatches && !emailMatches) {
    return null;
  }

  return {
    user,
    admin: createAdminClient(),
  };
}

export async function requirePlatformAdmin() {
  const context = await getPlatformAdminContext();
  if (!context) {
    const error = new Error('PLATFORM_ADMIN_REQUIRED');
    error.name = 'PlatformAdminError';
    throw error;
  }
  return context;
}
