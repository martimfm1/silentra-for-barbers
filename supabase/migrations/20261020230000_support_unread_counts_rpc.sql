-- Aggregate unread support message counts in Postgres instead of downloading every
-- unread message ID into the admin API and grouping the rows in JavaScript.
create or replace function public.support_unread_counts(p_conversation_ids uuid[])
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
set search_path = ''
as $function$
  select
    message.conversation_id,
    pg_catalog.count(*)::bigint as unread_count
  from public.support_messages as message
  where message.conversation_id = any (coalesce(p_conversation_ids, array[]::uuid[]))
    and message.sender_type = 'customer'
    and message.read_at is null
  group by message.conversation_id;
$function$;

revoke all on function public.support_unread_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.support_unread_counts(uuid[]) to service_role;
