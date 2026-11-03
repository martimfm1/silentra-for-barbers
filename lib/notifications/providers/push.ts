import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPushEnabled } from '@/lib/notifications/config';

type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type WebPushPayload = { title: string; body: string; url?: string; tag?: string };

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}
function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}
function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let produced = 0;
  let counter = 1;
  while (produced < length) {
    previous = createHmac('sha256', prk).update(previous).update(info).update(Buffer.from([counter])).digest();
    chunks.push(previous);
    produced += previous.length;
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}
function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:contact.silentra@gmail.com';
  if (!publicKey || !privateKey || !isPushEnabled()) return null;
  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) return null;
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) return null;
  return { publicKey: publicBytes, privateKey: privateBytes, subject };
}
export function getWebPushPublicKey(): string | null {
  const config = getVapidConfig();
  return config ? encodeBase64Url(config.publicKey) : null;
}
export function isWebPushConfigured(): boolean {
  return getVapidConfig() !== null;
}
function createVapidAuthorization(endpoint: string, config: NonNullable<ReturnType<typeof getVapidConfig>>) {
  const url = new URL(endpoint);
  const publicKey = config.publicKey;
  const privateKey = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: encodeBase64Url(publicKey.subarray(1, 33)),
      y: encodeBase64Url(publicKey.subarray(33, 65)),
      d: encodeBase64Url(config.privateKey),
    },
    format: 'jwk',
  });
  const header = encodeBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = encodeBase64Url(JSON.stringify({
    aud: url.origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${encodeBase64Url(signature)}`;
}
function encryptPayload(payload: WebPushPayload, subscription: StoredSubscription): Buffer {
  const userPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4 || authSecret.length < 16) {
    throw new Error('INVALID_PUSH_SUBSCRIPTION_KEYS');
  }
  const serverKey = createECDH('prime256v1');
  serverKey.generateKeys();
  const serverPublicKey = serverKey.getPublicKey();
  const sharedSecret = serverKey.computeSecret(userPublicKey);
  const authPrk = createHmac('sha256', authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), userPublicKey, serverPublicKey]);
  const inputKeyMaterial = hkdfExpand(authPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const contentPrk = createHmac('sha256', salt).update(inputKeyMaterial).digest();
  const contentKey = hkdfExpand(contentPrk, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdfExpand(contentPrk, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);
  const message = Buffer.from(JSON.stringify({
    title: payload.title.slice(0, 100),
    body: payload.body.slice(0, 240),
    url: payload.url?.startsWith('/') && !payload.url.startsWith('//') ? payload.url : '/dashboard',
    tag: payload.tag?.slice(0, 120),
  }), 'utf8');
  const cipher = createCipheriv('aes-128-gcm', contentKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([message, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = serverPublicKey.length;
  return Buffer.concat([header, serverPublicKey, ciphertext]);
}
async function sendToSubscription(subscription: StoredSubscription, payload: WebPushPayload): Promise<{ success: boolean; status?: number }> {
  const config = getVapidConfig();
  if (!config) return { success: false };
  const endpoint = new URL(subscription.endpoint);
  if (endpoint.protocol !== 'https:' || (endpoint.port && endpoint.port !== '443')) return { success: false };
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `vapid t=${createVapidAuthorization(subscription.endpoint, config)}, k=${encodeBase64Url(config.publicKey)}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '60',
      Urgency: 'high',
    },
    body: new Uint8Array(encryptPayload(payload, subscription)),
  });
  return { success: response.ok, status: response.status };
}
export async function sendWebPushToUsers(userIds: string[], payload: WebPushPayload): Promise<{ sent: number; failed: number }> {
  if (!isPushEnabled() || !isWebPushConfigured() || userIds.length === 0) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const { data, error } = await admin.from('notification_subscriptions')
    .select('id,endpoint,p256dh,auth').in('user_id', uniqueIds);
  if (error) {
    console.error('[WEB_PUSH_SUBSCRIPTIONS_LOOKUP_FAILED]', error.code ?? 'UNKNOWN');
    return { sent: 0, failed: uniqueIds.length };
  }
  const subscriptions = (data ?? []) as StoredSubscription[];
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      const result = await sendToSubscription(subscription, payload);
      if (result.status === 404 || result.status === 410) {
        await admin.from('notification_subscriptions').delete().eq('id', subscription.id);
      }
      return result.success;
    } catch (error) {
      console.error('[WEB_PUSH_DELIVERY_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
      return false;
    }
  }));
  return { sent: results.filter(Boolean).length, failed: results.filter((success) => !success).length };
}
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<{ sent: number; failed: number }> {
  return sendWebPushToUsers([userId], payload);
}
