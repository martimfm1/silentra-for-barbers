begin;

create schema if not exists net;
create extension if not exists pg_net with schema net;

-- Secrets are provisioned separately in Supabase Vault; never embed credentials
-- or production URLs in the migration source.
select cron.schedule(
  'silentra-booking-automation-outbox',
  '*/10 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'silentra_booking_outbox_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'silentra_booking_outbox_cron_secret'
          limit 1
        )
      ),
      body := jsonb_build_object('source', 'supabase-cron'),
      timeout_milliseconds := 5000
    );
  $job$
);

commit;
