begin;

create schema if not exists net;
create extension if not exists pg_net with schema net;

-- Secrets are provisioned separately in Supabase Vault; never embed credentials
-- or production URLs in the migration source.
select cron.schedule(
  'silentra-booking-automation-outbox',
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
      url := signing.endpoint,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-booking-timestamp', signing.ts,
        'x-booking-signature', encode(
          extensions.hmac(signing.ts || ':booking-outbox', signing.secret, 'sha256'),
          'hex'
        )
      ),
      body := jsonb_build_object('source', 'supabase-cron'),
      timeout_milliseconds := 5000
    )
    from signing
    where signing.secret is not null and signing.endpoint is not null;
  $job$
);

commit;
