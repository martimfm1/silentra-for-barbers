'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Store,
  Trash2,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
};
type SalesMode = 'physical_only' | 'physical_and_online';

type FormState = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  sku: string;
  unitPrice: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  active: boolean;
  marketplaceVisible: boolean;
  marketplaceFeatured: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  category: '',
  imageUrl: '',
  sku: '',
  unitPrice: '',
  compareAtPrice: '',
  stockQuantity: '0',
  lowStockThreshold: '0',
  active: true,
  marketplaceVisible: false,
  marketplaceFeatured: false,
};
const money = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(n) || 0,
  );

export default function MarketplaceProductsPage() {
  const confirm = useDashboardConfirm();
  const { hasFeature, loading: accessLoading } = useFeatureAccess();
  const allowed = hasFeature('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [salesMode, setSalesMode] = useState<SalesMode>('physical_only');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/marketplace/manage/products', {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível carregar os produtos.');
      setProducts(json.products ?? []);
      setPlan(typeof json.plan === 'string' ? json.plan : 'free');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar os produtos.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch('/api/marketplace/manage/settings', {
        cache: 'no-store',
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error || 'Não foi possível carregar as definições.',
        );
      setSalesMode(
        json.marketplaceSalesMode === 'physical_and_online'
          ? 'physical_and_online'
          : 'physical_only',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar as definições.',
      );
    }
  }

  useEffect(() => {
    if (!accessLoading && allowed) {
      void load();
      void loadSettings();
    }
  }, [accessLoading, allowed]);

  const boostWindowOpen =
    !editing?.marketplace_published_at ||
    (Number.isFinite(Date.parse(editing.marketplace_published_at)) &&
      Date.now() <
        Date.parse(editing.marketplace_published_at) + 3 * 24 * 60 * 60 * 1000);
  const canToggleBoost =
    plan === 'enterprise' &&
    boostWindowOpen &&
    form.marketplaceVisible &&
    form.active &&
    Number(form.stockQuantity) > 0;
  const boostHint =
    plan !== 'enterprise'
      ? 'O destaque está disponível exclusivamente no plano Enterprise.'
      : !form.marketplaceVisible
        ? 'Ativa primeiro a publicação online.'
        : !form.active || Number(form.stockQuantity) <= 0
          ? 'O produto tem de estar ativo e ter stock disponível.'
          : !boostWindowOpen
            ? 'A janela de destaque deste produto já terminou.'
            : 'O produto fica em destaque até 3 dias após a primeira publicação.';

  const categories = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((product) => product.category)
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [products],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-PT');
    return products.filter((product) => {
      const text =
        `${product.name} ${product.description ?? ''} ${product.sku ?? ''}`.toLocaleLowerCase(
          'pt-PT',
        );
      return (
        (!term || text.includes(term)) &&
        (category === 'all' || product.category === category) &&
        (visibility === 'all' ||
          (visibility === 'published'
            ? product.marketplace_visible
            : !product.marketplace_visible))
      );
    });
  }, [products, search, category, visibility]);

  async function saveSalesMode(next: SalesMode) {
    if (settingsSaving) return;
    setSettingsSaving(true);
    try {
      const response = await fetch('/api/marketplace/manage/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceSalesMode: next }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error || 'Não foi possível guardar as definições.',
        );
      setSalesMode(next);
      toast.success(
        next === 'physical_and_online'
          ? 'Vendas online ativadas.'
          : 'Marketplace online desativado.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao guardar as definições.',
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  function startCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }
  function startEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? '',
      imageUrl: product.image_url ?? '',
      sku: product.sku ?? '',
      unitPrice: String(product.unit_price),
      compareAtPrice:
        product.compare_at_price == null
          ? ''
          : String(product.compare_at_price),
      stockQuantity: String(product.stock_quantity),
      lowStockThreshold: String(product.low_stock_threshold),
      active: product.active,
      marketplaceVisible: product.marketplace_visible,
      marketplaceFeatured: product.marketplace_featured,
    });
    setFormOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const url = editing
        ? `/api/marketplace/manage/products/${editing.id}`
        : '/api/marketplace/manage/products';
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível guardar o produto.');
      toast.success(editing ? 'Produto atualizado.' : 'Produto criado.');
      setEditing(null);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao guardar o produto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(product: Product) {
    const confirmed = await confirm({
      title: 'Arquivar produto?',
      description: `“${product.name}” deixará de estar disponível para venda. Os registos anteriores serão mantidos.`,
      confirmLabel: 'Arquivar produto',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch(
        `/api/marketplace/manage/products/${product.id}`,
        { method: 'DELETE' },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível arquivar.');
      toast.success('Produto arquivado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao arquivar.');
    }
  }

  if (accessLoading || loading)
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-20 rounded-2xl bg-white/5" />
          <div className="h-28 rounded-2xl bg-white/5" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-72 rounded-3xl bg-white/5" />
            ))}
          </div>
        </div>
      </main>
    );
  if (!allowed)
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <Package className="mx-auto size-8 text-emerald-300" />
          <h1 className="mt-4 text-2xl font-semibold">Produtos e vendas</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Esta área faz parte do módulo de vendas.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/billing">Ver plano</Link>
          </Button>
        </div>
      </main>
    );

  const published = products.filter(
    (product) => product.marketplace_visible && product.active,
  ).length;
  const lowStock = products.filter(
    (product) =>
      product.active && product.stock_quantity <= product.low_stock_threshold,
  ).length;
  const stockUnits = products.reduce(
    (sum, product) => sum + Number(product.stock_quantity),
    0,
  );

  return (
    <main className="min-h-screen px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/pos"
              className="inline-flex min-h-10 items-center gap-2 text-sm text-zinc-500 hover:text-white"
            >
              ← Voltar ao ponto de venda
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300">
                <Store className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Vendas
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Produtos
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">
              Uma única fonte de verdade para o POS, stock e catálogo online.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild className="min-h-11">
              <Link href="/marketplace" target="_blank">
                Ver marketplace
              </Link>
            </Button>
            <Button
              onClick={startCreate}
              className="min-h-11 bg-zinc-50 text-zinc-950 hover:bg-white"
            >
              <Plus className="mr-2 size-4" />
              Novo produto
            </Button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={Package}
            label="Produtos"
            value={String(products.length)}
            detail={`${published} publicados`}
          />
          <Metric
            icon={CheckCircle2}
            label="Online"
            value={salesMode === 'physical_and_online' ? 'Ativo' : 'Desligado'}
            detail={
              salesMode === 'physical_and_online'
                ? 'Aceita encomendas online'
                : 'Só vendas físicas'
            }
          />
          <Metric
            icon={Store}
            label="Stock"
            value={String(stockUnits)}
            detail="unidades em inventário"
          />
          <Metric
            icon={Truck}
            label="Stock baixo"
            value={String(lowStock)}
            detail="precisam de atenção"
          />
        </div>

        <Card
          className={`overflow-hidden border ${salesMode === 'physical_and_online' ? 'border-emerald-400/20 bg-emerald-400/[0.035]' : 'border-white/10 bg-white/[0.02]'}`}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  {salesMode === 'physical_and_online' ? (
                    <Truck className="size-5 text-emerald-300" />
                  ) : (
                    <Settings2 className="size-5 text-zinc-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Canal de vendas
                  </p>
                  <h2 className="mt-1 text-base font-semibold">
                    Onde queres vender os teus produtos?
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                    Vendas físicas usam o POS. Ao ativares vendas online, os
                    produtos publicados aparecem no marketplace e os clientes
                    podem criar encomendas. A Silentra não trata de
                    transportadoras nem expedições.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[430px]">
                <ModeButton
                  active={salesMode === 'physical_only'}
                  disabled={settingsSaving}
                  onClick={() => void saveSalesMode('physical_only')}
                  icon={Store}
                  title="Só físico"
                  description="POS / loja"
                />
                <ModeButton
                  active={salesMode === 'physical_and_online'}
                  disabled={settingsSaving}
                  onClick={() => void saveSalesMode('physical_and_online')}
                  icon={Truck}
                  title="Físico + online"
                  description="Marketplace + POS"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.02]">
          <CardContent className="p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar nome, descrição ou SKU"
                  className="min-h-11 border-white/10 bg-white/[0.03] pl-9"
                  aria-label="Pesquisar produtos"
                />
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filtrar por categoria"
                className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
              >
                <option value="all">Todas as categorias</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
                aria-label="Filtrar por publicação"
                className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm"
              >
                <option value="all">Todos os produtos</option>
                <option value="published">Publicados online</option>
                <option value="hidden">Não publicados</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) {
              setEditing(null);
              setForm(EMPTY_FORM);
            }
          }}
        >
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 p-3 text-zinc-100 sm:max-w-4xl sm:p-5">
            {formOpen && (
              <Card className="border-emerald-400/15 bg-emerald-400/[0.025]">
            <CardHeader>
              <CardTitle>
                {editing ? `Editar ${editing.name}` : 'Novo produto'}
              </CardTitle>
              <p className="text-sm text-zinc-500">
                Preenche a informação pública, preço, imagem e stock. O mesmo
                stock é usado no POS e no marketplace.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Nome *
                  </span>
                  <Input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    placeholder="Pomada Matte 100ml"
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Descrição
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    className="min-h-24 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white outline-none focus:border-emerald-400/40"
                    placeholder="Descrição curta e útil para o cliente."
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Categoria
                  </span>
                  <Input
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                    placeholder="Cabelo"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">SKU</span>
                  <Input
                    value={form.sku}
                    onChange={(event) =>
                      setForm({ ...form, sku: event.target.value })
                    }
                    placeholder="Opcional"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Preço (€) *
                  </span>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitPrice}
                    onChange={(event) =>
                      setForm({ ...form, unitPrice: event.target.value })
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
                    value={form.compareAtPrice}
                    onChange={(event) =>
                      setForm({ ...form, compareAtPrice: event.target.value })
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
                    value={form.stockQuantity}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        stockQuantity: event.target.value,
                        marketplaceFeatured:
                          Number(event.target.value) > 0 &&
                          form.marketplaceFeatured,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    Alerta de stock
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.lowStockThreshold}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        lowStockThreshold: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-zinc-300">
                    URL da imagem
                  </span>
                  <Input
                    type="url"
                    value={form.imageUrl}
                    onChange={(event) =>
                      setForm({ ...form, imageUrl: event.target.value })
                    }
                    placeholder="https://..."
                  />
                </label>
                <fieldset className="grid gap-2 md:col-span-2">
                  <legend className="text-xs font-semibold text-zinc-300">
                    Publicação
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <CheckBox
                      checked={form.active}
                      onChange={(checked) =>
                        setForm({
                          ...form,
                          active: checked,
                          marketplaceFeatured:
                            checked && form.marketplaceFeatured,
                        })
                      }
                      title="Produto ativo"
                    />
                    <CheckBox
                      checked={form.marketplaceVisible}
                      onChange={(checked) =>
                        setForm({
                          ...form,
                          marketplaceVisible: checked,
                          marketplaceFeatured:
                            checked && form.marketplaceFeatured,
                        })
                      }
                      title="Publicar online"
                      accent
                    />
                    <label className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.035] p-3 sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={form.marketplaceFeatured}
                        disabled={!canToggleBoost}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            marketplaceFeatured: event.target.checked,
                          })
                        }
                        className="mt-0.5 size-4 accent-amber-300 disabled:opacity-40"
                      />
                      <span>
                        <strong className="flex items-center gap-2 text-sm text-white">
                          <Star className="size-4 text-amber-200" />
                          Destaque Enterprise · 3 dias
                        </strong>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500">
                          {boostHint}
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
                <div className="flex flex-col-reverse gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormOpen(false);
                      setEditing(null);
                      setForm(EMPTY_FORM);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                  >
                    {saving ? 'A guardar…' : 'Guardar produto'}
                  </Button>
                </div>
              </form>
            </CardContent>
              </Card>
            )}
          </DialogContent>
        </Dialog>

        <section aria-live="polite">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold">Catálogo</h2>
              <p className="text-xs text-zinc-500">
                {filtered.length} produto{filtered.length === 1 ? '' : 's'} com
                estes filtros.
              </p>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-500">
              Não encontrámos produtos. Experimenta limpar os filtros ou criar
              um novo.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]"
                >
                  <div className="relative aspect-[4/3] bg-white/[0.03]">
                    {product.image_url ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${product.image_url})` }}
                        role="img"
                        aria-label={product.name}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                        <ImageIcon className="size-10" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {product.marketplace_visible && (
                        <span className="rounded-full border border-emerald-400/20 bg-zinc-950/80 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                          Publicado
                        </span>
                      )}
                      {product.marketplace_featured && (
                        <span className="rounded-full border border-amber-400/20 bg-zinc-950/80 px-2 py-1 text-[10px] font-semibold text-amber-200">
                          Destaque
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <h3 className="font-semibold text-zinc-100">
                        {product.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                        {product.description || 'Sem descrição.'}
                      </p>
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-semibold">
                            {money(product.unit_price)}
                          </span>
                          {product.compare_at_price &&
                          product.compare_at_price > product.unit_price ? (
                            <span className="text-xs text-zinc-600 line-through">
                              {money(product.compare_at_price)}
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={`mt-1 text-[11px] ${product.stock_quantity <= product.low_stock_threshold ? 'text-amber-300' : 'text-zinc-600'}`}
                        >
                          {product.stock_quantity <= product.low_stock_threshold
                            ? 'Stock baixo · '
                            : ''}
                          {product.stock_quantity} em stock
                          {product.category ? ` · ${product.category}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => startEdit(product)}
                          aria-label={`Editar ${product.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => void archive(product)}
                          aria-label={`Arquivar ${product.name}`}
                          className="text-rose-300 hover:text-rose-200"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">{label}</span>
          <Icon className="size-4 text-zinc-600" />
        </div>
        <p className="mt-3 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-[11px] text-zinc-600">{detail}</p>
      </CardContent>
    </Card>
  );
}
function ModeButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-14 rounded-2xl border px-4 text-left transition disabled:opacity-50 ${active ? 'border-emerald-400/25 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}
    >
      <span className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-xl bg-white/[0.05]">
          <Icon
            className={`size-4 ${active ? 'text-emerald-300' : 'text-zinc-500'}`}
          />
        </span>
        <span>
          <span className="block text-xs font-semibold">{title}</span>
          <span className="block text-[11px] text-zinc-600">{description}</span>
        </span>
        {active && <CheckCircle2 className="ml-auto size-4 text-emerald-300" />}
      </span>
    </button>
  );
}
function CheckBox({
  checked,
  onChange,
  title,
  accent,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  accent?: boolean;
  icon?: typeof Star;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs ${accent ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-white/10 bg-white/[0.025]'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {Icon && <Icon className="size-3.5 text-amber-300" />}
      <span>{title}</span>
    </label>
  );
}
