# Web Push — Silentra for Barbers

Silentra uses standards-based Web Push directly. No paid push provider, native iOS app, or Apple Developer Program membership is required.

## Requirements

- Production site served over HTTPS.
- A service worker at `/sw.js` and the existing standalone PWA manifest.
- On iPhone/iPad: iOS/iPadOS 16.4 or later, and the web app must be added to the Home Screen and opened from its icon. A normal Safari tab cannot receive iPhone Web Push.
- On supported desktop browsers and Android, users can subscribe from the browser.

## VAPID setup

Generate one key pair locally:

```bash
node scripts/generate-vapid-keys.mjs
```

Add the output to Vercel for Production (and Preview if push should be tested there):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public key; safe to expose to the browser.
- `VAPID_PRIVATE_KEY` — private key; secret, server-side only.
- `VAPID_SUBJECT` — contact URI, normally `mailto:contact.silentra@gmail.com`.

Redeploy after adding the variables. Do not rotate the key pair after users have subscribed unless you plan to ask them to subscribe again.

## User flow

1. Open Dashboard → Settings → Push notifications.
2. On iPhone, if using a Safari tab, add Silentra to the Home Screen and open it from the new icon.
3. Tap **Enable notifications** and accept the browser prompt.
4. Use **Send a test notification** to verify delivery.

Subscriptions are stored in `public.notification_subscriptions`, scoped to the authenticated staff user. The table has RLS enabled and no client-role grants; server routes use the service role after tenant/role authorization. Expired push endpoints (HTTP 404/410) are removed automatically.

## Current events

Push is sent for new bookings created through the public booking flow and the dashboard booking form. It is delivered to the assigned barber when one is assigned, otherwise to the barbershop's barber/owner/admin accounts. The existing email notification remains unchanged for public bookings; dashboard-created bookings use push only to avoid duplicate emails.

## Troubleshooting

- If the settings card says server configuration is missing, configure all three VAPID variables and redeploy.
- If permission was denied, change notification permissions in the browser or iOS Settings for the installed Silentra web app.
- A regular iPhone Safari tab can use the dashboard but cannot subscribe to Web Push; use the Home Screen app.
- Check Vercel function logs for `WEB_PUSH_DELIVERY_FAILED` or `PUSH_SUBSCRIPTION_SAVE_ERROR`.
