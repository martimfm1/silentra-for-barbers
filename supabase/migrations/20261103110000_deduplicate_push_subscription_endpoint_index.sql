begin;

-- notification_subscriptions already has a UNIQUE(endpoint) constraint.
-- Remove the additional unique index introduced by the Web Push rollout.
drop index if exists public.notification_subscriptions_endpoint_uidx;

commit;
