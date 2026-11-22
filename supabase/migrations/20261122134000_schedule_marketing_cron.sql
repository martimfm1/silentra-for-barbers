begin;

create extension if not exists pg_net;

-- The existing booking worker URL and HMAC secret are provisioned in Vault.
-- Derive the marketing endpoint without duplicating production secrets.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'silentra-marketing'
  ) then
    perform cron.unschedule('silentra-marketing');
  end if;

  perform cron.schedule(
    'silentra-marketing',
    '*/5 * * * *',
    $cron$
      with signing as (
        select
          floor(extract(epoch from clock_timestamp()))::bigint::text as ts,
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'silentra_booking_outbox_cron_secret'
            limit 1
          ) as secret,
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'silentra_booking_outbox_url'
            limit 1
          ) as endpoint
      )
      select net.http_post(
        url := regexp_replace(
          signing.endpoint,
          '/api/cron/booking-automation-outbox/?$',
          '/api/cron/marketing'
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-marketing-timestamp', signing.ts,
          'x-marketing-signature', encode(
            extensions.hmac(
              signing.ts || ':marketing',
              signing.secret,
              'sha256'
            ),
            'hex'
          )
        ),
        body := jsonb_build_object('source', 'supabase-cron'),
        timeout_milliseconds := 60000
      )
      from signing
      where signing.secret is not null
        and signing.endpoint is not null
        and signing.endpoint ~ '/api/cron/booking-automation-outbox/?$';
    $cron$
  );
end
$$;

commit;
