import { withApiObservability } from '@/lib/observability/api';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/security/public-rate-limit';
import { normalizeText, UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';

export const runtime = 'nodejs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOOKUP_TOKEN_TTL_SECONDS = 5 * 60;
const LOOKUP_RATE_LIMIT = 30;
const LOOKUP_RATE_WINDOW_SECONDS = 10 * 60;

type LookupTokenPayload = {
  shopId: string;
  barbershopId: string;
  customerId: string;
  expiresAt: number;
};

function getTokenSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET is not configured securely.');
  }
  return secret;
}

function getTokenEncryptionKey(): Buffer {
  return createHash('sha256').update(getTokenSecret()).digest();
}

function signLookupToken(payload: LookupTokenPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function verifyLookupToken(token: string): LookupTokenPayload | null {
  const [encodedIv, encodedTag, encodedPayload, extra] = token.split('.');
  if (
    !encodedIv ||
    !encodedTag ||
    !encodedPayload ||
    extra !== undefined ||
    token.length > 2048
  ) {
    return null;
  }

  try {
    const iv = Buffer.from(encodedIv, 'base64url');
    const authTag = Buffer.from(encodedTag, 'base64url');
    const encrypted = Buffer.from(encodedPayload, 'base64url');
    if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
      return null;
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      getTokenEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const payload = JSON.parse(
      decrypted.toString('utf8'),
    ) as Partial<LookupTokenPayload>;

    if (
      typeof payload.shopId !== 'string' ||
      !UUID_PATTERN.test(payload.shopId) ||
      typeof payload.barbershopId !== 'string' ||
      !UUID_PATTERN.test(payload.barbershopId) ||
      typeof payload.customerId !== 'string' ||
      !UUID_PATTERN.test(payload.customerId) ||
      typeof payload.expiresAt !== 'number' ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as LookupTokenPayload;
  } catch {
    return null;
  }
}

async function enforceLookupRateLimit(
  request: Request,
  shopId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const key = createHmac('sha256', getTokenSecret())
    .update(
      'public-booking-customer-profile:' + shopId + ':' + getClientIp(request),
    )
    .digest('hex');
  const { data: allowed, error } = await admin.rpc(
    'consume_public_rate_limit',
    {
      p_key: key,
      p_limit: LOOKUP_RATE_LIMIT,
      p_window_seconds: LOOKUP_RATE_WINDOW_SECONDS,
    },
  );
  if (error) {
    console.error(
      '[API_BOOKING_CUSTOMER_PROFILE_RATE_LIMIT_ERROR]',
      error.code ?? 'UNKNOWN',
    );
    throw new Error('Customer lookup rate limiter unavailable.');
  }
  return allowed === true;
}

async function POST__unobserved(request: Request) {
  try {
    const payloadResult = await readJsonObject(request, {
      maxBytes: 4 * 1024,
      allowedKeys: ['action', 'shopId', 'lookupBy', 'value', 'lookupToken'],
    });
    if (!payloadResult.ok) return payloadResult.response;
    const payload = payloadResult.value;

    const action = payload.action === 'confirm' ? 'confirm' : payload.action;
    const shopId = typeof payload.shopId === 'string' ? payload.shopId : '';
    if (!UUID_PATTERN.test(shopId) || !['lookup', 'confirm'].includes(String(action))) {
      return NextResponse.json(
        { success: false, error: 'Pedido de pesquisa inválido.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    if (!(await enforceLookupRateLimit(request, shopId, admin))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(LOOKUP_RATE_WINDOW_SECONDS) },
        },
      );
    }

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('barbershop_id,is_active')
      .eq('id', shopId)
      .maybeSingle();

    if (shopError) throw shopError;
    if (!shop?.barbershop_id || !shop.is_active) {
      return NextResponse.json(
        { success: false, error: 'Barbearia indisponível.' },
        { status: 404 },
      );
    }

    if (action === 'lookup') {
      const lookupBy = payload.lookupBy === 'email' ? 'email' : payload.lookupBy;
      const value = normalizeText(payload.value, lookupBy === 'email' ? 254 : 30) ?? '';
      const normalizedEmail = lookupBy === 'email' ? value.toLowerCase() : '';
      const normalizedPhone = lookupBy === 'phone' ? value : '';

      if (
        !['email', 'phone'].includes(String(lookupBy)) ||
        (lookupBy === 'email' &&
          (!EMAIL_PATTERN.test(normalizedEmail) ||
            normalizedEmail.length > 254)) ||
        (lookupBy === 'phone' &&
          normalizedPhone.replace(/\D/g, '').length < 7)
      ) {
        return NextResponse.json(
          { success: false, error: 'Indica um email ou telemóvel válido.' },
          { status: 400 },
        );
      }

      const { data, error } = await admin.rpc(
        'lookup_public_booking_customer',
        {
          p_barbershop_id: shop.barbershop_id,
          p_email: lookupBy === 'email' ? normalizedEmail : null,
          p_phone: lookupBy === 'phone' ? normalizedPhone : null,
        },
      );
      if (error) {
        console.error(
          '[API_BOOKING_CUSTOMER_PROFILE_LOOKUP_ERROR]',
          error.code ?? 'UNKNOWN',
        );
        throw new Error('Customer profile lookup failed.');
      }

      const customer = Array.isArray(data) ? data[0] : data;
      if (!customer?.customer_id) {
        return NextResponse.json(
          { success: true, matched: false },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const displayCustomerName =
        typeof customer.customer_name === 'string'
          ? customer.customer_name
              .replace(/[\x00-\x1f\x7f]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 80)
          : '';

      const lookupToken = signLookupToken({
        shopId,
        barbershopId: shop.barbershop_id,
        customerId: customer.customer_id,
        expiresAt:
          Math.floor(Date.now() / 1000) + LOOKUP_TOKEN_TTL_SECONDS,
      });

      return NextResponse.json(
        {
          success: true,
          matched: true,
          matchedBy: lookupBy,
          customerName: displayCustomerName || null,
          lookupToken,
          expiresInSeconds: LOOKUP_TOKEN_TTL_SECONDS,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const lookupToken =
      typeof payload.lookupToken === 'string' ? payload.lookupToken : '';
    const tokenPayload = lookupToken
      ? verifyLookupToken(lookupToken)
      : null;
    if (
      !tokenPayload ||
      tokenPayload.shopId !== shopId ||
      tokenPayload.barbershopId !== shop.barbershop_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Esta confirmação expirou. Volta a introduzir o teu contacto.',
        },
        { status: 410 },
      );
    }

    const { data: customer, error: customerError } = await admin
      .from('users')
      .select('name_complete,email,num_phone,birth_date')
      .eq('id', tokenPayload.customerId)
      .eq('barbershop_id', tokenPayload.barbershopId)
      .eq('role', 'client')
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'O perfil já não está disponível. Confirma os teus dados manualmente.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: {
          name: customer.name_complete ?? '',
          email: customer.email ?? '',
          phone: customer.num_phone ?? '',
          birthDate: customer.birth_date ?? '',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[API_BOOKING_CUSTOMER_PROFILE_ERROR]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Não foi possível verificar os dados do cliente.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/bookings/customer-profile',
  POST__unobserved,
);
