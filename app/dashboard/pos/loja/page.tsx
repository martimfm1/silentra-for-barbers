'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  sku: string | null;
  unit_price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  active: boolean;
  marketplace_visible: boolean;
  marketplace_featured: boolean;
  marketplace_published_at?: string | null;
  marketplace_featured_until?: string | null;
  updated_at?: string;
};

type OrderItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total: number;
};

type OrderEvent = {
  id: string;
  previous_status: string | null;
  new_status: string;
  customer_message: string | null;
  created_at: string;
};

type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  subtotal: number;
  total: number;
  fulfillment_method: 'pickup' | 'delivery';
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  marketplace_order_items: OrderItem[];
  marketplace_order_events?: OrderEvent[];
};

const statuses = [
  ['pending', 'Recebida'],
  ['confirmed', 'Confirmada'],
  ['preparing', 'Em preparação'],
  ['ready', 'Pronta'],
  ['shipped', 'Enviada'],
  ['delivered', 'Entregue'],
  ['completed', 'Concluída'],
  ['cancelled', 'Cancelada'],
] as const;

const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value) || 0);

function statusLabel(status: string) {
  return statuses.find(([value]) => value === status)?.[1] ?? status;
}

function nextStatus(status: string) {
  const index = statuses.findIndex(([value]) => value === status);
  if (index < 0 || status === 'cancelled' || status === 'completed')
    return null;
  if (status === 'ready') return 'shipped';
  if (status === 'shipped') return 'delivered';
  if (status === 'delivered') return 'completed';
  return statuses[index + 1]?.[0] ?? null;
}

const emptyProduct = {
  name: '',
  description: '',
  category: '',
  imageUrl: '',
  sku: '',
  unitPrice: '',
  compareAtPrice: '',
  stockQuantity: '0',
  lowStockThreshold: '0',
  marketplaceVisible: true,
  marketplaceFeatured: false,
};

export default function POSStorePage() {
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('pos');
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [plan, setPlan] = useState('free');
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [product, setProduct] = useState(emptyProduct);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);

  async function loadProducts() {
    const response = await fetch('/api/marketplace/manage/products', {
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error || 'Não foi possível carregar os produtos.');
    setProducts(json.products ?? []);
    setPlan(typeof json.plan === 'string' ? json.plan : 'free');
  }

  async function loadOrders() {
    const response = await fetch('/api/marketplace/orders', {
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(json.error || 'Não foi possível carregar as encomendas.');
    setOrders(json.orders ?? []);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadProducts(), loadOrders()]);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a loja.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accessLoading && allowed) void loadAll();
  }, [accessLoading, allowed]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((item) => {
      if (!showInactive && !item.active) return false;
      if (!normalized) return true;
      return [item.name, item.description, item.category, item.sku]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [products, query, showInactive]);

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (order) => !['completed', 'cancelled'].includes(order.status),
      ).length,
    [orders],
  );
  const publishedProducts = useMemo(
    () =>
      products.filter(
        (item) =>
          item.active && item.marketplace_visible && item.stock_quantity > 0,
      ).length,
    [products],
  );

  function openCreate() {
    setEditing(null);
    setProduct(emptyProduct);
    setProductOpen(true);
  }

  function openEdit(item: Product) {
    setEditing(item);
    setProduct({
      name: item.name,
      description: item.description ?? '',
      category: item.category ?? '',
      imageUrl: item.image_url ?? '',
      sku: item.sku ?? '',
      unitPrice: String(item.unit_price),
      compareAtPrice:
        item.compare_at_price == null ? '' : String(item.compare_at_price),
      stockQuantity: String(item.stock_quantity),
      lowStockThreshold: String(item.low_stock_threshold),
      marketplaceVisible: item.marketplace_visible,
      marketplaceFeatured: item.marketplace_featured,
    });
    setProductOpen(true);
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const endpoint = editing
        ? `/api/marketplace/manage/products/${editing.id}`
        : '/api/marketplace/manage/products';
      const response = await fetch(endpoint, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível guardar o produto.');
      toast.success(editing ? 'Produto atualizado.' : 'Produto criado.');
      setProductOpen(false);
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar o produto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(item: Product) {
    if (
      !window.confirm(
        `Arquivar “${item.name}”? O produto deixa de aparecer na loja.`,
      )
    )
      return;
    try {
      const response = await fetch(
        `/api/marketplace/manage/products/${item.id}`,
        { method: 'DELETE' },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível arquivar o produto.');
      toast.success('Produto arquivado.');
      await loadProducts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível arquivar o produto.',
      );
    }
  }

  async function advanceOrder(order: Order) {
    const next = nextStatus(order.status);
    if (!next || orderBusy) return;
    setOrderBusy(order.id);
    try {
      const response = await fetch(`/api/marketplace/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error || 'Não foi possível atualizar a encomenda.',
        );
      toast.success(`Encomenda ${statusLabel(next).toLowerCase()}.`);
      await loadOrders();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a encomenda.',
      );
    } finally {
      setOrderBusy(null);
    }
  }

  async function cancelOrder(order: Order) {
    if (
      order.status === 'cancelled' ||
      ['completed', 'delivered', 'shipped'].includes(order.status)
    )
      return;
    if (!window.confirm(`Cancelar a encomenda de ${order.customer_name}?`))
      return;
    setOrderBusy(order.id);
    try {
      const response = await fetch(`/api/marketplace/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível cancelar a encomenda.');
      toast.success('Encomenda cancelada.');
      await loadOrders();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a encomenda.',
      );
    } finally {
      setOrderBusy(null);
    }
  }

  if (accessLoading || loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Spinner className="size-7" />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto size-8 text-emerald-400" />
            <h1 className="mt-4 text-2xl font-semibold">Loja Enterprise</h1>
            <p className="mt-2 text-zinc-500">
              A loja e o POS fazem parte do módulo Enterprise.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/dashboard/billing">Ver planos</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/pos"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-100"
            >
              <ArrowLeft className="size-4" />
              Voltar ao POS
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  POS · Loja
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Centro de vendas
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Gere anúncios, stock e encomendas num fluxo de marketplace. A
              experiência pública usa o mesmo catálogo e stock do POS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadAll()}>
              <RefreshCcw className="mr-2 size-4" />
              Atualizar
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Novo produto
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Produtos publicados',
              value: publishedProducts,
              note: 'Visíveis na loja pública',
            },
            {
              label: 'Encomendas em curso',
              value: pendingOrders,
              note: 'Ainda precisam de ação',
            },
            {
              label: 'Produtos no catálogo',
              value: products.length,
              note: 'Inclui arquivados',
            },
          ].map((metric) => (
            <Card
              key={metric.label}
              className="border-white/10 bg-white/[0.025]"
            >
              <CardContent className="p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-600">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{metric.note}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="flex gap-2 border-b border-white/10">
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`min-h-11 border-b-2 px-2 text-sm font-semibold ${tab === 'products' ? 'border-emerald-400 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`min-h-11 border-b-2 px-2 text-sm font-semibold ${tab === 'orders' ? 'border-emerald-400 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Encomendas{pendingOrders > 0 ? ` · ${pendingOrders}` : ''}
          </button>
        </div>

        {tab === 'products' ? (
          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block max-w-xl flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar produto, categoria ou SKU..."
                  className="h-11 border-white/10 bg-white/[0.03] pl-9"
                  aria-label="Pesquisar produtos"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowInactive((value) => !value)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-400 hover:bg-white/[0.04]"
              >
                {showInactive ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
                {showInactive ? 'Ocultar arquivados' : 'Mostrar arquivados'}
              </button>
            </div>
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Boxes className="mx-auto size-8 text-zinc-700" />
                  <p className="mt-4 text-sm text-zinc-500">
                    Não existem produtos neste filtro.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredProducts.map((item) => (
                  <Card
                    key={item.id}
                    className="group overflow-hidden border-white/10 bg-white/[0.025]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-white/[0.02]">
                      {item.image_url ? (
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${item.image_url})` }}
                          role="img"
                          aria-label={item.name}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImagePlus className="size-8 text-zinc-700" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        {item.marketplace_visible && item.active ? (
                          <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                            Publicado
                          </span>
                        ) : (
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold text-zinc-400">
                            Oculto
                          </span>
                        )}
                        {item.marketplace_featured && (
                          <span className="rounded-full bg-amber-300/15 px-2 py-1 text-[10px] font-semibold text-amber-200">
                            Destaque
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-zinc-950/80 px-2.5 py-1 text-[10px] text-zinc-300 backdrop-blur">
                        {item.stock_quantity} em stock
                      </div>
                    </div>
                    <CardContent className="space-y-4 p-4">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                          {item.category || 'Produto'}
                        </p>
                        <h2 className="mt-1 truncate font-semibold text-white">
                          {item.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-zinc-500">
                          {item.description || 'Sem descrição.'}
                        </p>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">
                            {money(item.unit_price)}
                          </p>
                          {item.compare_at_price != null && (
                            <p className="text-[11px] text-zinc-600 line-through">
                              {money(item.compare_at_price)}
                            </p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEdit(item)}
                          aria-label={`Editar ${item.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </Button>
                        {item.active ? (
                          <Button
                            variant="ghost"
                            onClick={() => void archiveProduct(item)}
                            aria-label={`Arquivar ${item.name}`}
                          >
                            Arquivar
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Package className="mx-auto size-8 text-zinc-700" />
                  <p className="mt-4 text-sm text-zinc-500">
                    Ainda não existem encomendas.
                  </p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => {
                const next = nextStatus(order.status);
                const busy = orderBusy === order.id;
                return (
                  <Card
                    key={order.id}
                    className="border-white/10 bg-white/[0.025]"
                  >
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                              {statusLabel(order.status)}
                            </span>
                            <span className="font-mono text-xs text-zinc-600">
                              #{order.id.slice(0, 8)}
                            </span>
                          </div>
                          <h2 className="mt-2 text-lg font-semibold text-white">
                            {order.customer_name}
                          </h2>
                          <p className="mt-1 text-xs text-zinc-500">
                            {order.customer_email} · {order.customer_phone}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {new Date(order.created_at).toLocaleString('pt-PT')}{' '}
                            ·{' '}
                            {order.fulfillment_method === 'delivery'
                              ? 'Entrega'
                              : 'Levantamento'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {next && (
                            <Button
                              onClick={() => void advanceOrder(order)}
                              disabled={busy}
                            >
                              <Check className="mr-2 size-4" />
                              Avançar para {statusLabel(next)}
                            </Button>
                          )}
                          {order.status !== 'cancelled' &&
                            !['completed', 'delivered', 'shipped'].includes(
                              order.status,
                            ) && (
                              <Button
                                variant="outline"
                                onClick={() => void cancelOrder(order)}
                                disabled={busy}
                              >
                                Cancelar
                              </Button>
                            )}
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {order.marketplace_order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {item.product_name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {item.quantity} × {money(item.unit_price)}
                                </p>
                              </div>
                              <p className="text-sm font-semibold">
                                {money(item.total)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 lg:min-w-44">
                          <p className="text-xs text-zinc-500">Total</p>
                          <p className="mt-1 text-2xl font-semibold">
                            {money(order.total)}
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                            {order.fulfillment_method === 'delivery' ? (
                              <Truck className="size-4" />
                            ) : (
                              <Package className="size-4" />
                            )}
                            {order.fulfillment_method === 'delivery'
                              ? `${order.shipping_postal_code ?? ''} ${order.shipping_city ?? ''}`
                              : 'Levantamento na barbearia'}
                          </div>
                        </div>
                      </div>
                      {order.notes && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-400">
                          <strong className="text-zinc-200">Nota:</strong>{' '}
                          {order.notes}
                        </div>
                      )}
                      {order.marketplace_order_events &&
                        order.marketplace_order_events.length > 0 && (
                          <div className="mt-5 border-t border-white/10 pt-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                              Histórico
                            </p>
                            <div className="mt-3 space-y-2">
                              {order.marketplace_order_events
                                .slice(-4)
                                .map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex items-center justify-between gap-3 text-xs"
                                  >
                                    <span className="text-zinc-400">
                                      {event.customer_message ||
                                        `${event.previous_status ? statusLabel(event.previous_status) + ' → ' : ''}${statusLabel(event.new_status)}`}
                                    </span>
                                    <span className="shrink-0 text-zinc-700">
                                      {new Date(
                                        event.created_at,
                                      ).toLocaleString('pt-PT')}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </section>
        )}

        {productOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !saving && setProductOpen(false)}
              aria-label="Fechar"
            />
            <form
              onSubmit={saveProduct}
              className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl sm:p-7"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                    {editing ? 'Editar anúncio' : 'Novo anúncio'}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    {editing ? editing.name : 'Publicar produto'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => !saving && setProductOpen(false)}
                  className="rounded-xl px-3 py-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                >
                  Fechar
                </button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Nome *
                  </span>
                  <Input
                    required
                    value={product.name}
                    onChange={(e) =>
                      setProduct({ ...product, name: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Descrição
                  </span>
                  <textarea
                    value={product.description}
                    onChange={(e) =>
                      setProduct({ ...product, description: e.target.value })
                    }
                    className="min-h-24 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white outline-none focus:border-emerald-400/40"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Categoria
                  </span>
                  <Input
                    value={product.category}
                    onChange={(e) =>
                      setProduct({ ...product, category: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">SKU</span>
                  <Input
                    value={product.sku}
                    onChange={(e) =>
                      setProduct({ ...product, sku: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Preço *
                  </span>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.unitPrice}
                    onChange={(e) =>
                      setProduct({ ...product, unitPrice: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Preço anterior
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.compareAtPrice}
                    onChange={(e) =>
                      setProduct({ ...product, compareAtPrice: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Stock *
                  </span>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={product.stockQuantity}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        stockQuantity: e.target.value,
                        marketplaceFeatured:
                          Number(e.target.value) > 0 && product.marketplaceFeatured,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Aviso de stock baixo
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={product.lowStockThreshold}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        lowStockThreshold: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5 sm:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Imagem (URL)
                  </span>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={product.imageUrl}
                    onChange={(e) =>
                      setProduct({ ...product, imageUrl: e.target.value })
                    }
                  />
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={product.marketplaceVisible}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        marketplaceVisible: e.target.checked,
                        marketplaceFeatured:
                          e.target.checked && product.marketplaceFeatured,
                      })
                    }
                    className="size-4 accent-emerald-400"
                  />
                  <span>
                    <strong className="block text-sm text-white">
                      Publicar na loja online
                    </strong>
                    <span className="text-xs text-zinc-500">
                      O produto aparece no marketplace quando existe stock.
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={product.marketplaceFeatured}
                    disabled={
                      plan !== 'enterprise' ||
                      !product.marketplaceVisible ||
                      !product.active ||
                      Number(product.stockQuantity) <= 0 ||
                      Boolean(
                        editing?.marketplace_published_at &&
                          Date.now() >=
                            Date.parse(editing.marketplace_published_at) +
                              3 * 24 * 60 * 60 * 1000,
                      )
                    }
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        marketplaceFeatured: e.target.checked,
                      })
                    }
                    className="size-4 accent-amber-300 disabled:opacity-40"
                  />
                  <span>
                    <strong className="flex items-center gap-2 text-sm text-white">
                      Destaque Enterprise · 3 dias
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">
                      {plan !== 'enterprise'
                        ? 'Disponível exclusivamente no plano Enterprise.'
                        : !product.marketplaceVisible
                          ? 'Ativa primeiro a publicação online.'
                          : !product.active || Number(product.stockQuantity) <= 0
                            ? 'O produto tem de estar ativo e ter stock disponível.'
                            : editing?.marketplace_published_at &&
                                Date.now() >=
                                  Date.parse(editing.marketplace_published_at) +
                                    3 * 24 * 60 * 60 * 1000
                              ? 'A janela de destaque deste produto já terminou.'
                              : 'Coloca o produto em destaque até 3 dias após a primeira publicação.'}
                    </span>
                  </span>
                </label>
              </div>
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Spinner className="mr-2 size-4" />
                  ) : (
                    <Check className="mr-2 size-4" />
                  )}
                  {saving
                    ? 'A guardar…'
                    : editing
                      ? 'Guardar alterações'
                      : 'Publicar produto'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
