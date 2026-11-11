begin;

-- Retire legacy/manual campaigns without deleting their audit or delivery history.
-- Automatic interval, event, and birthday campaigns remain active.
update public.marketing_campaign_recipients as recipient
set
  status = 'skipped',
  next_attempt_at = null,
  error_message = 'Manual customer messaging is temporarily disabled.'
from public.marketing_campaigns as campaign
where recipient.campaign_id = campaign.id
  and coalesce(campaign.trigger_type, 'manual') not in ('interval', 'event', 'birthday')
  and recipient.status in ('queued', 'sending');

update public.marketing_campaigns
set
  active = false,
  status = case
    when status in ('draft', 'scheduled', 'sending') then 'cancelled'
    else status
  end,
  next_run_at = null,
  updated_at = now()
where coalesce(trigger_type, 'manual') not in ('interval', 'event', 'birthday');

commit;
