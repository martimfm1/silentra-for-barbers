'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCheck,
  CircleDot,
  Clock3,
  Inbox,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

type Plan = 'free' | 'pro' | 'enterprise';
type Status = 'pending' | 'open' | 'waiting_customer' | 'closed' | 'closed_unresolved';
type Message = {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'admin';
  sender_user_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};
type Conversation = {
  id: string;
  barbershop_id: string;
  customer_user_id: string;
  subject: string;
  description: string;
  accepted_at: string | null;
  accepted_by?: string | null;
  status: Status;
  plan: Plan;
  priority: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  unreadCount: number;
  customer: { id: string; name: string; email: string | null };
  barbershop: { id: string; name: string; slug: string | null };
};
type Payload = {
  ok?: boolean;
  error?: string;
  conversations?: Conversation[];
  messages?: Message[];
  totalUnread?: number;
  message?: Message;
};

const planRank: Record<Plan, number> = { free: 1, pro: 2, enterprise: 3 };

const planNames: Record<Plan, string> = {
  free: 'Free · Standard',
  pro: 'Pro · Prioritário',
  enterprise: 'Enterprise · Máximo',
};

const statusNames: Record<Status, string> = {
  pending: 'Pendente · aguarda aceitação',
  open: 'Chat ativo',
  waiting_customer: 'À espera do membro',
  closed: 'Resolvida',
  closed_unresolved: 'Fechado sem resolução',
};

function formatDate(value: string | null) {
  if (!value) return 'Sem mensagens';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function planTone(plan: Plan) {
  if (plan === 'enterprise') return 'border-violet-400/25 bg-violet-400/10 text-violet-200';
  if (plan === 'pro') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  return 'border-white/10 bg-white/[0.04] text-zinc-400';
}

export default function SupportInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | Status>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (id = selectedId, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const queryString = id ? `?conversationId=${encodeURIComponent(id)}` : '';
      const response = await fetch(`/api/silentra-admin/support${queryString}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.conversations)) {
        throw new Error(payload.error || 'Não foi possível carregar o chat.');
      }
      setConversations(payload.conversations);
      if (id) setMessages(payload.messages ?? []);
      setError(null);

      if (!id && payload.conversations.length) {
        const first = payload.conversations.find((item) => item.unreadCount > 0) ?? payload.conversations[0];
        setSelectedId((current) => current ?? first.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o chat.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    const requestedConversation = new URLSearchParams(window.location.search).get('conversationId');
    if (requestedConversation) setSelectedId(requestedConversation);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Avoid piling up inbox requests if Supabase/Auth has a slow response.
    const scheduleNextPoll = () => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          await load(selectedId, true);
        }
        if (!cancelled) scheduleNextPoll();
      }, 30000);
    };

    void load(selectedId, false).finally(() => {
      if (!cancelled) scheduleNextPoll();
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [load, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const markRead = async () => {
      try {
        await fetch('/api/silentra-admin/support', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'read', conversationId: selectedId }),
        });
        await load(selectedId, true);
      } catch {
        // The next refresh will reconcile unread counts.
      }
    };
    void markRead();
  }, [selectedId, load]);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;

  const visibleConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesQuery = !normalizedQuery || [
        conversation.customer.name,
        conversation.customer.email ?? '',
        conversation.barbershop.name,
        conversation.subject,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unread'
          ? conversation.unreadCount > 0
          : conversation.status === statusFilter);
      return matchesQuery && matchesStatus;
    }).sort((a, b) =>
      Number(b.status === 'pending') - Number(a.status === 'pending') ||
      planRank[b.plan] - planRank[a.plan] ||
      b.unreadCount - a.unreadCount ||
      (Date.parse(b.last_message_at ?? b.created_at) - Date.parse(a.last_message_at ?? a.created_at)),
    );
  }, [conversations, query, statusFilter]);

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!selectedId || !message || sending) return;

    setSending(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/silentra-admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedId, message }),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error(payload.error || 'Não foi possível enviar a resposta.');
      }
      setMessages((current) => [...current, payload.message!]);
      setDraft('');
      setNotice('Resposta enviada. O membro recebe um email quando tiver uma mensagem por ler.');
      await load(selectedId, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: Status) => {
    if (!selectedId || updatingStatus || selected?.status === status) return;
    setUpdatingStatus(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/silentra-admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', conversationId: selectedId, status }),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Não foi possível atualizar o estado.');
      setNotice(`Estado alterado para “${statusNames[status]}”.`);
      await load(selectedId, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar o estado.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const acceptTicket = async () => {
    if (!selectedId || updatingStatus || selected?.status !== 'pending') return;
    setUpdatingStatus(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/silentra-admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', conversationId: selectedId }),
      });
      const payload = (await response.json()) as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Não foi possível aceitar o ticket.');
      setNotice('Ticket aceite. O chat ficou ativo para o membro.');
      await load(selectedId, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aceitar o ticket.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <MessageCircle className="size-5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Tickets · Suporte</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Tickets de suporte</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Revê cada pedido, aceita-o para ativar o chat e mantém assuntos diferentes em tickets separados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      {notice ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3 text-sm text-emerald-200">{notice}</div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{error}</span>
        </div>
      ) : null}

      <div className="grid min-h-[640px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d10] lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="flex min-h-[320px] flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-3">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-zinc-500">
              <Search className="size-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Procurar membro ou barbearia"
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              {query ? <button type="button" onClick={() => setQuery('')} aria-label="Limpar pesquisa"><X className="size-3.5" /></button> : null}
            </label>
            <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([
                ['all', 'Todas'],
                ['unread', 'Por ler'],
                ['pending', 'Pendentes'],
                ['open', 'Chat ativo'],
                ['waiting_customer', 'À espera'],
                ['closed', 'Resolvidas'],
                ['closed_unresolved', 'Fechadas sem resolução'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${statusFilter === value ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-white/8 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && !conversations.length ? (
              <div className="p-6 text-center text-sm text-zinc-500">A carregar conversas…</div>
            ) : visibleConversations.length ? visibleConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setNotice(null);
                  setError(null);
                }}
                className={`block w-full border-b border-white/[0.06] p-4 text-left transition hover:bg-white/[0.035] ${selectedId === conversation.id ? 'bg-white/[0.055] shadow-[inset_2px_0_0_0_rgb(52,211,153)]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                    <UserRound className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-100">{conversation.customer.name}</p>
                      {conversation.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">{conversation.unreadCount}</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{conversation.barbershop.name}</p>
                    <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-zinc-400">{conversation.last_message_preview || conversation.description || 'Ticket sem descrição.'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md border px-1.5 py-1 text-[9px] font-semibold ${planTone(conversation.plan)}`}>{planNames[conversation.plan]}</span>
                  <span className="rounded-md border border-white/8 px-1.5 py-1 text-[9px] text-zinc-500">{statusNames[conversation.status]}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">{formatDate(conversation.last_message_at)}</span>
                </div>
              </button>
            )) : (
              <div className="flex flex-col items-center px-5 py-12 text-center">
                <Inbox className="size-7 text-zinc-700" />
                <p className="mt-3 text-sm font-medium text-zinc-400">Sem tickets a mostrar</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600">Os novos tickets aparecem aqui para serem analisados e aceites.</p>
              </div>
            )}
          </div>
          <div className="border-t border-white/8 px-4 py-3 text-[10px] text-zinc-600">
            {conversations.length} ticket(s) · {conversations.reduce((sum, item) => sum + item.unreadCount, 0)} mensagem(ns) por ler
          </div>
        </aside>

        <div className="flex min-h-[440px] min-w-0 flex-col">
          {selected ? (
            <>
              <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-200">
                    <UserRound className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-100">{selected.subject}</h3>
                    <p className="mt-0.5 truncate text-xs text-zinc-300">{selected.customer.name} · {selected.barbershop.name}</p>
                    <p className="truncate text-xs text-zinc-500">{selected.customer.email || 'Sem email disponível'}</p>
                    <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${planTone(selected.plan)}`}>{planNames[selected.plan]}</span>
                  </div>
                </div>
                {selected.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => void acceptTicket()}
                    disabled={updatingStatus}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-50"
                  >
                    <CheckCheck className="size-4" /> {updatingStatus ? 'A aceitar…' : 'Aceitar ticket'}
                  </button>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    Estado
                    <select
                      value={selected.status}
                      disabled={updatingStatus}
                      onChange={(event) => void updateStatus(event.target.value as Status)}
                      className="min-h-9 rounded-lg border border-white/10 bg-[#121216] px-2.5 text-xs text-zinc-200 outline-none focus:border-emerald-400/30 disabled:opacity-50"
                    >
                      <option value="open">Chat ativo</option>
                      <option value="waiting_customer">À espera do membro</option>
                      <option value="closed">Resolvida</option>
                      <option value="closed_unresolved">Fechado sem resolução</option>
                    </select>
                  </label>
                )}
              </div>

{selected.status === 'pending' ? (
                <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
                  <div className="w-full max-w-xl rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5 text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">Descrição do problema</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{selected.description}</p>
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">O chat só fica disponível para o membro depois de aceitares este ticket.</p>

                </div>
              ) : (
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
                {messages.length ? messages.map((message) => {
                  const adminMessage = message.sender_type === 'admin';
                  return (
                    <div key={message.id} className={`flex ${adminMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[94%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${adminMessage ? 'rounded-br-md bg-emerald-400/10 text-zinc-100 ring-1 ring-emerald-400/15' : 'rounded-bl-md bg-white/[0.045] text-zinc-200 ring-1 ring-white/[0.06]'}`}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-zinc-600">
                          <span>{adminMessage ? 'Silentra' : selected.customer.name}</span>
                          <span>·</span>
                          <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                          {adminMessage ? <CheckCheck className="size-3" /> : null}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <MessageCircle className="size-8 text-zinc-700" />
                    <p className="mt-3 text-sm text-zinc-400">Conversa sem mensagens</p>
                    <p className="mt-1 text-xs text-zinc-600">A primeira mensagem aparecerá aqui.</p>
                  </div>
                )}
              </div>
              )}

{selected.status !== 'pending' && selected.status !== 'closed' && selected.status !== 'closed_unresolved' ? (
              <form onSubmit={sendReply} className="border-t border-white/10 bg-black/10 p-3 sm:p-4">
                <label htmlFor="admin-support-reply" className="sr-only">Resposta ao membro</label>
                <textarea
                  id="admin-support-reply"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escreve uma resposta ao membro…"
                  maxLength={4000}
                  rows={3}
                  disabled={sending}
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="inline-flex items-center gap-1.5 text-[10px] leading-5 text-zinc-600">
                    <ShieldCheck className="size-3.5 shrink-0" /> Mensagens privadas · Email automático apenas quando há mensagens por ler
                  </p>
                  <button type="submit" disabled={sending || !draft.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">
                    <Send className="size-4" /> {sending ? 'A enviar…' : 'Enviar resposta'}
                  </button>
                </div>
              </form>
              ) : selected.status === 'closed' || selected.status === 'closed_unresolved' ? (
                <div className="border-t border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
                  {selected.status === 'closed' ? 'Este ticket foi resolvido.' : 'Este ticket foi fechado sem resolução.'} Se o membro tiver outro problema, deverá criar um novo ticket.
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <CircleDot className="size-6 text-zinc-600" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-zinc-200">Escolhe uma conversa</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Os membros Free, Pro e Enterprise contactam a equipa nesta caixa de entrada. A prioridade do plano é aplicada automaticamente.</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600"><Clock3 className="size-3.5" /> Atualização automática a cada 15 segundos</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
