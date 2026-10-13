'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, PackageCheck, RefreshCw } from 'lucide-react';

type TrackedOrder = { reference: string; status: string; total: number; createdAt: string; fulfillmentMethod: 'pickup' | 'delivery'; shopName: string; items: Array<{ name: string; quantity: number; total: number }> };
const STATUS_LABELS: Record<string, string> = { pending: 'A aguardar confirmação', confirmed: 'Confirmada', preparing: 'Em preparação', ready: 'Pronta para levantamento', shipped: 'Enviada', delivered: 'Entregue', completed: 'Concluída', cancelled: 'Cancelada' };
const money = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

export default function MarketplaceOrderTrackingPage() {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) { setError('Abre o link de acompanhamento completo que recebeste por email.'); setLoading(false); return () => { active = false; }; }
    void (async () => {
      try {
        const response = await fetch('/api/marketplace/orders/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ token }) });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Não foi possível consultar a encomenda.');
        if (active) setOrder(json.order as TrackedOrder);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a encomenda.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  return <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50 sm:py-16"><div className="mx-auto max-w-2xl"><a href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"><ArrowLeft className="size-4" /> Marketplace</a><div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"><div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><PackageCheck className="size-6" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Silentra Marketplace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Acompanhar encomenda</h1>{loading ? <p className="mt-6 flex items-center gap-2 text-sm text-zinc-400"><RefreshCw className="size-4 animate-spin" /> A consultar o estado…</p> : error ? <p role="alert" className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</p> : order && <div className="mt-7 space-y-5"><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5"><p className="text-xs text-zinc-400">Referência #{order.reference}</p><p className="mt-2 text-xl font-semibold">{STATUS_LABELS[order.status] ?? 'Estado atualizado'}</p><p className="mt-1 text-sm text-zinc-400">{order.shopName}</p></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-zinc-500">Data</p><p className="mt-1 text-sm">{new Date(order.createdAt).toLocaleString('pt-PT')}</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-xs text-zinc-500">Entrega</p><p className="mt-1 text-sm">{order.fulfillmentMethod === 'delivery' ? 'Entrega pela barbearia' : 'Levantamento na barbearia'}</p></div></div><div><h2 className="font-semibold">Produtos</h2><div className="mt-3 divide-y divide-white/10">{order.items.map((item, index) => <div key={item.name + '-' + index} className="flex items-start justify-between gap-4 py-3 text-sm"><span className="text-zinc-300">{item.name} <span className="text-zinc-500">× {item.quantity}</span></span><span className="shrink-0">{money(item.total)}</span></div>)}</div><div className="flex justify-between border-t border-white/10 pt-4 font-semibold"><span>Total</span><span>{money(order.total)}</span></div></div><p className="text-xs leading-5 text-zinc-500">A entrega e o levantamento são tratados diretamente pela barbearia. Este link é privado: não o partilhes com outras pessoas.</p></div>}</div></div></main>;
}
