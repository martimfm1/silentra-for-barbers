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

1. **Barbers:** open Dashboard → Settings → Push notifications.
2. **Customers:** open As minhas marcações, confirm the booking email, install the customer web app if using iPhone, then enable notifications in the customer experience panel.
3. On iPhone, add Silentra to the Home Screen and open it from the new icon before requesting Web Push permission.
4. Accept the browser prompt. Customers can use the test notification in the panel; barbers can use the existing settings test.

Staff subscriptions are stored in `public.notification_subscriptions`, scoped to the authenticated staff user. Customer subscriptions are stored separately in `public.customer_notification_subscriptions`, scoped to the email verified in the customer booking portal. Both tables have RLS enabled and no client-role grants; server routes use the service role after their respective staff or portal-session authorization. Expired push endpoints (HTTP 404/410) are removed automatically.

## Current events

Staff push remains focused on operational booking events. Customer push is opt-in and can be sent for public booking requests, manually created bookings, booking confirmations, barber reschedules/cancellations, and the 24-hour appointment reminder. It is addressed to the email verified in the customer portal and opens `/my-bookings`. Existing transactional email delivery remains unchanged.

## Troubleshooting

- If the settings card says server configuration is missing, configure all three VAPID variables and redeploy.
- If permission was denied, change notification permissions in the browser or iOS Settings for the installed Silentra web app.
- A regular iPhone Safari tab can use the dashboard but cannot subscribe to Web Push; use the Home Screen app.
- Check Vercel function logs for `WEB_PUSH_DELIVERY_FAILED` or `PUSH_SUBSCRIPTION_SAVE_ERROR`.


## Customer calendar feed

The customer portal can create a private read-only iCalendar subscription link for Apple Calendar and Google Calendar. The link contains a revocable credential; anyone with it can view the feed, so it must be treated like a password. Customers can rotate the link or disable the feed from the same panel. The feed is resolved server-side to the verified email and includes only that customer's bookings.
