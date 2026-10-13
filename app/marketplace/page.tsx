'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

type Shop = {
  id?: string;
  name: string;
  slug: string | null;
  marketplace_sales_mode?: 'physical_only' | 'physical_and_online';
} | null;
type Product = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  unit_price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  marketplace_featured: boolean;
  marketplace_published_at?: string | null;
  marketplace_featured_until?: string | null;
  updated_at?: string;
  barbershops: Shop | Shop[];
};
type CartItem = Product & { quantity: number };
type FulfillmentMethod = 'pickup' | 'delivery';
type CheckoutForm = {
  name: string;
  email: string;
  phone: string;
  fulfillmentMethod: FulfillmentMethod;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
};

const EMPTY_CHECKOUT: CheckoutForm = {
  name: '',
  email: '',
  phone: '',
  fulfillmentMethod: 'pickup',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
};
const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(value) || 0,
  );
const getShop = (product: Product) =>
  Array.isArray(product.barbershops)
    ? product.barbershops[0]
    : product.barbershops;

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.id === 'string' &&
    typeof item.barbershop_id === 'string' &&
    typeof item.name === 'string' &&
    Number.isFinite(Number(item.unit_price)) &&
    Number.isFinite(Number(item.stock_quantity)) &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    (item.barbershops == null || typeof item.barbershops === 'object')
  );
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [shops, setShops] = useState<
    Array<{ id: string; name: string; slug: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [shopId, setShopId] = useState('');
  const [sort, setSort] = useState('featured');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartRestored, setCartRestored] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [customer, setCustomer] = useState<CheckoutForm>(EMPTY_CHECKOUT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (shopId) params.set('shop', shopId);
      params.set('sort', sort);
      const response = await fetch(
        `/api/marketplace/products?${params.toString()}`,
        { cache: 'no-store' },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(
          json.error || 'Não foi possível carregar o marketplace.',
        );
      setProducts(json.products ?? []);
      setCategories(json.categories ?? []);
      setShops(json.shops ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar o marketplace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialShop = new URLSearchParams(window.location.search).get('shop');
    if (initialShop) setShopId(initialShop);
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('silentra-marketplace-cart');
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setCart(parsed.filter(isStoredCartItem));
      }
    } catch {
      try {
        window.sessionStorage.removeItem('silentra-marketplace-cart');
      } catch {
        // Storage can be disabled by browser privacy settings.
      }
    } finally {
      setCartRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!cartRestored) return;
    try {
      if (cart.length) {
        window.sessionStorage.setItem(
          'silentra-marketplace-cart',
          JSON.stringify(cart),
        );
      } else {
        window.sessionStorage.removeItem('silentra-marketplace-cart');
      }
    } catch {
      // The cart still works for the current page if session storage is unavailable.
    }
  }, [cart, cartRestored]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), q ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [q, category, shopId, sort]);

  useEffect(() => {
    if (loading || !cartRestored) return;
    const url = new URL(window.location.href);
    const productId = url.searchParams.get('add');
    if (!productId) return;

    const requestedProductId = productId;
    const requestedQuantity = Number(url.searchParams.get('qty') ?? '1');
    url.searchParams.delete('add');
    url.searchParams.delete('qty');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);

    async function addRequestedProduct() {
      let product = products.find((item) => item.id === requestedProductId);
      if (!product) {
        try {
          const response = await fetch(
            `/api/marketplace/products?id=${encodeURIComponent(requestedProductId)}`,
            { cache: 'no-store' },
          );
          const json = await response.json();
          if (response.ok && json.product) {
            product = json.product as Product;
            setProducts((current) =>
              current.some((item) => item.id === requestedProductId)
                ? current
                : [...current, product!],
            );
          }
        } catch {
          // The product may have been unpublished or removed since the detail page was opened.
        }
      }

      if (!product || product.stock_quantity <= 0) {
        setError(
          'Este produto já não está disponível para adicionar ao carrinho.',
        );
        return;
      }

      const quantity = Math.min(
        Math.max(
          1,
          Number.isInteger(requestedQuantity) ? requestedQuantity : 1,
        ),
        Number(product.stock_quantity),
      );
      const switchingShop =
        cart.length > 0 && cart[0].barbershop_id !== product.barbershop_id;
      if (
        switchingShop &&
        !window.confirm(
          'O teu carrinho contém produtos de outra barbearia. Para encomendar nesta barbearia, o carrinho atual será substituído. Queres continuar?',
        )
      ) {
        return;
      }

      setCart((current) => {
        if (switchingShop) return [{ ...product!, quantity }];
        const existing = current.find((item) => item.id === product!.id);
        return existing
          ? current.map((item) =>
              item.id === product!.id
                ? {
                    ...item,
                    quantity: Math.min(
                      Number(product!.stock_quantity),
                      item.quantity + quantity,
                    ),
                  }
                : item,
            )
          : [...current, { ...product!, quantity }];
      });
      setCartOpen(true);
    }

    void addRequestedProduct();
  }, [cart, cartRestored, loading, products]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.quantity * Number(item.unit_price),
        0,
      ),
    [cart],
  );
  const count = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const cartShop = cart[0] ? getShop(cart[0]) : null;

  function add(product: Product) {
    const existing = cart.find((item) => item.id === product.id);
    const switchingShop =
      cart.length > 0 && cart[0].barbershop_id !== product.barbershop_id;

    // Each order belongs to one seller. Never discard the current cart silently.
    if (
      switchingShop &&
      !window.confirm(
        'O teu carrinho contém produtos de outra barbearia. Para encomendar nesta barbearia, o carrinho atual será substituído. Queres continuar?',
      )
    ) {
      return;
    }

    if (switchingShop) {
      setCart([productWithQty(product)]);
    } else {
      setCart((current) =>
        existing
          ? current.map((item) =>
              item.id === product.id
                ? {
                    ...item,
                    quantity: Math.min(
                      item.quantity + 1,
                      Number(product.stock_quantity),
                    ),
                  }
                : item,
            )
          : [...current, productWithQty(product)],
      );
    }
    setCustomer((current) => ({ ...current, fulfillmentMethod: 'pickup' }));
    setCartOpen(true);
  }
  function productWithQty(product: Product): CartItem {
    return { ...product, quantity: 1 };
  }
  function change(id: string, delta: number) {
    setCart((current) =>
      current.flatMap((item) =>
        item.id !== id
          ? [item]
          : item.quantity + delta <= 0
            ? []
            : [
                {
                  ...item,
                  quantity: Math.min(
                    item.quantity + delta,
                    Number(item.stock_quantity),
                  ),
                },
              ],
      ),
    );
  }
  function openCheckout() {
    setError('');
    setCheckoutOpen(true);
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!cart.length || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barbershopId: cart[0].barbershop_id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          fulfillmentMethod: customer.fulfillmentMethod,
          shipping: {
            address: customer.address,
            city: customer.city,
            postalCode: customer.postalCode,
            country: 'PT',
          },
          notes: customer.notes,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || 'Não foi possível criar a encomenda.');
      setSubmitted(json.order.id);
      setTrackingToken(
        typeof json.trackingToken === 'string' ? json.trackingToken : null,
      );
      setEmailSent(json.emailSent ?? null);
      setCart([]);
      setCustomer(EMPTY_CHECKOUT);
      setCheckoutOpen(false);
      setCartOpen(false);
      void load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar a encomenda.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href="/"
            className="flex shrink-0 items-center gap-2 font-heading text-lg font-semibold"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-400 text-zinc-950">
              <Sparkles className="size-4" />
            </span>
            Silentra
          </a>
          <div className="mx-auto hidden max-w-xl flex-1 md:block">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                aria-hidden="true"
              />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                aria-label="Pesquisar produtos"
                placeholder="Pesquisar produtos, barbearias e categorias"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/[0.06]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ShoppingBag className="size-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {count > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-zinc-950">
                {count}
              </span>
            )}
          </button>
        </div>
        <div className="px-4 pb-3 md:hidden sm:px-6">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
              aria-hidden="true"
            />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              aria-label="Pesquisar produtos"
              placeholder="Pesquisar produtos, barbearias e categorias"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400/40 focus:bg-white/[0.06]"
            />
          </label>
        </div>
      </header>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_46%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Store className="size-3.5" />
              Produtos das tuas barbearias
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              Leva o teu estilo{' '}
              <span className="text-emerald-300">para casa.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              Encomenda produtos de barbearias que vendem online. A barbearia
              trata diretamente do levantamento ou do envio — a Silentra trata
              do catálogo, stock e fluxo de venda.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShoppingBag,
                  title: 'Encomenda online',
                  text: 'Compra sem trocar mensagens.',
                },
                {
                  icon: PackageCheck,
                  title: 'Stock real',
                  text: 'Só mostramos o que está disponível.',
                },
                {
                  icon: Truck,
                  title: 'Envio pela barbearia',
                  text: 'Sem logística de transporte pela Silentra.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <item.icon className="size-4 text-emerald-300" />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="Filtrar por categoria"
          >
            <FilterPill active={!category} onClick={() => setCategory('')}>
              Todos
            </FilterPill>
            {categories.map((item) => (
              <FilterPill
                key={item}
                active={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </FilterPill>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={shopId}
              onChange={(event) => setShopId(event.target.value)}
              aria-label="Filtrar por barbearia"
              className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm outline-none focus:border-emerald-400/40"
            >
              <option value="">Todas as barbearias</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Ordenar produtos"
                className="min-h-11 w-full appearance-none rounded-xl border border-white/10 bg-zinc-950 px-3 pr-9 text-sm outline-none focus:border-emerald-400/40"
              >
                <option value="featured">Destaques</option>
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Preço: menor</option>
                <option value="price_desc">Preço: maior</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>
        </div>
        {error && !checkoutOpen && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-4 text-sm text-rose-200"
          >
            {error}
          </div>
        )}
        {submitted && (
          <div
            className="mt-5 flex gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4"
            role="status"
          >
            <Check className="mt-0.5 size-5 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <p className="font-semibold">Encomenda criada</p>
              <p className="mt-1 text-sm text-zinc-400">
                Pedido{' '}
                <strong className="text-zinc-200">
                  #{submitted.slice(0, 8)}
                </strong>{' '}
                recebido.{' '}
                {emailSent === false
                  ? 'Não conseguimos enviar o email de confirmação, mas a encomenda ficou registada.'
                  : 'Enviámos o comprovativo para o teu email.'}
              </p>
              {trackingToken && (
                <a
                  href={
                    '/marketplace/track#token=' +
                    encodeURIComponent(trackingToken)
                  }
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15"
                >
                  Acompanhar encomenda <ArrowRight className="size-4" />
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setTrackingToken(null);
              }}
              className="ml-auto shrink-0 text-zinc-600 hover:text-white"
              aria-label="Fechar confirmação"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              Catálogo
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Produtos disponíveis
            </h2>
          </div>
          <span className="text-xs text-zinc-600">
            {loading
              ? 'A carregar…'
              : `${products.length} produto${products.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/[0.025]"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-14 text-center">
            <Search className="mx-auto size-7 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">
              Não encontrámos produtos com estes filtros.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => {
              const productShop = getShop(product);
              const discounted =
                product.compare_at_price != null &&
                product.compare_at_price > product.unit_price;
              return (
                <motion.article
                  key={product.id}
                  layout
                  whileHover={{ y: -3 }}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] transition hover:border-emerald-400/20"
                >
                  <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.02]">
                    {product.image_url ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${product.image_url})` }}
                        role="img"
                        aria-label={product.name}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">
                          <ShoppingBag className="size-7 text-zinc-700" />
                        </span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {product.marketplace_featured && (
                        <span className="rounded-full border border-amber-300/20 bg-zinc-950/75 px-2.5 py-1 text-[10px] font-semibold text-amber-200 backdrop-blur">
                          Destaque
                        </span>
                      )}
                      {discounted && (
                        <span className="rounded-full bg-rose-400 px-2 py-1 text-[10px] font-bold text-zinc-950">
                          -{' '}
                          {Math.round(
                            (1 -
                              product.unit_price / product.compare_at_price!) *
                              100,
                          )}
                          %
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-zinc-950/75 px-2.5 py-1 text-[10px] font-medium text-zinc-300 backdrop-blur">
                      {Number(product.stock_quantity)} em stock
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                      {product.category || 'Produto'}
                    </p>
                    <h3 className="mt-2 min-h-12 text-base font-semibold text-zinc-100">
                      <Link
                        href={`/marketplace/${product.id}`}
                        className="transition hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        {product.name}
                      </Link>
                    </h3>
                    <p className="mt-2 min-h-10 line-clamp-2 text-xs leading-5 text-zinc-500">
                      {product.description ||
                        'Produto selecionado pela tua barbearia.'}
                    </p>
                    <Link
                      href={`/marketplace/${product.id}`}
                      className="mt-3 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-emerald-300 transition hover:text-emerald-200"
                    >
                      Ver detalhes <ArrowRight className="size-3.5" />
                    </Link>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {productShop?.name || 'Barbearia'}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-semibold text-white">
                            {money(product.unit_price)}
                          </span>
                          {discounted && (
                            <span className="text-xs text-zinc-600 line-through">
                              {money(product.compare_at_price!)}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-600">
                          Levantamento ou envio pela barbearia
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => add(product)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-400 px-3 text-xs font-bold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Plus className="size-4" />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setCartOpen(false)}
              aria-label="Fechar carrinho"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 35 }}
              className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                    Carrinho
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    A tua encomenda
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="flex size-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white"
                  aria-label="Fechar carrinho"
                >
                  <X className="size-5" />
                </button>
              </div>
              {!checkoutOpen ? (
                <>
                  <div className="flex-1 overflow-auto p-5">
                    {cart.length === 0 ? (
                      <div className="py-16 text-center">
                        <ShoppingBag className="mx-auto size-8 text-zinc-700" />
                        <p className="mt-4 text-sm text-zinc-500">
                          O carrinho está vazio.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                          >
                            <div className="flex gap-3">
                              <div
                                className="size-16 shrink-0 rounded-xl bg-white/[0.04] bg-cover bg-center"
                                style={
                                  item.image_url
                                    ? {
                                        backgroundImage: `url(${item.image_url})`,
                                      }
                                    : undefined
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {money(item.unit_price)} ·{' '}
                                  {getShop(item)?.name}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => change(item.id, -1)}
                                    className="flex size-8 items-center justify-center rounded-lg border border-white/10 hover:bg-white/5"
                                    aria-label={`Diminuir quantidade de ${item.name}`}
                                  >
                                    <Minus className="size-3" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-semibold">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => change(item.id, 1)}
                                    className="flex size-8 items-center justify-center rounded-lg border border-white/10 hover:bg-white/5"
                                    aria-label={`Aumentar quantidade de ${item.name}`}
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCart((current) =>
                                        current.filter(
                                          (entry) => entry.id !== item.id,
                                        ),
                                      )
                                    }
                                    className="ml-auto flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-rose-400/10 hover:text-rose-300"
                                    aria-label={`Remover ${item.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-white/10 p-5">
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-zinc-500">Total</span>
                      <span className="text-2xl font-semibold">
                        {money(total)}
                      </span>
                    </div>
                    {cartShop && (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-zinc-500">
                        <div className="flex items-center gap-2 text-zinc-200">
                          <Store className="size-3.5 text-emerald-300" />
                          {cartShop.name}
                        </div>
                        <p className="mt-1">
                          O levantamento e o envio são tratados diretamente pela
                          barbearia.
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!cart.length}
                      onClick={openCheckout}
                      className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continuar
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-auto p-5">
                  <form onSubmit={submitOrder} className="space-y-4">
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Clock3 className="size-4 text-emerald-300" />
                        Encomenda rápida
                      </div>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        A encomenda fica imediatamente registada. O pagamento e
                        o envio são tratados diretamente com a barbearia.
                      </p>
                    </div>
                    {[
                      ['name', 'Nome completo', 'text', 'O teu nome'],
                      ['email', 'Email', 'email', 'nome@exemplo.pt'],
                      ['phone', 'Telefone', 'tel', '912 345 678'],
                    ].map(([key, label, type, placeholder]) => (
                      <label key={key} className="grid gap-1.5">
                        <span className="text-xs font-medium text-zinc-300">
                          {label}
                          <span className="text-rose-300"> *</span>
                        </span>
                        <input
                          required
                          type={type}
                          value={customer[key as keyof CheckoutForm] as string}
                          onChange={(event) =>
                            setCustomer((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          placeholder={placeholder}
                          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm outline-none focus:border-emerald-400/40"
                        />
                      </label>
                    ))}
                    <fieldset className="grid gap-2">
                      <legend className="text-xs font-semibold text-zinc-300">
                        Como queres receber?
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition ${customer.fulfillmentMethod === 'pickup' ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}
                        >
                          <input
                            type="radio"
                            name="fulfillment"
                            value="pickup"
                            checked={customer.fulfillmentMethod === 'pickup'}
                            onChange={() =>
                              setCustomer((current) => ({
                                ...current,
                                fulfillmentMethod: 'pickup',
                              }))
                            }
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <Store className="size-4 text-emerald-300" />
                            <span className="text-sm font-semibold">
                              Levantar
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Levantas diretamente na barbearia.
                          </p>
                        </label>
                        <label
                          className={`cursor-pointer rounded-2xl border p-3 transition ${customer.fulfillmentMethod === 'delivery' ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}
                        >
                          <input
                            type="radio"
                            name="fulfillment"
                            value="delivery"
                            checked={customer.fulfillmentMethod === 'delivery'}
                            onChange={() =>
                              setCustomer((current) => ({
                                ...current,
                                fulfillmentMethod: 'delivery',
                              }))
                            }
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <Truck className="size-4 text-emerald-300" />
                            <span className="text-sm font-semibold">
                              Receber
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            A barbearia trata diretamente do envio.
                          </p>
                        </label>
                      </div>
                    </fieldset>
                    {customer.fulfillmentMethod === 'delivery' && (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div>
                          <p className="text-sm font-semibold">
                            Morada de entrega
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Não calculamos portes nem tratamos transportadoras.
                            A barbearia combina contigo os detalhes do envio.
                          </p>
                        </div>
                        <label className="grid gap-1.5">
                          <span className="text-xs font-medium text-zinc-300">
                            Morada *
                          </span>
                          <input
                            required
                            value={customer.address}
                            onChange={(event) =>
                              setCustomer((current) => ({
                                ...current,
                                address: event.target.value,
                              }))
                            }
                            className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm outline-none focus:border-emerald-400/40"
                            placeholder="Rua, porta e andar"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5">
                            <span className="text-xs font-medium text-zinc-300">
                              Código postal *
                            </span>
                            <input
                              required
                              value={customer.postalCode}
                              onChange={(event) =>
                                setCustomer((current) => ({
                                  ...current,
                                  postalCode: event.target.value,
                                }))
                              }
                              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm outline-none focus:border-emerald-400/40"
                              placeholder="1000-001"
                            />
                          </label>
                          <label className="grid gap-1.5">
                            <span className="text-xs font-medium text-zinc-300">
                              Cidade *
                            </span>
                            <input
                              required
                              value={customer.city}
                              onChange={(event) =>
                                setCustomer((current) => ({
                                  ...current,
                                  city: event.target.value,
                                }))
                              }
                              className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm outline-none focus:border-emerald-400/40"
                              placeholder="Lisboa"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-zinc-300">
                        Nota <span className="text-zinc-600">(opcional)</span>
                      </span>
                      <textarea
                        value={customer.notes}
                        onChange={(event) =>
                          setCustomer((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        className="min-h-24 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm outline-none focus:border-emerald-400/40"
                        placeholder="Ex.: enviar depois das 18h"
                      />
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-3 text-xs text-rose-200"
                      >
                        {error}
                      </p>
                    )}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Total</span>
                        <strong className="text-xl">{money(total)}</strong>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                        {customer.fulfillmentMethod === 'delivery' ? (
                          <Truck className="size-3.5" />
                        ) : (
                          <Store className="size-3.5" />
                        )}
                        {customer.fulfillmentMethod === 'delivery'
                          ? 'Envio tratado pela barbearia'
                          : 'Levantamento na barbearia'}
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-50"
                    >
                      {saving ? 'A criar encomenda…' : 'Confirmar encomenda'}
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="min-h-10 w-full text-xs font-semibold text-zinc-500 hover:text-white"
                    >
                      Voltar ao carrinho
                    </button>
                  </form>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition ${active ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:text-zinc-200'}`}
    >
      {children}
    </button>
  );
}
