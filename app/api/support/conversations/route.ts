import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  deliverSupportEmailNotification,
  getEffectiveSupportPlan,
  getPlatformSupportEmail,
  isTrustedSupportOrigin,
  supportPriority,
} from '@/services/support/support-chat.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 4000;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function getCustomerContext() {
  const session = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await session.auth.getUser();
  if (authError || !user) return { error: 'NOT_AUTHENTICATED' as const };

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id,role,barbershop_id,name_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error('SUPPORT_PROFILE_LOOKUP_FAILED');
  if (!profile || profile.role !== 'owner' || !profile.barbershop_id) {
    return { error: 'OWNER_ACCOUNT_REQUIRED' as const };
  }
  if (!user.email) return { error: 'VERIFIED_EMAIL_REQUIRED' as const };

  const { data: shop, error: shopError } = await admin
    .from('barbershops')
    .select('id,name')
    .eq('id', profile.barbershop_id)
    .maybeSingle();
  if (shopError || !shop) throw new Error('SUPPORT_BARBERSHOP_LOOKUP_FAILED');

  return { admin, user, profile, shop };
}

export async function GET() {
  try {
    const context = await getCustomerContext();
    if ('error' in context) {
      const status =
        context.error === 'NOT_AUTHENTICATED' ? 401 :
        context.error === 'VERIFIED_EMAIL_REQUIRED' ? 403 : 403;
      return jsonError(
        context.error === 'OWNER_ACCOUNT_REQUIRED'
          ? 'O chat de suporte está disponível para contas proprietárias de uma barbearia.'
          : context.error === 'VERIFIED_EMAIL_REQUIRED'
            ? 'A tua conta precisa de um email válido para usar o suporte.'
            : 'Inicia sessão para aceder ao suporte.',
        status,
      );
    }

    const { admin, user, profile, shop } = context;
    const { data: conversation, error } = await admin
      .from('support_conversations')
      .select('id,barbershop_id,customer_user_id,subject,status,plan,priority,last_message_at,last_message_preview,created_at,updated_at')
      .eq('barbershop_id', shop.id)
      .maybeSingle();

    if (error) throw new Error('SUPPORT_CONVERSATION_LOOKUP_FAILED');
    if (!conversation) {
      return NextResponse.json(
        { ok: true, conversation: null, messages: [], unreadCount: 0 },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const effectivePlan = await getEffectiveSupportPlan(admin, shop.id);
    if (
      conversation.customer_user_id !== user.id ||
      conversation.plan !== effectivePlan ||
      conversation.priority !== supportPriority(effectivePlan)
    ) {
      const { error: syncError } = await admin
        .from('support_conversations')
        .update({
          customer_user_id: user.id,
          plan: effectivePlan,
          priority: supportPriority(effectivePlan),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);
      if (syncError) throw new Error('SUPPORT_CONVERSATION_SYNC_FAILED');
    }

    const { error: readError } = await admin
      .from('support_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('sender_type', 'admin')
      .is('read_at', null);
    if (readError) throw new Error('SUPPORT_MARK_READ_FAILED');

    const { data: messages, error: messagesError } = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (messagesError) throw new Error('SUPPORT_MESSAGES_LOOKUP_FAILED');

    const { count: unreadCount, error: unreadError } = await admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversation.id)
      .eq('sender_type', 'admin')
      .is('read_at', null);
    if (unreadError) throw new Error('SUPPORT_UNREAD_COUNT_FAILED');

    return NextResponse.json(
      {
        ok: true,
        conversation: {
          ...conversation,
          customer_user_id: user.id,
          plan: effectivePlan,
          priority: supportPriority(effectivePlan),
          shop_name: shop.name,
          customer_name: profile.name_complete || user.email,
        },
        messages: messages ?? [],
        unreadCount: unreadCount ?? 0,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[SUPPORT_CUSTOMER_GET_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível carregar a conversa de suporte.', 500);
  }
}

export async function POST(request: Request) {
  if (!isTrustedSupportOrigin(request)) {
    return jsonError('Pedido de origem não autorizado.', 403);
  }

  try {
    const context = await getCustomerContext();
    if ('error' in context) {
      if (context.error === 'NOT_AUTHENTICATED') {
        return jsonError('Inicia sessão para enviar uma mensagem.', 401);
      }
      return jsonError(
        context.error === 'VERIFIED_EMAIL_REQUIRED'
          ? 'A tua conta precisa de um email válido para usar o suporte.'
          : 'O chat de suporte está disponível para contas proprietárias de uma barbearia.',
        403,
      );
    }

    const { admin, user, profile, shop } = context;
    const payload = (await request.json().catch(() => null)) as
      | { message?: unknown }
      | null;
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return jsonError('A mensagem tem de ter entre 1 e 4000 caracteres.', 400);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recentMessages, error: rateError } = await admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', user.id)
      .eq('sender_type', 'customer')
      .gte('created_at', since);
    if (rateError) throw new Error('SUPPORT_RATE_LIMIT_LOOKUP_FAILED');
    if ((recentMessages ?? 0) >= 15) {
      return jsonError('Enviaste muitas mensagens num curto espaço de tempo. Tenta novamente dentro de um minuto.', 429);
    }

    const plan = await getEffectiveSupportPlan(admin, shop.id);
    let { data: conversation, error: conversationError } = await admin
      .from('support_conversations')
      .select('id,barbershop_id,customer_user_id,status')
      .eq('barbershop_id', shop.id)
      .maybeSingle();

    if (conversationError) throw new Error('SUPPORT_CONVERSATION_LOOKUP_FAILED');

    if (!conversation) {
      const created = await admin
        .from('support_conversations')
        .insert({
          barbershop_id: shop.id,
          customer_user_id: user.id,
          subject: 'Suporte Silentra',
          status: 'open',
          plan,
          priority: supportPriority(plan),
        })
        .select('id,barbershop_id,customer_user_id,status')
        .single();

      if (created.error?.code === '23505') {
        const existing = await admin
          .from('support_conversations')
          .select('id,barbershop_id,customer_user_id,status')
          .eq('barbershop_id', shop.id)
          .single();
        conversation = existing.data;
        conversationError = existing.error;
      } else {
        conversation = created.data;
        conversationError = created.error;
      }
    }
    if (conversationError || !conversation) {
      throw new Error('SUPPORT_CONVERSATION_CREATE_FAILED');
    }

    const { error: syncError } = await admin
      .from('support_conversations')
      .update({
        customer_user_id: user.id,
        plan,
        priority: supportPriority(plan),
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);
    if (syncError) throw new Error('SUPPORT_CONVERSATION_SYNC_FAILED');

    const platformEmail = await getPlatformSupportEmail(admin);
    if (!platformEmail) {
      return jsonError('O email de suporte da Silentra não está configurado. A equipa foi avisada do problema.', 503);
    }

    const rpc = await admin.rpc('support_send_message', {
      p_conversation_id: conversation.id,
      p_sender_type: 'customer',
      p_sender_user_id: user.id,
      p_body: message,
      p_recipient_email: platformEmail,
      p_recipient_name: 'Silentra Support',
    });

    if (rpc.error) {
      console.error('[SUPPORT_SEND_CUSTOMER_MESSAGE_FAILED]', rpc.error.code ?? 'UNKNOWN');
      return jsonError('Não foi possível enviar a mensagem. Tenta novamente.', 500);
    }

    const result = rpc.data as { message_id?: string; notification_id?: string | null } | null;
    if (!result?.message_id) throw new Error('SUPPORT_MESSAGE_RPC_INVALID_RESULT');
    if (result.notification_id) {
      await deliverSupportEmailNotification(admin, result.notification_id);
    }

    const { data: savedMessage, error: savedMessageError } = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
      .eq('id', result.message_id)
      .single();
    if (savedMessageError || !savedMessage) throw new Error('SUPPORT_SENT_MESSAGE_LOOKUP_FAILED');

    return NextResponse.json(
      { ok: true, conversationId: conversation.id, message: savedMessage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[SUPPORT_CUSTOMER_POST_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível enviar a mensagem de suporte.', 500);
  }
}
