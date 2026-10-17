'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Globe2, Loader2, Mail, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type WebsiteStatus = 'requested' | 'contacted' | 'in_progress' | 'review' | 'published' | 'rejected';
type WebsiteRequest = {
  id: string;
  barbershop_id: string;
  owner_user_id: string;
  shop_name: string;
  booking_slug: string;
  contact_email: string;
  desired_slug: string;
  brief: string;
  status: WebsiteStatus;
  public_slug: string | null;
  site_title: string | null;
  site_description: string | null;
  hero_image_url: string | null;
  primary_cta_label: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
type AccessGrant = {
  barbershop_id: string;
  plan_at_grant: 'free' | 'pro';
  setup_fee_eur: number;
  monthly_fee_eur: number;
  reason: string;
  active: boolean;
  created_at: string;
  shop: { id: string; name: string; slug: string | null } | null;
};
type EditableRequest = {
  status: WebsiteStatus;
  publicSlug: string;
  siteTitle: string;
  siteDescription: string;
  heroImageUrl: string;
  primaryCtaLabel: string;
  adminNotes: string;
};
const STATUSES: { value: WebsiteStatus; label: string }[] = [
  { value: 'requested', label: 'Pedido recebido' },
  { value: 'contacted', label: 'Contacto iniciado' },
  { value: 'in_progress', label: 'Em desenvolvimento' },
  { value: 'review', label: 'A aguardar revisão' },
  { value: 'published', label: 'Publicado' },
  { value: 'rejected', label: 'Encerrado' },
];
const inputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40';

function toEditable(item: WebsiteRequest): EditableRequest {
  return {
    status: item.status,
    publicSlug: item.public_slug ?? item.desired_slug,
    siteTitle: item.site_title ?? item.shop_name,
    siteDescription: item.site_description ?? '',
    heroImageUrl: item.hero_image_url ?? '',
    primaryCtaLabel: item.primary_cta_label ?? 'Marcar horário',
    adminNotes: item.admin_notes ?? '',
  };
}

export default function CustomWebsitesAdmin() {
  const [items, setItems] = useState<WebsiteRequest[]>([]);
  const [edits, setEdits] = useState<Record<string, EditableRequest>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [grantShopId, setGrantShopId] = useState('');
  const [grantPlan, setGrantPlan] = useState<'free' | 'pro'>('pro');
  const [grantMonthlyFee, setGrantMonthlyFee] = useState('4.99');
  const [grantReason, setGrantReason] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/silentra-admin/custom-websites', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os pedidos.');
      const data = Array.isArray(body.data) ? body.data as WebsiteRequest[] : [];
      setItems(data);
      setEdits(Object.fromEntries(data.map((item) => [item.id, toEditable(item)])));
      const accessResponse = await fetch('/api/silentra-admin/custom-websites/access', { cache: 'no-store' });
      const accessBody = await accessResponse.json().catch(() => ({}));
      if (!accessResponse.ok) throw new Error(accessBody.error || 'Não foi possível carregar as permissões.');
      setGrants(Array.isArray(accessBody.data) ? accessBody.data as AccessGrant[] : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function change<K extends keyof EditableRequest>(id: string, key: K, value: EditableRequest[K]) {
    setEdits((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }

  async function changeGrantPlan(nextPlan: 'free' | 'pro') {
    setGrantPlan(nextPlan);
    setGrantMonthlyFee(nextPlan === 'pro' ? '4.99' : '6.99');
  }

  async function saveGrant(enabled: boolean, grant?: AccessGrant) {
    const barbershopId = grant?.barbershop_id ?? grantShopId.trim();
    const plan = grant?.plan_at_grant ?? grantPlan;
    const monthlyFee = grant?.monthly_fee_eur ?? Number(grantMonthlyFee);
    const reason = grant?.reason ?? grantReason.trim();
    if (!barbershopId) {
      toast.error('Indica o ID da barbearia (visível nos detalhes dos pedidos ou na área de Barbearias da administração).');
      return;
    }
    if (enabled && reason.length < 3) {
      toast.error('Indica o motivo da concessão, por exemplo: pagamento do site confirmado.');
      return;
    }
    setGrantBusy(true);
    try {
      const response = await fetch('/api/silentra-admin/custom-websites/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ barbershopId, enabled, plan, monthlyFee, reason }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar a permissão.');
      toast.success(enabled ? 'Acesso ao site próprio autorizado.' : 'Acesso ao site próprio revogado.');
      setGrantShopId('');
      setGrantReason('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar a permissão.');
    } finally {
      setGrantBusy(false);
    }
  }

  async function save(item: WebsiteRequest) {
    const edit = edits[item.id];
    if (!edit || savingId) return;
    setSavingId(item.id);
    try {
      const response = await fetch(`/api/silentra-admin/custom-websites/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          status: edit.status,
          publicSlug: edit.publicSlug,
          siteTitle: edit.siteTitle,
          siteDescription: edit.siteDescription,
          heroImageUrl: edit.heroImageUrl,
          primaryCtaLabel: edit.primaryCtaLabel,
          adminNotes: edit.adminNotes,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível guardar o pedido.');
      toast.success('Pedido de site atualizado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar alterações.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/silentra-admin" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft className="size-4" />Administração</Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Gestão interna</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight"><Globe2 className="size-7 text-emerald-300" />Sites personalizados</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Gere pedidos de sites personalizados, contacto com o cliente, estado do projeto e publicação no caminho público /nome-da-barbearia.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium hover:bg-white/[0.08] disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
        </header>

        <section className="space-y-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.035] p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Acesso e condições comerciais</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Autorizar sites para Free e Pro</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Depois de confirmares a aquisição do serviço, concede aqui a permissão sem alterar o plano da subscrição. Free: criação 150 € + 6,99 €/mês. Pro: criação 150 € + 4,99 €/mês. Enterprise: desconto de 100 € na criação (50 € finais) + 2,99 €/mês.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
            <label className="grid gap-1.5 text-xs text-zinc-400">ID da barbearia
              <input value={grantShopId} onChange={(event) => setGrantShopId(event.target.value)} placeholder="UUID da barbearia" className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-400">Plano atual
              <select value={grantPlan} onChange={(event) => void changeGrantPlan(event.target.value as 'free' | 'pro')} className={inputClass}>
                <option value="free">Free</option><option value="pro">Pro</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-400">Mensalidade (€)
              <input type="number" min="0" max="99.99" step="0.01" value={grantMonthlyFee} onChange={(event) => setGrantMonthlyFee(event.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="grid gap-1.5 text-xs text-zinc-400">Motivo / confirmação da aquisição
            <textarea value={grantReason} onChange={(event) => setGrantReason(event.target.value)} minLength={3} maxLength={1000} rows={2} placeholder="Ex.: pagamento inicial de 150 € confirmado em 17/10/2026." className={inputClass} />
          </label>
          <button type="button" onClick={() => void saveGrant(true)} disabled={grantBusy || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200 disabled:opacity-50">{grantBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Conceder acesso</button>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Permissões registadas ({grants.filter((grant) => grant.active).length} ativas)</h3>
            {grants.length === 0 ? <p className="text-sm text-zinc-500">Ainda não existem permissões concedidas.</p> : grants.map((grant) => (
              <div key={grant.barbershop_id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">{grant.shop?.name ?? 'Barbearia sem nome'} <span className="text-xs text-zinc-500">· {grant.plan_at_grant.toUpperCase()}</span></p>
                  <p className="mt-1 break-all text-xs text-zinc-500">{grant.barbershop_id}</p>
                  <p className="mt-1 text-xs text-zinc-400">Criação: {grant.setup_fee_eur.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} · Mensalidade: {grant.monthly_fee_eur.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} · {grant.active ? 'Ativa' : 'Revogada'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{grant.reason}</p>
                </div>
                {grant.active && <button type="button" onClick={() => void saveGrant(false, grant)} disabled={grantBusy} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 px-3 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50">Revogar acesso</button>}
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-zinc-500">Total de pedidos</p><p className="mt-2 text-2xl font-semibold">{items.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-zinc-500">Em aberto</p><p className="mt-2 text-2xl font-semibold">{items.filter((item) => ['requested', 'contacted', 'in_progress', 'review'].includes(item.status)).length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-zinc-500">Publicados</p><p className="mt-2 text-2xl font-semibold">{items.filter((item) => item.status === 'published').length}</p></div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-zinc-500"><Loader2 className="mr-2 size-5 animate-spin" />A carregar pedidos…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><Globe2 className="mx-auto size-8 text-zinc-600" /><h2 className="mt-4 font-semibold">Ainda não existem pedidos</h2><p className="mt-2 text-sm text-zinc-500">Quando um cliente autorizado pedir um site, o projeto aparece aqui.</p></div>
        ) : (
          <div className="space-y-5">
            {items.map((item) => {
              const edit = edits[item.id] ?? toEditable(item);
              return (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                  <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white">{item.shop_name}</h2>
                      <p className="mt-1 break-all text-xs text-zinc-500">Pedido {item.id} · {new Date(item.created_at).toLocaleString('pt-PT')}</p>
                      <p className="mt-2 text-sm text-zinc-400">URL pretendido: <span className="text-zinc-200">/site/{item.desired_slug}</span></p>
                    </div>
                    <a href={`mailto:${encodeURIComponent(item.contact_email)}?subject=${encodeURIComponent(`Site personalizado — ${item.shop_name}`)}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm hover:bg-white/[0.05]"><Mail className="size-4" />{item.contact_email}</a>
                  </div>
                  <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <section className="min-w-0 space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Brief do cliente</h3>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{item.brief}</p>
                      <div className="rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-zinc-500">Barbearia ID: <span className="break-all text-zinc-400">{item.barbershop_id}</span><br />Booking atual: <span className="text-zinc-400">/barbershops/{item.booking_slug}</span></div>
                    </section>
                    <section className="min-w-0 space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Estado e publicação</h3>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Estado do projeto
                        <select value={edit.status} onChange={(event) => change(item.id, 'status', event.target.value as WebsiteStatus)} className={inputClass}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Caminho público (sem /)
                        <input value={edit.publicSlug} onChange={(event) => change(item.id, 'publicSlug', event.target.value)} placeholder={item.desired_slug} className={inputClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Título do site
                        <input value={edit.siteTitle} onChange={(event) => change(item.id, 'siteTitle', event.target.value)} maxLength={120} className={inputClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Descrição / subtítulo
                        <textarea value={edit.siteDescription} onChange={(event) => change(item.id, 'siteDescription', event.target.value)} rows={3} maxLength={500} className={inputClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Imagem principal (URL HTTPS)
                        <input value={edit.heroImageUrl} onChange={(event) => change(item.id, 'heroImageUrl', event.target.value)} placeholder="https://…" className={inputClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Texto do botão principal
                        <input value={edit.primaryCtaLabel} onChange={(event) => change(item.id, 'primaryCtaLabel', event.target.value)} maxLength={40} className={inputClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs text-zinc-400">Notas internas
                        <textarea value={edit.adminNotes} onChange={(event) => change(item.id, 'adminNotes', event.target.value)} rows={2} maxLength={2000} className={inputClass} />
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        {item.status === 'published' && item.public_slug ? <Link href={`/site/${encodeURIComponent(item.public_slug)}`} target="_blank" className="inline-flex min-h-10 items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">Ver site <ExternalLink className="size-4" /></Link> : <span className="text-xs leading-5 text-zinc-600">Para publicar, define o caminho, título e descrição.</span>}
                        <button type="button" onClick={() => void save(item)} disabled={savingId !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200 disabled:opacity-50">{savingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar alterações</button>
                      </div>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
