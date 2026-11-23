import { createHmac, timingSafeEqual } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

type UnsubscribePayload = {
  version: 1;
  barbershopId: string;
  email: string;
};

function getSigningSecret() {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET;
  if (!secret) throw new Error('Marketing unsubscribe signing key is missing.');
  return secret;
}

export function createMarketingUnsubscribeToken(barbershopId: string, email: string) {
  const payload: UnsubscribePayload = {
    version: 1,
    barbershopId,
    email: email.trim().toLowerCase(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return encoded + '.' + signature;
}

export function verifyMarketingUnsubscribeToken(token: string): UnsubscribePayload | null {
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra) return null;

  const expectedSignature = createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest();
  const supplied = Buffer.from(suppliedSignature, 'base64url');
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<UnsubscribePayload>;
    if (
      payload.version !== 1 ||
      typeof payload.barbershopId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(payload.barbershopId) ||
      typeof payload.email !== 'string' ||
      payload.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
    ) {
      return null;
    }
    return {
      version: 1,
      barbershopId: payload.barbershopId,
      email: payload.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function getMarketingUnsubscribeUrl(barbershopId: string, email: string) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://barbers.silentra.me'
  ).replace(/\/$/, '');
  const token = createMarketingUnsubscribeToken(barbershopId, email);
  return baseUrl + '/api/marketing/unsubscribe?token=' + encodeURIComponent(token);
}

export async function getConsentedMarketingEmails(
  admin: AdminClient,
  barbershopId: string,
  emails: string[],
) {
  const normalized = [
    ...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
  ];
  const eligible = new Set<string>();
  if (!normalized.length) return eligible;

  for (let index = 0; index < normalized.length; index += 200) {
    const batch = normalized.slice(index, index + 200);
    const { data, error } = await admin
      .from('marketing_contact_preferences')
      .select('email')
      .eq('barbershop_id', barbershopId)
      .not('email_consent_at', 'is', null)
      .is('email_unsubscribed_at', null)
      .in('email', batch);
    if (error) throw error;
    for (const row of data ?? []) {
      if (typeof row.email === 'string') eligible.add(row.email.toLowerCase());
    }
  }
  return eligible;
}

export async function recordMarketingEmailConsent(input: {
  admin: AdminClient;
  barbershopId: string;
  email: string;
  clientId?: string | null;
  source: 'public_booking' | 'staff_recorded';
}) {
  const email = input.email.trim().toLowerCase();
  const { error } = await input.admin
    .from('marketing_contact_preferences')
    .upsert(
      {
        barbershop_id: input.barbershopId,
        client_id: input.clientId ?? null,
        email,
        email_consent_at: new Date().toISOString(),
        email_consent_source: input.source,
        email_unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'barbershop_id,email' },
    );
  if (error) throw error;
}
