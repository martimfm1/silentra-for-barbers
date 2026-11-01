'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock3,
  FilePlus2,
  Headset,
  LockKeyhole,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Ticket,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type SupportPlan = 'free' | 'pro' | 'enterprise';
type FeedbackCategory = 'problem' | 'suggestion' | 'feedback';
type SupportStatus =
  'pending' | 'open' | 'waiting_customer' | 'closed' | 'closed_unresolved';
type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'admin';
  sender_user_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};
type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: SupportStatus;
  plan: SupportPlan;
  priority: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  accepted_at: string | null;
  created_at: string;
  shop_name?: string;
};

type SupportPayload = {
  ok?: boolean;
  error?: string;
  plan?: SupportPlan;
  tickets?: SupportTicket[];
  ticket?: SupportTicket | null;
  selectedTicketId?: string | null;
  messages?: SupportMessage[];
  activeTicketCount?: number;
  maxOpenTickets?: number;
};

const planDescriptions: Record<
  'pt' | 'en',
  Record<SupportPlan, { title: string; detail: string }>
> = {
  pt: {
    free: {
      title: 'Suporte standard',
      detail: 'A equipa responde assim que possível.',
    },
    pro: {
      title: 'Suporte prioritário',
      detail: 'Os teus tickets têm prioridade sobre o plano Free.',
    },
    enterprise: {
      title: 'Suporte Enterprise',
      detail: 'Prioridade máxima na fila de suporte.',
    },
  },
  en: {
    free: {
      title: 'Standard support',
      detail: 'The team will reply as soon as possible.',
    },
    pro: {
      title: 'Priority support',
      detail: 'Your tickets take priority over the Free plan.',
    },
    enterprise: {
      title: 'Enterprise support',
      detail: 'Highest priority in the support queue.',
    },
  },
};

function formatDate(value: string | null, locale: 'pt' | 'en') {
  if (!value) return locale === 'pt' ? 'Sem mensagens' : 'No messages';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: SupportStatus, pt: boolean) {
  if (status === 'pending')
    return pt ? 'À espera de aceitação' : 'Awaiting acceptance';
  if (status === 'waiting_customer')
    return pt ? 'À espera da tua resposta' : 'Waiting for your reply';
  if (status === 'closed') return pt ? 'Resolvido' : 'Resolved';
  if (status === 'closed_unresolved')
    return pt ? 'Fechado sem resolução' : 'Closed without resolution';
  return pt ? 'Chat ativo' : 'Chat active';
}

function statusTone(status: SupportStatus) {
  if (status === 'pending')
    return 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300';
  if (status === 'closed' || status === 'closed_unresolved')
    return 'border-border bg-muted text-muted-foreground';
  if (status === 'waiting_customer')
    return 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300';
  return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
}

export default function SupportPage() {
  const { locale } = useLanguage();
  const pt = locale === 'pt';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [accountPlan, setAccountPlan] = useState<SupportPlan>('free');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [subjectDraft, setSubjectDraft] = useState('');
  const [ticketCategory, setTicketCategory] =
    useState<FeedbackCategory>('problem');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (ticketId = selectedTicketId, quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const query = ticketId
          ? `?ticketId=${encodeURIComponent(ticketId)}`
          : '';
        const response = await fetch(`/api/support/conversations${query}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as SupportPayload;
        if (!response.ok || !payload.ok || !Array.isArray(payload.tickets)) {
          throw new Error(
            payload.error ||
              (pt
                ? 'Não foi possível carregar os tickets.'
                : 'Could not load support tickets.'),
          );
        }

        const nextTickets = payload.tickets;
        setTickets(nextTickets);
        setAccountPlan(payload.plan ?? 'free');
        setSelectedTicket(
          payload.ticket ??
            nextTickets.find((ticket) => ticket.id === ticketId) ??
            null,
        );
        setMessages(payload.messages ?? []);
        setError(null);

        if (!ticketId && nextTickets.length) {
          setSelectedTicketId((current) =>
            current && nextTickets.some((ticket) => ticket.id === current)
              ? current
              : nextTickets[0].id,
          );
        } else if (
          ticketId &&
          !nextTickets.some((ticket) => ticket.id === ticketId)
        ) {
          setSelectedTicketId(nextTickets[0]?.id ?? null);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : pt
              ? 'Erro inesperado.'
              : 'Unexpected error.',
        );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [selectedTicketId, pt],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('ticketId') ?? params.get('conversationId');
    if (ticketId) setSelectedTicketId(ticketId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Schedule the next poll only after the previous request has settled.
    // Fixed setInterval caused overlapping requests whenever the API took >15s.
    const scheduleNextPoll = () => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          await refresh(selectedTicketId, true);
        }
        if (!cancelled) scheduleNextPoll();
      }, 30000);
    };

    void refresh(selectedTicketId, false).finally(() => {
      if (!cancelled) scheduleNextPoll();
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh, selectedTicketId]);

  const createTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subjectPrefix =
      ticketCategory === 'problem'
        ? pt
          ? '[Problema]'
          : '[Issue]'
        : ticketCategory === 'suggestion'
          ? pt
            ? '[Sugestão]'
            : '[Suggestion]'
          : pt
            ? '[Feedback]'
            : '[Feedback]';
    const subject = `${subjectPrefix} ${subjectDraft.trim()}`;
    const description = descriptionDraft.trim();
    if (!canCreateTicket) {
      toast.error(
        pt
          ? 'Atingiste o limite de tickets abertos do teu plano.'
          : 'You have reached your plan limit for open tickets.',
      );
      return;
    }
    if (
      subjectDraft.trim().length < 3 ||
      subject.length > 120 ||
      description.length < 10 ||
      description.length > 4000 ||
      creating
    )
      return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_ticket', subject, description }),
      });
      const payload = (await response.json()) as SupportPayload;
      if (!response.ok || !payload.ok || !payload.ticket) {
        throw new Error(
          payload.error ||
            (pt
              ? 'Não foi possível criar o ticket.'
              : 'Could not create the ticket.'),
        );
      }
      setSubjectDraft('');
      setDescriptionDraft('');
      setTicketCategory('problem');
      setCreateTicketOpen(false);
      setSelectedTicketId(payload.ticket.id);
      toast.success(
        pt
          ? 'Ticket enviado. O chat ficará disponível após a aceitação.'
          : 'Ticket submitted. The chat will be available after acceptance.',
      );
      await refresh(payload.ticket.id, true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : pt
            ? 'Não foi possível criar o ticket.'
            : 'Could not create the ticket.';
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (
      !selectedTicket ||
      selectedTicket.status === 'pending' ||
      selectedTicket.status === 'closed' ||
      selectedTicket.status === 'closed_unresolved' ||
      !message ||
      sending
    )
      return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          ticketId: selectedTicket.id,
          message,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: SupportMessage;
      };
      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error(
          payload.error ||
            (pt
              ? 'Não foi possível enviar a mensagem.'
              : 'Could not send the message.'),
        );
      }
      setDraft('');
      setMessages((current) => [...current, payload.message!]);
      toast.success(
        pt
          ? 'Mensagem enviada à equipa Silentra.'
          : 'Message sent to the Silentra team.',
      );
      await refresh(selectedTicket.id, true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : pt
            ? 'Não foi possível enviar a mensagem.'
            : 'Could not send the message.';
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const plan = selectedTicket?.plan ?? accountPlan;
  const planInfo = planDescriptions[locale][plan];
  const maxOpenTickets =
    accountPlan === 'enterprise' ? 10 : accountPlan === 'pro' ? 2 : 1;
  const activeTickets = tickets.filter((ticket) =>
    ['pending', 'open', 'waiting_customer'].includes(ticket.status),
  );
  const ticketHistory = tickets.filter((ticket) =>
    ['closed', 'closed_unresolved'].includes(ticket.status),
  );
  const canCreateTicket = activeTickets.length < maxOpenTickets;
  const renderTicketButton = (ticket: SupportTicket) => (
    <button
      key={ticket.id}
      type="button"
      onClick={() => {
        setSelectedTicketId(ticket.id);
        setError(null);
      }}
      className={`block w-full border-b border-border/70 p-4 text-left transition hover:bg-accent/50 ${selectedTicketId === ticket.id ? 'bg-accent/60' : ''}`}
    >
      <p className="break-words text-sm font-semibold">{ticket.subject}</p>
      <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
        {ticket.last_message_preview || ticket.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusTone(ticket.status)}`}
        >
          {statusLabel(ticket.status, pt)}
        </span>
        <time
          className="ml-auto text-[10px] text-muted-foreground"
          dateTime={ticket.last_message_at || ticket.created_at}
        >
          {formatDate(ticket.last_message_at || ticket.created_at, locale)}
        </time>
      </div>
    </button>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {pt ? 'Apoio ao membro' : 'Member support'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {pt ? 'Tickets de suporte' : 'Support tickets'}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {pt
                ? 'Cria um ticket para cada assunto ou problema. A equipa Silentra irá analisá-lo e aceitar o pedido antes de abrir o chat.'
                : 'Create a ticket for each issue. The Silentra team will review it and accept the request before opening the chat.'}
            </p>
          </div>
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
              />
              {pt ? 'Atualizar' : 'Refresh'}
            </button>
            <button
              aria-label={
                createTicketOpen
                  ? pt
                    ? 'Cancelar criação de ticket'
                    : 'Cancel ticket creation'
                  : pt
                    ? 'Criar novo ticket'
                    : 'Create new ticket'
              }
              type="button"
              onClick={() => setCreateTicketOpen((value) => !value)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              {createTicketOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Plus className="size-4" />
              )}
              {createTicketOpen
                ? pt
                  ? 'Cancelar'
                  : 'Cancel'
                : pt
                  ? 'Novo ticket'
                  : 'New ticket'}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {pt
                  ? 'Tickets ativos do teu plano'
                  : 'Active tickets on your plan'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeTickets.length}/{maxOpenTickets} ·{' '}
                {pt
                  ? 'Free: 1, Pro: 2, Enterprise: 10 tickets abertos'
                  : 'Free: 1, Pro: 2, Enterprise: 10 open tickets'}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${canCreateTicket ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}
            >
              {canCreateTicket
                ? pt
                  ? 'Vaga disponível'
                  : 'Slot available'
                : pt
                  ? 'Limite atingido'
                  : 'Limit reached'}
            </span>
          </div>
          {!canCreateTicket ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {pt
                ? 'Resolve um ticket ou fecha-o sem resolução para libertar uma vaga.'
                : 'Resolve a ticket or close it without resolution to free a slot.'}
            </p>
          ) : null}
        </section>

        {createTicketOpen ? (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FilePlus2 className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">
                  {pt ? 'Criar um ticket' : 'Create a ticket'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pt
                    ? 'O teu feedback ajuda-nos a tornar a Silentra mais útil no dia a dia da barbearia.'
                    : 'Your feedback helps us make Silentra more useful in your barbershop every day.'}
                </p>
              </div>
            </div>
            <form onSubmit={createTicket} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="support-ticket-category"
                  className="mb-1.5 block text-sm font-medium"
                >
                  {pt ? 'Tipo de feedback' : 'Feedback type'}
                </label>
                <select
                  id="support-ticket-category"
                  value={ticketCategory}
                  onChange={(event) =>
                    setTicketCategory(event.target.value as FeedbackCategory)
                  }
                  disabled={creating}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <option value="problem">
                    {pt ? 'Reportar um problema' : 'Report a problem'}
                  </option>
                  <option value="suggestion">
                    {pt ? 'Sugerir uma melhoria' : 'Suggest an improvement'}
                  </option>
                  <option value="feedback">
                    {pt ? 'Partilhar feedback geral' : 'Share general feedback'}
                  </option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticketCategory === 'problem'
                    ? pt
                      ? 'Indica o que aconteceu e os passos para reproduzir o problema.'
                      : 'Tell us what happened and how to reproduce the problem.'
                    : ticketCategory === 'suggestion'
                      ? pt
                        ? 'Explica como esta melhoria ajudaria no trabalho diário.'
                        : 'Explain how this improvement would help your daily work.'
                      : pt
                        ? 'Partilha a tua experiência, positiva ou negativa.'
                        : 'Share your experience, positive or negative.'}
                </p>
              </div>
              <div>
                <label
                  htmlFor="support-ticket-subject"
                  className="mb-1.5 block text-sm font-medium"
                >
                  {pt ? 'Assunto' : 'Subject'}
                </label>
                <input
                  id="support-ticket-subject"
                  value={subjectDraft}
                  onChange={(event) => setSubjectDraft(event.target.value)}
                  placeholder={
                    pt ? 'Ex.: Problema com a faturação' : 'e.g. Billing issue'
                  }
                  maxLength={100}
                  required
                  minLength={3}
                  disabled={creating}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {subjectDraft.trim().length}/100
                </p>
              </div>
              <div>
                <label
                  htmlFor="support-ticket-description"
                  className="mb-1.5 block text-sm font-medium"
                >
                  {pt ? 'Descreve o problema' : 'Describe the issue'}
                </label>
                <textarea
                  id="support-ticket-description"
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  placeholder={
                    pt
                      ? 'Explica o que aconteceu, o que estavas a tentar fazer e qual foi o resultado esperado…'
                      : 'Explain what happened, what you were trying to do, and what you expected…'
                  }
                  maxLength={4000}
                  minLength={10}
                  rows={4}
                  required
                  disabled={creating}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {descriptionDraft.trim().length}/4000
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  {pt
                    ? 'O ticket fica pendente até ser aceite. Ainda não será possível enviar mensagens no chat.'
                    : 'The ticket remains pending until accepted. Chat messages will not be available yet.'}
                </p>
                <button
                  aria-label={
                    creating
                      ? pt
                        ? 'A submeter ticket'
                        : 'Submitting ticket'
                      : pt
                        ? 'Submeter ticket'
                        : 'Submit ticket'
                  }
                  type="submit"
                  disabled={
                    creating ||
                    !canCreateTicket ||
                    subjectDraft.trim().length < 3 ||
                    subjectDraft.trim().length > 100 ||
                    descriptionDraft.trim().length < 10
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ticket className="size-4" />{' '}
                  {creating
                    ? pt
                      ? 'A criar…'
                      : 'Creating…'
                    : pt
                      ? 'Submeter ticket'
                      : 'Submit ticket'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {error ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="shrink-0 underline"
            >
              {pt ? 'Tentar novamente' : 'Try again'}
            </button>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
          <aside className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <h2 className="font-semibold">
                  {pt ? 'Os teus tickets' : 'Your tickets'}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeTickets.length} {pt ? 'ativo(s)' : 'active'} ·{' '}
                  {ticketHistory.length} {pt ? 'no histórico' : 'in history'}
                </p>
              </div>
              <Ticket className="size-5 text-muted-foreground" />
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {loading && !tickets.length ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {pt ? 'A carregar tickets…' : 'Loading tickets…'}
                </div>
              ) : tickets.length ? (
                <div>
                  {activeTickets.length ? (
                    <section>
                      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                        {pt ? 'Tickets ativos' : 'Active tickets'} ·{' '}
                        {activeTickets.length}/{maxOpenTickets}
                      </div>
                      {activeTickets.map(renderTicketButton)}
                    </section>
                  ) : null}
                  {ticketHistory.length ? (
                    <section>
                      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                        {pt ? 'Histórico' : 'History'} · {ticketHistory.length}
                      </div>
                      {ticketHistory.map(renderTicketButton)}
                    </section>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <FilePlus2 className="size-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    {pt ? 'Ainda não tens tickets' : 'No tickets yet'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {pt
                      ? 'Cria um ticket para cada questão que precises de resolver.'
                      : 'Create a separate ticket for every issue you need help with.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateTicketOpen(true)}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
                  >
                    <Plus className="size-4" />{' '}
                    {pt ? 'Criar ticket' : 'Create ticket'}
                  </button>
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
            {selectedTicket ? (
              <>
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-primary">
                        <Headset className="size-4" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                          {pt ? 'Ticket de suporte' : 'Support ticket'}
                        </span>
                      </div>
                      <h2 className="mt-2 break-words text-lg font-semibold">
                        {selectedTicket.subject}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pt ? 'Criado a' : 'Created'}{' '}
                        {formatDate(selectedTicket.created_at, locale)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(selectedTicket.status)}`}
                    >
                      {statusLabel(selectedTicket.status, pt)}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {pt ? 'Descrição do problema' : 'Issue description'}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {selectedTicket.description}
                    </p>
                  </div>
                </div>

                {selectedTicket.status === 'pending' ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                      <Clock3 className="size-6" />
                    </div>
                    <h3 className="mt-4 font-semibold">
                      {pt ? 'À espera de aceitação' : 'Awaiting acceptance'}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      {pt
                        ? 'A equipa Silentra vai analisar o pedido. O chat e o envio de mensagens serão disponibilizados assim que o ticket for aceite.'
                        : 'The Silentra team will review your request. Chat and messages will become available as soon as the ticket is accepted.'}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                      <LockKeyhole className="size-3.5" />{' '}
                      {pt
                        ? 'Chat ainda não disponível'
                        : 'Chat not available yet'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex min-h-[280px] flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-5">
                      {messages.length ? (
                        messages.map((message) => {
                          const ownMessage = message.sender_type === 'customer';
                          return (
                            <div
                              key={message.id}
                              className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[82%] ${ownMessage ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground'}`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {message.body}
                                </p>
                                <div
                                  className={`mt-2 flex items-center justify-end gap-1.5 text-[10px] ${ownMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                                >
                                  <span>
                                    {ownMessage
                                      ? pt
                                        ? 'Tu'
                                        : 'You'
                                      : pt
                                        ? 'Equipa Silentra'
                                        : 'Silentra team'}
                                  </span>
                                  <span>·</span>
                                  <time dateTime={message.created_at}>
                                    {formatDate(message.created_at, locale)}
                                  </time>
                                  {ownMessage ? (
                                    <Check
                                      className="size-3"
                                      aria-label={
                                        message.read_at
                                          ? pt
                                            ? 'Lida'
                                            : 'Read'
                                          : pt
                                            ? 'Enviada'
                                            : 'Sent'
                                      }
                                    />
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                          <MessageCircle className="size-7 text-muted-foreground" />
                          <p className="mt-3 text-sm font-medium">
                            {pt ? 'Chat iniciado' : 'Chat started'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pt
                              ? 'Podes agora trocar mensagens com a equipa Silentra.'
                              : 'You can now exchange messages with the Silentra team.'}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedTicket.status === 'closed' ||
                    selectedTicket.status === 'closed_unresolved' ? (
                      <div className="border-t border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        {selectedTicket.status === 'closed'
                          ? pt
                            ? 'Este ticket foi resolvido. Cria um novo ticket caso precises de ajuda com outro problema.'
                            : 'This ticket is resolved. Create a new ticket if you need help with a different issue.'
                          : pt
                            ? 'Este ticket foi fechado sem resolução. Cria um novo ticket para continuares a pedir ajuda.'
                            : 'This ticket was closed without resolution. Create a new ticket to continue getting help.'}
                      </div>
                    ) : (
                      <form
                        onSubmit={sendMessage}
                        className="border-t border-border bg-muted/20 p-3 sm:p-4"
                      >
                        <label htmlFor="support-message" className="sr-only">
                          {pt ? 'A tua mensagem' : 'Your message'}
                        </label>
                        <textarea
                          id="support-message"
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          placeholder={
                            pt
                              ? 'Escreve uma mensagem sobre este ticket…'
                              : 'Write a message about this ticket…'
                          }
                          maxLength={4000}
                          rows={3}
                          disabled={sending}
                          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        />
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[11px] leading-5 text-muted-foreground">
                            {pt
                              ? 'Recebes um email quando a equipa enviar uma nova mensagem.'
                              : 'You will receive an email when the team sends a new message.'}
                          </p>
                          <button
                            aria-label={
                              sending
                                ? pt
                                  ? 'A enviar mensagem'
                                  : 'Sending message'
                                : pt
                                  ? 'Enviar mensagem'
                                  : 'Send message'
                            }
                            type="submit"
                            disabled={
                              sending ||
                              !draft.trim() ||
                              draft.trim().length > 4000
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sending
                              ? pt
                                ? 'A enviar…'
                                : 'Sending…'
                              : pt
                                ? 'Enviar mensagem'
                                : 'Send message'}
                            <Send className="size-4" />
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <MessageCircle className="size-6" />
                </div>
                <h2 className="mt-4 font-semibold">
                  {pt ? 'Seleciona um ticket' : 'Select a ticket'}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {pt
                    ? 'Escolhe um pedido à esquerda ou cria um novo ticket para começar.'
                    : 'Choose a ticket on the left or create one to get started.'}
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-5" />
                <h2 className="font-semibold">
                  {pt ? 'Prioridade do teu plano' : 'Your plan priority'}
                </h2>
              </div>
              <p className="mt-4 text-lg font-semibold">{planInfo.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {planInfo.detail}
              </p>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={
                      plan === 'free'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    Free
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Standard
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={
                      plan === 'pro'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    Pro
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pt ? 'Prioritário' : 'Priority'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={
                      plan === 'enterprise'
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    Enterprise
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pt ? 'Prioridade máxima' : 'Highest priority'}
                  </span>
                </div>
              </div>
              <Link
                href="/dashboard/billing"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {pt ? 'Ver planos' : 'View plans'}{' '}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="size-5 text-muted-foreground" />
                <h2 className="font-semibold">
                  {pt ? 'Como funciona' : 'How it works'}
                </h2>
              </div>
              <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-muted-foreground">
                <li>
                  {pt
                    ? 'Cria um ticket por cada assunto ou problema.'
                    : 'Create one ticket for each issue.'}
                </li>
                <li>
                  {pt
                    ? 'A equipa Silentra analisa e aceita o pedido.'
                    : 'The Silentra team reviews and accepts it.'}
                </li>
                <li>
                  {pt
                    ? 'Após a aceitação, o chat fica disponível nesse ticket.'
                    : 'Once accepted, chat becomes available on that ticket.'}
                </li>
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
