import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import {
  deliverSupportEmailNotification,
  getPlatformSupportEmail,
  isTrustedSupportOrigin,
  normalizeSupportPlan,
  type SupportStatus,
  type SupportPlan,
  supportPriority,
} from '@/services/support/support-chat.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<SupportStatus>(['open', 'waiting_customer', 'closed']);

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function GET__unobserved(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId')?.trim() ?? '';

    if (conversationId && !UUID_RE.test(conversationId)) {
      return jsonError('ID da conversa inválido.', 400);
    }

    const { data: conversations, error: conversationsError } = await admin
      .from('support_conversations')
      .select('id,barbershop_id,customer_user_id,subject,description,status,plan,priority,last_message_at,last_message_preview,accepted_at,accepted_by,created_at,updated_at')
      .order('priority', { ascending: false })
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(250);

    if (conversationsError) throw new Error('SUPPORT_ADMIN_CONVERSATIONS_LOOKUP_FAILED');

    const rows = [...(conversations ?? [])];
    if (conversationId && !rows.some((row) => row.id === conversationId)) {
      const extra = await admin
        .from('support_conversations')
        .select('id,barbershop_id,customer_user_id,subject,description,status,plan,priority,last_message_at,last_message_preview,accepted_at,accepted_by,created_at,updated_at')
        .eq('id', conversationId)
        .maybeSingle();
      if (extra.error) throw new Error('SUPPORT_ADMIN_SELECTED_CONVERSATION_LOOKUP_FAILED');
      if (extra.data) rows.push(extra.data);
      else return jsonError('Conversa não encontrada.', 404);
    }
    const conversationIds = rows.map((row) => row.id);
    const customerIds = [...new Set(rows.map((row) => row.customer_user_id))];
    const shopIds = [...new Set(rows.map((row) => row.barbershop_id))];

    const [usersResult, shopsResult, unreadResult, assignmentsResult, subscriptionsResult] =
      conversationIds.length
        ? await Promise.all([
            customerIds.length
              ? admin.from('users').select('id,name_complete,email').in('id', customerIds)
              : Promise.resolve({ data: [], error: null }),
            shopIds.length
              ? admin.from('barbershops').select('id,name,slug').in('id', shopIds)
              : Promise.resolve({ data: [], error: null }),
            admin
              .from('support_messages')
              .select('conversation_id,id', { count: 'exact' })
              .in('conversation_id', conversationIds)
              .eq('sender_type', 'customer')
              .is('read_at', null),
            admin
              .from('barbershop_plan_assignments')
              .select('barbershop_id,plan,expires_at')
              .in('barbershop_id', shopIds),
            admin
              .from('subscriptions')
              .select('barbershop_id,plan,plan_override,status')
              .in('barbershop_id', shopIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (
      usersResult.error ||
      shopsResult.error ||
      unreadResult.error ||
      assignmentsResult.error ||
      subscriptionsResult.error
    ) {
      throw new Error('SUPPORT_ADMIN_CONTEXT_LOOKUP_FAILED');
    }

    const userById = new Map((usersResult.data ?? []).map((item) => [item.id, item]));
    const shopById = new Map((shopsResult.data ?? []).map((item) => [item.id, item]));
    const unreadByConversation = new Map<string, number>();
    for (const message of unreadResult.data ?? []) {
      unreadByConversation.set(
        message.conversation_id,
        (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
      );
    }
    const assignmentByShop = new Map(
      (assignmentsResult.data ?? []).map((assignment) => [assignment.barbershop_id, assignment]),
    );
    const subscriptionByShop = new Map(
      (subscriptionsResult.data ?? []).map((subscription) => [subscription.barbershop_id, subscription]),
    );
    const resolveEffectivePlan = (barbershopId: string): SupportPlan => {
      const assignment = assignmentByShop.get(barbershopId);
      if (
        assignment &&
        (!assignment.expires_at || Date.parse(assignment.expires_at) > Date.now())
      ) {
        return normalizeSupportPlan(assignment.plan);
      }

      const subscription = subscriptionByShop.get(barbershopId);
      if (subscription?.plan_override) return normalizeSupportPlan(subscription.plan_override);
      if (
        (subscription?.status === 'active' || subscription?.status === 'trialing') &&
        (subscription?.plan === 'pro' || subscription?.plan === 'enterprise')
      ) {
        return subscription.plan;
      }
      return 'free';
    };

    const normalizedConversations = await Promise.all(
      rows.map(async (row) => {
        const customer = userById.get(row.customer_user_id);
        let customerEmail = customer?.email ?? null;
        if (!customerEmail) {
          const result = await admin.auth.admin.getUserById(row.customer_user_id);
          customerEmail = result.data.user?.email ?? null;
        }
        const shop = shopById.get(row.barbershop_id);
        const effectivePlan = resolveEffectivePlan(row.barbershop_id);
        return {
          ...row,
          plan: effectivePlan,
          priority: supportPriority(effectivePlan),
          unreadCount: unreadByConversation.get(row.id) ?? 0,
          customer: {
            id: row.customer_user_id,
            name: customer?.name_complete || customerEmail || 'Membro Silentra',
            email: customerEmail,
          },
          barbershop: {
            id: row.barbershop_id,
            name: shop?.name || 'Barbearia',
            slug: shop?.slug ?? null,
          },
        };
      }),
    );

    let messages: Array<Record<string, unknown>> = [];
    if (conversationId) {
      if (!UUID_RE.test(conversationId)) {
        return jsonError('ID da conversa inválido.', 400);
      }
      const selected = rows.find((row) => row.id === conversationId);
      if (!selected) return jsonError('Conversa não encontrada.', 404);

      if (selected.status !== 'pending') {
        const messageResult = await admin
          .from('support_messages')
          .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (messageResult.error) {
          throw new Error('SUPPORT_ADMIN_MESSAGES_LOOKUP_FAILED');
        }
        messages = (messageResult.data ?? []).reverse();
      }
      // Priority is resolved from current assignment/subscription rows, not
      // the browser or potentially stale conversation metadata.
      const effectivePlan = resolveEffectivePlan(selected.barbershop_id);

      const { error: syncError } = await admin
        .from('support_conversations')
        .update({ plan: effectivePlan, priority: supportPriority(effectivePlan) })
        .eq('id', conversationId);
      if (syncError) throw new Error('SUPPORT_ADMIN_PLAN_SYNC_FAILED');

      const updated = normalizedConversations.find((row) => row.id === conversationId);
      if (updated) {
        updated.plan = effectivePlan;
        updated.priority = supportPriority(effectivePlan);
      }
    }

    const totalUnread = normalizedConversations.reduce((sum, row) => sum + row.unreadCount, 0);
    return NextResponse.json(
      {
        ok: true,
        conversations: normalizedConversations,
        messages,
        selectedConversationId: conversationId || null,
        totalUnread,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return jsonError('Não encontrado.', 404);
    }
    console.error('[SUPPORT_ADMIN_GET_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível carregar a caixa de suporte.', 500);
  }
}

async function POST__unobserved(request: Request) {
  if (!isTrustedSupportOrigin(request)) {
    return jsonError('Pedido de origem não autorizado.', 403);
  }

  try {
    const { admin, user } = await requirePlatformAdmin();
    const { data: senderProfile, error: senderProfileError } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (senderProfileError) throw new Error('SUPPORT_ADMIN_SENDER_LOOKUP_FAILED');
    const senderUserId = senderProfile?.id ?? null;

    const bodyResult = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: ['conversationId', 'message'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const payload = bodyResult.value;
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (!UUID_RE.test(conversationId) || !message || message.length > 4000) {
      return jsonError('Conversa e mensagem válida são obrigatórias (máximo 4000 caracteres).', 400);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    // Apply a platform-wide admin send limit so it also works for a
    // platform admin who does not have a row in public.users.
    const { count: recentMessages, error: rateError } = await admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'admin')
      .gte('created_at', since);
    if (rateError) throw new Error('SUPPORT_ADMIN_RATE_LIMIT_LOOKUP_FAILED');
    if ((recentMessages ?? 0) >= 30) {
      return jsonError('Limite de mensagens atingido. Tenta novamente dentro de um minuto.', 429);
    }

    const { data: conversation, error: conversationError } = await admin
      .from('support_conversations')
      .select('id,customer_user_id,barbershop_id,status')
      .eq('id', conversationId)
      .maybeSingle();
    if (conversationError) throw new Error('SUPPORT_ADMIN_CONVERSATION_LOOKUP_FAILED');
    if (!conversation) return jsonError('Ticket não encontrado.', 404);
    if (conversation.status === 'pending') {
      return jsonError('Aceita o ticket antes de responder. O chat ainda não está ativo.', 409);
    }
    if (conversation.status === 'closed') {
      return jsonError('Este ticket está resolvido. Reabre-o antes de enviar uma resposta.', 409);
    }

    const [customerResult, authCustomerResult, shopResult] = await Promise.all([
      admin
        .from('users')
        .select('id,name_complete,email')
        .eq('id', conversation.customer_user_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(conversation.customer_user_id),
      admin
        .from('barbershops')
        .select('name')
        .eq('id', conversation.barbershop_id)
        .maybeSingle(),
    ]);
    if (customerResult.error || authCustomerResult.error || shopResult.error) {
      throw new Error('SUPPORT_ADMIN_RECIPIENT_LOOKUP_FAILED');
    }

    const customerEmail = authCustomerResult.data.user?.email || customerResult.data?.email;
    if (!customerEmail) return jsonError('A conta do membro não tem um email disponível.', 409);

    const planAssignment = await admin
      .from('barbershop_plan_assignments')
      .select('plan,expires_at')
      .eq('barbershop_id', conversation.barbershop_id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();
    const subscription = await admin
      .from('subscriptions')
      .select('plan,plan_override,status')
      .eq('barbershop_id', conversation.barbershop_id)
      .maybeSingle();
    if (planAssignment.error || subscription.error) {
      throw new Error('SUPPORT_ADMIN_PLAN_LOOKUP_FAILED');
    }

    let plan: SupportPlan = 'free';
    if (planAssignment.data?.plan === 'pro' || planAssignment.data?.plan === 'enterprise') {
      plan = planAssignment.data.plan;
    } else if (subscription.data?.plan_override === 'pro' || subscription.data?.plan_override === 'enterprise') {
      plan = subscription.data.plan_override;
    } else if (
      (subscription.data?.status === 'active' || subscription.data?.status === 'trialing') &&
      (subscription.data?.plan === 'pro' || subscription.data?.plan === 'enterprise')
    ) {
      plan = subscription.data.plan;
    }

    await admin
      .from('support_conversations')
      .update({ plan, priority: supportPriority(plan) })
      .eq('id', conversation.id);

    const rpc = await admin.rpc('support_send_message', {
      p_conversation_id: conversation.id,
      p_sender_type: 'admin',
      p_sender_user_id: senderUserId,
      p_body: message,
      p_recipient_email: customerEmail,
      p_recipient_name: customerResult.data?.name_complete || customerEmail,
    });
    if (rpc.error) {
      console.error('[SUPPORT_ADMIN_SEND_MESSAGE_FAILED]', rpc.error.code ?? 'UNKNOWN');
      return jsonError('Não foi possível enviar a resposta.', 500);
    }

    const result = rpc.data as { message_id?: string; notification_id?: string | null } | null;
    if (!result?.message_id) throw new Error('SUPPORT_ADMIN_MESSAGE_RPC_INVALID_RESULT');
    if (result.notification_id) {
      await deliverSupportEmailNotification(admin, result.notification_id);
    }

    const { data: savedMessage, error: savedMessageError } = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
      .eq('id', result.message_id)
      .single();
    if (savedMessageError || !savedMessage) throw new Error('SUPPORT_ADMIN_SENT_MESSAGE_LOOKUP_FAILED');

    return NextResponse.json(
      { ok: true, message: savedMessage, conversationId: conversation.id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return jsonError('Não encontrado.', 404);
    }
    console.error('[SUPPORT_ADMIN_POST_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível enviar a resposta.', 500);
  }
}

async function PATCH__unobserved(request: Request) {
  if (!isTrustedSupportOrigin(request)) {
    return jsonError('Pedido de origem não autorizado.', 403);
  }

  try {
    const { admin, user } = await requirePlatformAdmin();
    const bodyResult = await readJsonObject(request, {
      maxBytes: 2 * 1024,
      allowedKeys: ['conversationId', 'action', 'status'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const payload = bodyResult.value;
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId.trim() : '';
    const action = typeof payload.action === 'string' ? payload.action : '';

    if (!UUID_RE.test(conversationId)) return jsonError('ID da conversa inválido.', 400);

    const { data: conversation, error: lookupError } = await admin
      .from('support_conversations')
      .select('id,status,accepted_at')
      .eq('id', conversationId)
      .maybeSingle();
    if (lookupError) throw new Error('SUPPORT_ADMIN_CONVERSATION_LOOKUP_FAILED');
    if (!conversation) return jsonError('Ticket não encontrado.', 404);

    if (action === 'accept') {
      if (conversation.status !== 'pending') {
        return jsonError('Este ticket já foi aceite ou deixou de estar pendente.', 409);
      }
      const acceptedAt = new Date().toISOString();
      const { data: accepted, error } = await admin
        .from('support_conversations')
        .update({
          status: 'open',
          accepted_at: acceptedAt,
          accepted_by: user.id,
          updated_at: acceptedAt,
        })
        .eq('id', conversationId)
        .eq('status', 'pending')
        .select('id,status,accepted_at,accepted_by')
        .maybeSingle();
      if (error) throw new Error('SUPPORT_ADMIN_TICKET_ACCEPT_FAILED');
      if (!accepted) return jsonError('Outro pedido já alterou este ticket. Atualiza a caixa de entrada.', 409);
      return NextResponse.json({ ok: true, ticket: accepted }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'read') {
      const { error } = await admin
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'customer')
        .is('read_at', null);
      if (error) throw new Error('SUPPORT_ADMIN_MARK_READ_FAILED');
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (action === 'status') {
      const status = payload?.status as SupportStatus;
      if (!STATUSES.has(status)) return jsonError('Estado inválido.', 400);
      const { error } = await admin
        .from('support_conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      if (error) throw new Error('SUPPORT_ADMIN_STATUS_UPDATE_FAILED');
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return jsonError('Ação não suportada.', 400);
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return jsonError('Não encontrado.', 404);
    }
    console.error('[SUPPORT_ADMIN_PATCH_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível atualizar a conversa.', 500);
  }
}

export const GET = withApiObservability('/api/silentra-admin/support', GET__unobserved);
export const POST = withApiObservability('/api/silentra-admin/support', POST__unobserved);
export const PATCH = withApiObservability('/api/silentra-admin/support', PATCH__unobserved);
