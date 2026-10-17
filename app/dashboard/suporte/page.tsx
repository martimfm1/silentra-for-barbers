'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock3,
  Headset,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

type SupportPlan = 'free' | 'pro' | 'enterprise';
type SupportStatus = 'open' | 'waiting_customer' | 'closed';
type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_type: 'customer' | 'admin';
  sender_user_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};
type SupportConversation = {
  id: string;
  subject: string;
  status: SupportStatus;
  plan: SupportPlan;
  priority: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  shop_name?: string;
};

const planDescriptions: Record<SupportPlan, { title: string; detail: string }> = {
  free: { title: 'Suporte standard', detail: 'A equipa responde assim que possível.' },
  pro: { title: 'Suporte prioritário', detail: 'A tua conversa tem prioridade sobre o plano Free.' },
  enterprise: { title: 'Suporte Enterprise', detail: 'Prioridade máxima na fila de suporte.' },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status: SupportStatus) {
  if (status === 'waiting_customer') return 'À espera da tua resposta';
  if (status === 'closed') return 'Resolvida';
  return 'Em acompanhamento';
}

export default function SupportPage() {
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/support/conversations', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        conversation?: SupportConversation | null;
        messages?: SupportMessage[];
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Não foi possível carregar o suporte.');
      }
      setConversation(payload.conversation ?? null);
      setMessages(payload.messages ?? []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado.';
      setError(message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const response = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        conversationId?: string;
        message?: SupportMessage;
      };
      if (!response.ok || !payload.ok || !payload.message) {
        throw new Error(payload.error || 'Não foi possível enviar a mensagem.');
      }
      setDraft('');
      setConversation((current) =>
        current
          ? { ...current, id: payload.conversationId ?? current.id, status: 'open' }
          : {
              id: payload.conversationId ?? payload.message!.conversation_id,
              subject: 'Suporte Silentra',
              status: 'open',
              plan: 'free',
              priority: 1,
              last_message_at: payload.message!.created_at,
              last_message_preview: payload.message!.body.slice(0, 200),
            },
      );
      setMessages((current) => [...current, payload.message!]);
      toast.success('Mensagem enviada à equipa Silentra.');
      await refresh(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const plan = conversation?.plan ?? 'free';
  const planInfo = planDescriptions[plan];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Apoio ao membro
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Fala diretamente com a Silentra.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Coloca aqui as tuas dúvidas ou problemas. A conversa fica guardada
              na plataforma e recebes um email quando a equipa responder.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-border bg-card px-4 text-sm font-medium transition hover:bg-accent disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Headset className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Chat de suporte</h2>
                <p className="text-xs text-muted-foreground">
                  {conversation ? statusLabel(conversation.status) : 'Canal privado de contacto'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                <LockKeyhole className="size-3" /> Privado
              </span>
            </div>

            <div className="flex min-h-[360px] flex-col">
              {loading && !conversation ? (
                <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                  A carregar o suporte…
                </div>
              ) : error && !conversation ? (
                <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                  <button className="ml-2 underline" type="button" onClick={() => void refresh()}>
                    Tentar novamente
                  </button>
                </div>
              ) : !conversation && messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <MessageCircle className="size-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">Como podemos ajudar?</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Envia a tua primeira mensagem para abrir uma conversa com a
                    equipa Silentra. Não precisas de sair da dashboard nem de
                    enviar um email manualmente.
                  </p>
                </div>
              ) : (
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                  {messages.map((message) => {
                    const ownMessage = message.sender_type === 'customer';
                    return (
                      <div key={message.id} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${ownMessage ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground'}`}>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                          <div className={`mt-2 flex items-center justify-end gap-1.5 text-[10px] ${ownMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            <span>{ownMessage ? 'Tu' : 'Equipa Silentra'}</span>
                            <span>·</span>
                            <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                            {ownMessage ? <Check className="size-3" aria-label={message.read_at ? 'Lida' : 'Enviada'} /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error && conversation ? (
              <div className="mx-4 mb-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:mx-6">
                Não foi possível atualizar a conversa. As mensagens já carregadas continuam disponíveis.
              </div>
            ) : null}

            <form onSubmit={sendMessage} className="border-t border-border bg-muted/20 p-3 sm:p-4">
              <label htmlFor="support-message" className="sr-only">A tua mensagem</label>
              <textarea
                id="support-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreve a tua mensagem…"
                maxLength={4000}
                rows={3}
                disabled={sending}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Recebes uma notificação por email quando houver uma resposta por ler.
                </p>
                <button
                  type="submit"
                  disabled={sending || !draft.trim() || draft.trim().length > 4000}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? 'A enviar…' : 'Enviar mensagem'}
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-5" />
                <h2 className="font-semibold">Prioridade do teu plano</h2>
              </div>
              <p className="mt-4 text-lg font-semibold">{planInfo.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{planInfo.detail}</p>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={plan === 'free' ? 'font-medium text-foreground' : 'text-muted-foreground'}>Free</span>
                  <span className="text-xs text-muted-foreground">Standard</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={plan === 'pro' ? 'font-medium text-foreground' : 'text-muted-foreground'}>Pro</span>
                  <span className="text-xs text-muted-foreground">Prioritário</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={plan === 'enterprise' ? 'font-medium text-foreground' : 'text-muted-foreground'}>Enterprise</span>
                  <span className="text-xs text-muted-foreground">Prioridade máxima</span>
                </div>
              </div>
              <a href="/dashboard/billing" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Ver planos <ArrowUpRight className="size-4" />
              </a>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="size-5 text-muted-foreground" />
                <h2 className="font-semibold">Como funciona</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                As mensagens ficam nesta conversa. Quando uma nova resposta
                estiver por ler, a plataforma envia um aviso por email. Abre a
                dashboard para continuares o contacto.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
