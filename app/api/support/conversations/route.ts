import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
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
const MAX_TICKET_SUBJECT_LENGTH = 120;
const MAX_TICKETS_PER_HOUR = 20;
const OPEN_TICKET_LIMITS = { free: 1, pro: 2, enterprise: 10 } as const;
const ACTIVE_TICKET_STATUSES = new Set(['pending', 'open', 'waiting_customer']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function GET__unobserved(request: Request) {
  try {
    const context = await getCustomerContext();
    if ('error' in context) {
      const status = context.error === 'NOT_AUTHENTICATED' ? 401 : 403;
      return jsonError(
        context.error === 'OWNER_ACCOUNT_REQUIRED'
          ? 'O suporte está disponível para contas proprietárias de uma barbearia.'
          : context.error === 'VERIFIED_EMAIL_REQUIRED'
            ? 'A tua conta precisa de um email válido para usar o suporte.'
            : 'Inicia sessão para aceder ao suporte.',
        status,
      );
    }

    const { admin, user, profile, shop } = context;
    const url = new URL(request.url);
    const requestedTicketId = (
      url.searchParams.get('ticketId') ??
      url.searchParams.get('conversationId') ??
      ''
    ).trim();
    if (requestedTicketId && !UUID_RE.test(requestedTicketId)) {
      return jsonError('ID do ticket inválido.', 400);
    }

    const ticketSelection = 'id,barbershop_id,customer_user_id,subject,description,status,plan,priority,last_message_at,last_message_preview,accepted_at,accepted_by,created_at,updated_at';
    const [activeResult, historyResult] = await Promise.all([
      admin
        .from('support_conversations')
        .select(ticketSelection)
        .eq('barbershop_id', shop.id)
        .in('status', ['pending', 'open', 'waiting_customer'])
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('support_conversations')
        .select(ticketSelection)
        .eq('barbershop_id', shop.id)
        .in('status', ['closed', 'closed_unresolved'])
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (activeResult.error || historyResult.error) {
      throw new Error('SUPPORT_TICKETS_LOOKUP_FAILED');
    }
    // Always retain active tickets even when the member has a long history.
    const ticketRows = [
      ...(activeResult.data ?? []),
      ...(historyResult.data ?? []),
    ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    const effectivePlan = await getEffectiveSupportPlan(admin, shop.id);
    const tickets = (ticketRows ?? []).map((ticket) => ({
      ...ticket,
      customer_user_id: user.id,
      plan: effectivePlan,
      priority: supportPriority(effectivePlan),
      shop_name: shop.name,
      customer_name: profile.name_complete || user.email,
    }));

    const staleTickets = (ticketRows ?? []).filter(
      (ticket) =>
        ticket.customer_user_id !== user.id ||
        ticket.plan !== effectivePlan ||
        ticket.priority !== supportPriority(effectivePlan),
    );
    if (staleTickets.length) {
      const syncResults = await Promise.all(
        staleTickets.map((ticket) =>
          admin
            .from('support_conversations')
            .update({
              customer_user_id: user.id,
              plan: effectivePlan,
              priority: supportPriority(effectivePlan),
            })
            .eq('id', ticket.id)
            .eq('barbershop_id', shop.id),
        ),
      );
      if (syncResults.some((result) => result.error)) {
        throw new Error('SUPPORT_TICKET_SYNC_FAILED');
      }
    }

    const selectedTicket = requestedTicketId
      ? tickets.find((ticket) => ticket.id === requestedTicketId) ?? null
      : null;
    if (requestedTicketId && !selectedTicket) {
      return jsonError('Ticket não encontrado.', 404);
    }

    let messages: Array<Record<string, unknown>> = [];
    let unreadCount = 0;
    if (selectedTicket && selectedTicket.status !== 'pending') {
      const { error: readError } = await admin
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', selectedTicket.id)
        .eq('sender_type', 'admin')
        .is('read_at', null);
      if (readError) throw new Error('SUPPORT_MARK_READ_FAILED');

      const { data: messageRows, error: messagesError } = await admin
        .from('support_messages')
        .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
        .eq('conversation_id', selectedTicket.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (messagesError) throw new Error('SUPPORT_MESSAGES_LOOKUP_FAILED');
      messages = (messageRows ?? []).reverse();

      const { count, error: unreadError } = await admin
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', selectedTicket.id)
        .eq('sender_type', 'admin')
        .is('read_at', null);
      if (unreadError) throw new Error('SUPPORT_UNREAD_COUNT_FAILED');
      unreadCount = count ?? 0;
    }

    return NextResponse.json(
      {
        ok: true,
        plan: effectivePlan,
        tickets,
        ticket: selectedTicket,
        selectedTicketId: selectedTicket?.id ?? null,
        messages,
        unreadCount,
        activeTicketCount: (ticketRows ?? []).filter((ticket) => ACTIVE_TICKET_STATUSES.has(ticket.status)).length,
        maxOpenTickets: OPEN_TICKET_LIMITS[effectivePlan],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[SUPPORT_CUSTOMER_GET_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível carregar os tickets de suporte.', 500);
  }
}

async function POST__unobserved(request: Request) {
  if (!isTrustedSupportOrigin(request)) {
    return jsonError('Pedido de origem não autorizado.', 403);
  }

  try {
    const context = await getCustomerContext();
    if ('error' in context) {
      if (context.error === 'NOT_AUTHENTICATED') {
        return jsonError('Inicia sessão para usar o suporte.', 401);
      }
      return jsonError(
        context.error === 'VERIFIED_EMAIL_REQUIRED'
          ? 'A tua conta precisa de um email válido para usar o suporte.'
          : 'O suporte está disponível para contas proprietárias de uma barbearia.',
        403,
      );
    }

    const { admin, user, shop } = context;
    const bodyResult = await readJsonObject(request, {
      maxBytes: 10 * 1024,
      allowedKeys: ['action', 'ticketId', 'subject', 'description', 'message'],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const payload = bodyResult.value;
    const action = typeof payload.action === 'string' ? payload.action : '';

    if (action === 'create_ticket') {
      const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
      const description = typeof payload.description === 'string' ? payload.description.trim() : '';
      if (
        subject.length < 3 ||
        subject.length > MAX_TICKET_SUBJECT_LENGTH ||
        description.length < 10 ||
        description.length > MAX_MESSAGE_LENGTH
      ) {
        return jsonError('Indica um assunto (3 a 120 caracteres) e descreve o problema (10 a 4000 caracteres).', 400);
      }

      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const { count, error: rateError } = await admin
        .from('support_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('barbershop_id', shop.id)
        .gte('created_at', since);
      if (rateError) throw new Error('SUPPORT_TICKET_RATE_LIMIT_LOOKUP_FAILED');
      if ((count ?? 0) >= MAX_TICKETS_PER_HOUR) {
        return jsonError('Atingiste o limite de 20 tickets por hora. Tenta novamente mais tarde.', 429);
      }

      const plan = await getEffectiveSupportPlan(admin, shop.id);
      const { data: ticket, error: createError } = await admin
        .from('support_conversations')
        .insert({
          barbershop_id: shop.id,
          customer_user_id: user.id,
          subject,
          description,
          status: 'pending',
          plan,
          priority: supportPriority(plan),
        })
        .select('id,barbershop_id,customer_user_id,subject,description,status,plan,priority,last_message_at,last_message_preview,accepted_at,accepted_by,created_at,updated_at')
        .single();

      if (createError || !ticket) {
        if (createError?.message?.includes('SUPPORT_TICKET_LIMIT_REACHED')) {
          const maxOpenTickets = OPEN_TICKET_LIMITS[plan];
          return jsonError(
            `O teu plano permite ${maxOpenTickets} ticket(s) aberto(s) ao mesmo tempo. Resolve ou fecha um ticket antes de criares outro.`,
            409,
          );
        }
        console.error('[SUPPORT_TICKET_CREATE_FAILED]', createError?.code ?? 'UNKNOWN');
        return jsonError('Não foi possível criar o ticket. Tenta novamente.', 500);
      }

      return NextResponse.json(
        {
          ok: true,
          ticket: {
            ...ticket,
            shop_name: shop.name,
            customer_name: context.profile.name_complete || user.email,
          },
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (action !== 'message') {
      return jsonError('Ação de suporte inválida.', 400);
    }

    const ticketId = typeof payload.ticketId === 'string' ? payload.ticketId.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!UUID_RE.test(ticketId) || !message || message.length > MAX_MESSAGE_LENGTH) {
      return jsonError('Ticket e mensagem válidos são obrigatórios (máximo 4000 caracteres).', 400);
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
      return jsonError('Enviaste demasiadas mensagens num minuto. Tenta novamente dentro de um minuto.', 429);
    }

    const { data: ticket, error: ticketError } = await admin
      .from('support_conversations')
      .select('id,customer_user_id,status')
      .eq('id', ticketId)
      .eq('barbershop_id', shop.id)
      .maybeSingle();
    if (ticketError) throw new Error('SUPPORT_TICKET_LOOKUP_FAILED');
    if (!ticket) return jsonError('Ticket não encontrado.', 404);
    if (ticket.status === 'pending') {
      return jsonError('O ticket ainda aguarda aceitação. O chat ficará disponível depois de ser aceite.', 409);
    }
    if (ticket.status === 'closed' || ticket.status === 'closed_unresolved') {
      return jsonError('Este ticket está fechado. Cria um novo ticket para outro problema.', 409);
    }

    const plan = await getEffectiveSupportPlan(admin, shop.id);
    const { error: syncError } = await admin
      .from('support_conversations')
      .update({
        customer_user_id: user.id,
        plan,
        priority: supportPriority(plan),
      })
      .eq('id', ticket.id)
      .eq('barbershop_id', shop.id);
    if (syncError) throw new Error('SUPPORT_TICKET_SYNC_FAILED');

    const platformEmail = await getPlatformSupportEmail(admin);
    if (!platformEmail) {
      return jsonError('O email de suporte da Silentra não está configurado.', 503);
    }

    const rpc = await admin.rpc('support_send_message', {
      p_conversation_id: ticket.id,
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
    if (result.notification_id) await deliverSupportEmailNotification(admin, result.notification_id);

    const { data: savedMessage, error: savedMessageError } = await admin
      .from('support_messages')
      .select('id,conversation_id,sender_type,sender_user_id,body,created_at,read_at')
      .eq('id', result.message_id)
      .single();
    if (savedMessageError || !savedMessage) throw new Error('SUPPORT_SENT_MESSAGE_LOOKUP_FAILED');

    return NextResponse.json(
      { ok: true, ticketId: ticket.id, conversationId: ticket.id, message: savedMessage },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[SUPPORT_CUSTOMER_POST_FAILED]', error instanceof Error ? error.name : 'UNKNOWN');
    return jsonError('Não foi possível processar o pedido de suporte.', 500);
  }
}

export const GET = withApiObservability('/api/support/conversations', GET__unobserved);
export const POST = withApiObservability('/api/support/conversations', POST__unobserved);
