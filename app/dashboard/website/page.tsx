'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Globe2, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

type WebsiteAccess = { allowed: boolean; setupFee: number; monthlyFee: number; source: 'enterprise' | 'admin_grant' | 'not_granted' };

type WebsiteRequest = {
  id: string;
  shop_name: string;
  desired_slug: string;
  brief: string;
  contact_email: string;
  status: 'requested' | 'contacted' | 'in_progress' | 'review' | 'published' | 'rejected';
  public_slug?: string | null;
  site_title?: string | null;
  site_description?: string | null;
  created_at: string;
  published_at?: string | null;
};

const STATUS: Record<WebsiteRequest['status'], { label: string; description: string }> = {
  requested: { label: 'Pedido recebido', description: 'A Silentra irá analisar o pedido e entrar em contacto contigo.' },
  contacted: { label: 'Contacto iniciado', description: 'A equipa está a alinhar os detalhes do projeto contigo.' },
  in_progress: { label: 'Em desenvolvimento', description: 'O site está a ser construído.' },
  review: { label: 'A aguardar revisão', description: 'A equipa está a preparar ou aguardar a tua validação.' },
  published: { label: 'Publicado', description: 'O site está disponível no caminho público atribuído.' },
  rejected: { label: 'Pedido encerrado', description: 'Contacta a Silentra se precisares de esclarecer ou rever o pedido.' },
};

export default function CustomWebsiteDashboardPage() {
  const { plan, loading: planLoading } = useFeatureAccess();
  const [requests, setRequests] = useState<WebsiteRequest[]>([]);
  const [access, setAccess] = useState<WebsiteAccess | null>(null);
  const [desiredSlug, setDesiredSlug] = useState('');
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/custom-website', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os pedidos.');
      setRequests(Array.isArray(body.data) ? body.data : []);
      setAccess(body.access && typeof body.access === 'object' ? body.access as WebsiteAccess : null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!planLoading) void load();
  }, [load, planLoading]);

  const activeRequest = requests.find((item) =>
    ['requested', 'contacted', 'in_progress', 'review'].includes(item.status),
  );
  const latest = requests[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/dashboard/custom-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ desiredSlug, brief }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível enviar o pedido.');
      toast.success('Pedido de site enviado à Silentra.');
      setDesiredSlug('');
      setBrief('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (planLoading || loading) {
    return <main className="dashboard-page mx-auto w-full max-w-5xl p-4 sm:p-8"><div className="flex min-h-64 items-center justify-center text-zinc-500"><Loader2 className="mr-2 size-5 animate-spin" />A carregar os teus sites…</div></main>;
  }

  if (!access?.allowed) {
    const monthlyPrice = plan === 'pro' ? '4,99 €' : '6,99 €';
    return (
      <main className="dashboard-page mx-auto w-full max-w-5xl p-4 sm:p-8">
        <Link href="/dashboard/billing" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft className="size-4" />Plano e pagamentos</Link>
        <section className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.035] p-6 sm:p-10">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><ShieldCheck className="size-6" /></div>
          <h1 className="mt-5 text-2xl font-semibold text-white">Site próprio para a tua barbearia</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">O serviço pode ser adquirido por clientes de qualquer plano. A criação custa <strong className="text-zinc-100">150 €</strong> e a manutenção mensal para o teu plano {plan === 'pro' ? 'Pro' : 'Free'} é de <strong className="text-zinc-100">{monthlyPrice}/mês</strong>. O acesso ao pedido e à gestão do site é ativado pela equipa depois de confirmar a aquisição.</p>
          <a href={`mailto:silentra.contact@gmail.com?subject=${encodeURIComponent('Adquirir site próprio — ' + (plan === 'pro' ? 'Pro' : 'Free'))}`} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200"><Mail className="size-4" />Adquirir site próprio</a>
          <p className="mt-4 text-xs leading-5 text-zinc-500">Após a confirmação do pagamento, a administração pode conceder acesso a esta área sem alterar o teu plano de subscrição.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200"><ArrowLeft className="size-4" />Dashboard</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">{plan === 'enterprise' ? 'Enterprise' : 'Acesso autorizado'} · Serviço à medida</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Site próprio</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">A Silentra cria um site personalizado para a tua barbearia. A criação custa <span className="font-medium text-zinc-200">{access.setupFee.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>{plan === 'enterprise' ? <span className="ml-2 text-xs text-emerald-300">desconto Enterprise de 100 € aplicado</span> : null} e a mensalidade é <span className="font-medium text-zinc-200">{access.monthlyFee.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}/mês</span>. O site é publicado após aprovação do projeto e confirmação das condições comerciais.</p>
        </div>
        <a href="mailto:silentra.contact@gmail.com?subject=Site%20pr%C3%B3prio%20Enterprise" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 hover:bg-white/[0.08]"><Mail className="size-4" />Contactar a Silentra</a>
      </header>

      {latest && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Estado do pedido mais recente</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{STATUS[latest.status].label}</h2>
              <p className="mt-1 text-sm text-zinc-400">{STATUS[latest.status].description}</p>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">{new Date(latest.created_at).toLocaleDateString('pt-PT')}</span>
          </div>
          {latest.status === 'published' && latest.public_slug && (
            <a href={`/site/${encodeURIComponent(latest.public_slug)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200">Abrir site publicado <ExternalLink className="size-4" /></a>
          )}
        </section>
      )}

      {!activeRequest && latest?.status !== 'published' && (
        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-white">Pedir um site personalizado</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Conta-nos o que pretendes. O pedido serve para iniciar a conversa, não é uma compra nem uma publicação automática.</p>
          </div>
          <label className="grid gap-2 text-sm text-zinc-300">
            Nome pretendido para o endereço
            <div className="flex min-w-0 items-center rounded-xl border border-white/10 bg-black/20 focus-within:border-emerald-400/40">
              <span className="shrink-0 pl-3 text-xs text-zinc-500">/</span>
              <input value={desiredSlug} onChange={(event) => setDesiredSlug(event.target.value)} required minLength={3} maxLength={50} pattern="[A-Za-z0-9À-ÿ -]+" placeholder="a-tua-barbearia" className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-zinc-600" />
            </div>
            <span className="text-xs text-zinc-500">O endereço final será confirmado pela Silentra e pode diferir se já estiver ocupado.</span>
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Descreve o site que tens em mente
            <textarea value={brief} onChange={(event) => setBrief(event.target.value)} required minLength={20} maxLength={4000} rows={6} placeholder="Estilo visual, cores, páginas, serviços, referências, funcionalidades e outras necessidades…" className="min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/40" />
            <span className="text-right text-xs text-zinc-600">{brief.length}/4000</span>
          </label>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-xs leading-5 text-zinc-400">Depois do envio, a Silentra contacta-te para discutir o âmbito, o prazo e o orçamento. O site só será publicado depois de acordado e aprovado.</div>
          <Button type="submit" disabled={submitting} className="min-h-11 w-full sm:w-auto">{submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}Enviar pedido</Button>
        </form>
      )}

      {requests.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Histórico de pedidos</h2>
          {requests.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium text-zinc-100">{item.desired_slug}</p><p className="mt-1 text-xs text-zinc-500">{new Date(item.created_at).toLocaleDateString('pt-PT')}</p></div>
                <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{STATUS[item.status].label}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
