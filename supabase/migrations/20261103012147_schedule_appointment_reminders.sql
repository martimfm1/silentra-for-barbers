begin;

create extension if not exists pg_net;

select cron.schedule(
  'silentra-appointment-reminders',
  '*/10 * * * *',
  $job$
    with signing as (
      select
        floor(extract(epoch from clock_timestamp()))::bigint::text as ts,
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'silentra_booking_outbox_cron_secret'
         limit 1) as secret,
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'silentra_booking_outbox_url'
         limit 1) as endpoint
    )
    select net.http_post(
      url := regexp_replace(signing.endpoint, '/api/cron/booking-automation-outbox/?$', '/api/cron/appointment-reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-timestamp', signing.ts,
        'x-reminder-signature', encode(
          extensions.hmac(signing.ts || ':appointment-reminders', signing.secret, 'sha256'),
          'hex'
        )
      ),
      body := jsonb_build_object('source', 'supabase-cron'),
      timeout_milliseconds := 15000
    )
    from signing
    where signing.secret is not null and signing.endpoint is not null;
  $job$
);

commit;
