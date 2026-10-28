'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import type { ManualPricingQuote } from '@/lib/billing/manual-promotions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const COPY = {
  pro: {
    name: 'Barbers Pro',
    description:
      'Para barbearias que querem crescer com CRM, automações e marketing.',
    features: [
      'CRM e clientes',
      'Campanhas e automações',
      'Fidelização e estatísticas',
    ],
  },
  enterprise: {
    name: 'Barbers Enterprise',
    description:
      'Para operações maiores, várias localizações e gestão avançada.',
    features: [
      'Equipas e localizações',
      'POS e stock',
      'Permissões e gestão avançada',
    ],
  },
} as const;

const COPY_EN = {
  pro: { name: 'Barbers Pro', description: 'For barbershops ready to grow with CRM, automation and marketing.', features: ['CRM and customers', 'Campaigns and automation', 'Loyalty and analytics'] },
  enterprise: { name: 'Barbers Enterprise', description: 'For larger operations, multiple locations and advanced management.', features: ['Teams and locations', 'POS and inventory', 'Advanced permissions and management'] },
} as const;

type Plan = keyof typeof COPY;

const countries = [
  ['PT', 'Portugal'],
  ['ES', 'Espanha'],
  ['FR', 'França'],
  ['DE', 'Alemanha'],
  ['GB', 'Reino Unido'],
  ['BR', 'Brasil'],
  ['AO', 'Angola'],
  ['CH', 'Suíça'],
  ['US', 'Estados Unidos'],
] as const;

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-300">
        <span>
          {label}
          {required ? <span className="ml-1 text-emerald-300">*</span> : null}
        </span>
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] leading-5 text-zinc-600">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  'min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/10';

function formatMoney(amount: number, currency = 'EUR', locale = 'pt-PT') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ManualCheckout({
  checkoutToken,
  plan,
  interval,
  initialPricing,
}: {
  checkoutToken: string;
  plan: Plan;
  interval: 'month' | 'year';
  initialPricing: ManualPricingQuote;
}) {
  const router = useRouter();
  const { locale } = useLanguage();
  const english = locale === 'en';
  const copy = english ? COPY_EN[plan] : COPY[plan];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState('PT');
  const [pricing, setPricing] = useState(initialPricing);
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotionCode, setAppliedPromotionCode] = useState<
    string | null
  >(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    billingName: '',
    taxId: '',
    billingEmail: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    website: '',
    businessType: '',
    locationCount: '',
    teamSize: '',
    customerMessage: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function applyPromotion() {
    const code = promotionCode.trim();
    setPromotionError(null);
    setPromotionMessage(null);

    if (!code) {
      setPricing(initialPricing);
      setAppliedPromotionCode(null);
      setPromotionCode('');
      return;
    }

    setPromotionLoading(true);
    try {
      const response = await fetch('/api/billing/manual-promotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({ checkoutToken, promotionCode: code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.pricing) {
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : english ? 'Could not validate the promo code.' : english ? 'Could not validate the promo code.' : 'Não foi possível validar o código promocional.', 
        );
      }

      const quote = body.pricing as ManualPricingQuote;
      setPricing(quote);
      setAppliedPromotionCode(quote.promotionCode);
      setPromotionCode(quote.promotionCode ?? '');
      setPromotionMessage(
        quote.discountAmount > 0
          ? (english ? `Code ${quote.promotionCode} applied: ${quote.discountDescription}.` : `Código ${quote.promotionCode} aplicado: ${quote.discountDescription}.`)
          : (english ? 'This code does not change the plan price.' : 'Este código não altera o preço do plano.'),
      );
    } catch (err) {
      setPricing(initialPricing);
      setAppliedPromotionCode(null);
      setPromotionError(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o código promocional.',
      );
    } finally {
      setPromotionLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (
      promotionCode.trim() &&
      promotionCode.trim().toUpperCase() !== appliedPromotionCode
    ) {
      setError(
        english ? 'Apply the promo code or clear the field before continuing.' : 'Aplica o código promocional ou limpa o campo antes de continuar.', 
      );
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/billing/manual-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          checkoutToken,
          promotionCode: appliedPromotionCode,
          details: { ...form, country },
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : english ? 'Could not submit the request.' : 'Não foi possível enviar o pedido.', 
        );

      router.replace(body.redirectUrl || '/dashboard/billing?manual=pending');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : english ? 'Could not submit the request.' : 'Não foi possível enviar o pedido.',
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/plans"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> {english ? 'Back to plans' : 'Voltar aos planos'}
        </Link>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:p-7 lg:sticky lg:top-6">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              <Sparkles className="size-5" />
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              {english ? 'Manual checkout' : 'Pagamento manual'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
              {copy.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {copy.description}
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
                {english ? 'Selected plan' : 'Plano selecionado'}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-sm text-zinc-300">
                  {interval === 'year' ? (english ? 'Annual billing' : 'Faturação anual') : (english ? 'Monthly billing' : 'Faturação mensal')}
                </span>
                <div className="text-right">
                  {pricing.discountAmount > 0 ? (
                    <p className="text-xs text-zinc-500 line-through">
                      {formatMoney(pricing.originalPrice, 'EUR', english ? 'en-GB' : 'pt-PT')} /{' '}
                      {interval === 'year' ? (english ? 'year' : 'ano') : (english ? 'month' : 'mês')}
                    </p>
                  ) : null}
                  <p className="text-xl font-semibold text-white">
                    {formatMoney(pricing.finalPrice, 'EUR', english ? 'en-GB' : 'pt-PT')} /{' '}
                    {interval === 'year' ? (english ? 'year' : 'ano') : (english ? 'month' : 'mês')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-white/8 pt-5">
              {copy.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2.5 text-sm text-zinc-300"
                >
                  <Check className="size-4 shrink-0 text-emerald-300" />{' '}
                  {feature}
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">
                    {english ? 'Secure manual payment' : 'Pagamento manual e seguro'}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                    {english ? 'The team uses these details to prepare billing and send you the payment method.' : 'Estes dados são usados pela equipa para preparar a faturação e enviar o método de pagamento.'}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <form onSubmit={submit} className="space-y-4">
            <header className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-zinc-950">
                  1
                </span>
                {english ? 'Subscription request' : 'Pedido de subscrição'}
                <ArrowRight className="size-3.5" />
                <span className="text-zinc-700">{english ? 'Payment' : 'Pagamento'}</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                {english ? 'Tell us how to bill your barbershop.' : 'Conta-nos como devemos faturar a tua barbearia.'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                {english ? 'Fill in these details once. We will review your request and email you payment instructions or a payment link.' : 'Preenche estes dados uma única vez. Depois analisamos o pedido e enviamos-te por email as instruções ou o link de pagamento.'}
              </p>
            </header>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {english ? 'Barbershop details' : 'Dados da barbearia'}
                  </h2>
                  <p className="text-xs text-zinc-600">
                    {english ? 'Information to help prepare your subscription.' : 'Informação que ajuda a preparar a subscrição.'}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label={english ? 'Company / barbershop name' : 'Nome da empresa / barbearia'} required>
                  <input
                    className={inputClass}
                    required
                    maxLength={160}
                    value={form.billingName}
                    onChange={(e) => set('billingName', e.target.value)}
                    placeholder={english ? 'e.g. Martim Barbershop' : 'Ex.: Barbearia Martim'}
                    autoComplete="organization"
                  />
                </Field>
                <Field
                  label="NIF / VAT ID"
                  hint={english ? 'Optional, but recommended for invoicing.' : 'Opcional, mas recomendado para faturação.'}
                >
                  <input
                    className={inputClass}
                    maxLength={40}
                    value={form.taxId}
                    onChange={(e) => set('taxId', e.target.value)}
                    placeholder={english ? 'e.g. PT123456789' : 'Ex.: PT123456789'}
                    autoComplete="tax-id"
                  />
                </Field>
                <Field label={english ? 'Business type' : 'Tipo de negócio'}>
                  <select
                    className={inputClass}
                    value={form.businessType}
                    onChange={(e) => set('businessType', e.target.value)}
                  >
                    <option value="">{english ? 'Select' : 'Selecionar'}</option>
                    <option value="barbershop">{english ? 'Barbershop' : 'Barbearia'}</option>
                    <option value="salon">{english ? 'Salon' : 'Salão'}</option>
                    <option value="barbershop_salon">{english ? 'Barbershop + salon' : 'Barbearia + salão'}</option>
                    <option value="other">{english ? 'Other' : 'Outro'}</option>
                  </select>
                </Field>
                <Field label="Website" hint={english ? 'Optional.' : 'Opcional.'}>
                  <input
                    className={inputClass}
                    type="url"
                    maxLength={300}
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://..."
                    autoComplete="url"
                  />
                </Field>
                <Field
                  label={english ? 'Number of locations' : 'Número de localizações'}
                  hint={english ? 'Helps us understand your plan needs.' : 'Ajuda-nos a enquadrar o plano.'}
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={10000}
                    value={form.locationCount}
                    onChange={(e) => set('locationCount', e.target.value)}
                    placeholder="1"
                    inputMode="numeric"
                  />
                </Field>
                <Field label={english ? 'Team size' : 'Elementos da equipa'} hint={english ? 'Approximate.' : 'Aproximado.'}>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={100000}
                    value={form.teamSize}
                    onChange={(e) => set('teamSize', e.target.value)}
                    placeholder="5"
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {english ? 'Billing details' : 'Dados de faturação'}
                  </h2>
                  <p className="text-xs text-zinc-600">
                    {english ? 'Where billing should be associated.' : 'Onde devemos associar a faturação.'}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label={english ? 'Billing email' : 'Email de faturação'} required>
                  <input
                    className={inputClass}
                    required
                    type="email"
                    maxLength={254}
                    value={form.billingEmail}
                    onChange={(e) => set('billingEmail', e.target.value)}
                    placeholder={english ? 'billing@company.com' : 'faturacao@empresa.pt'}
                    autoComplete="email"
                  />
                </Field>
                <Field label={english ? 'Phone number' : 'Telefone'} required>
                  <input
                    className={inputClass}
                    required
                    type="tel"
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+351 912 345 678"
                    autoComplete="tel"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={english ? 'Address' : 'Morada'} required>
                    <input
                      className={inputClass}
                      required
                      maxLength={200}
                      value={form.addressLine1}
                      onChange={(e) => set('addressLine1', e.target.value)}
                      placeholder={english ? 'Street, number and unit' : 'Rua, número e complemento'}
                      autoComplete="street-address"
                    />
                  </Field>
                </div>
                <Field label={english ? 'Address line 2' : 'Complemento'}>
                  <input
                    className={inputClass}
                    maxLength={200}
                    value={form.addressLine2}
                    onChange={(e) => set('addressLine2', e.target.value)}
                    placeholder={english ? 'Floor, unit, etc.' : 'Andar, porta, etc.'}
                    autoComplete="address-line2"
                  />
                </Field>
                <Field label={english ? 'Postal code' : 'Código postal'} required>
                  <input
                    className={inputClass}
                    required
                    maxLength={30}
                    value={form.postalCode}
                    onChange={(e) => set('postalCode', e.target.value)}
                    placeholder="4000-000"
                    autoComplete="postal-code"
                  />
                </Field>
                <Field label={english ? 'City' : 'Cidade'} required>
                  <input
                    className={inputClass}
                    required
                    maxLength={100}
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Porto"
                    autoComplete="address-level2"
                  />
                </Field>
                <Field label={english ? 'Country' : 'País'} required>
                  <select
                    className={inputClass}
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {countries.map(([code, name]) => (
                      <option key={code} value={code}>
                        {english ? ({ PT: 'Portugal', ES: 'Spain', FR: 'France', DE: 'Germany', GB: 'United Kingdom', BR: 'Brazil', AO: 'Angola', CH: 'Switzerland', US: 'United States' }[code] ?? name) : name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section
              className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.025] p-5 sm:p-7"
              aria-label={english ? 'Promo code' : 'Código promocional'}
            >
              <h2 className="text-sm font-semibold text-white">
                {english ? 'Promo code' : 'Código promocional'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {english ? 'Enter a valid code to automatically update the total shown.' : 'Introduz um código válido para atualizar automaticamente o total apresentado.'}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  className={inputClass}
                  value={promotionCode}
                  maxLength={100}
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label={english ? 'Promo code' : 'Código promocional'}
                  placeholder={english ? 'e.g. WELCOME10' : 'Ex.: WELCOME10'}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPromotionCode(value);
                    setPromotionError(null);
                    setPromotionMessage(null);
                    if (appliedPromotionCode) {
                      setAppliedPromotionCode(null);
                      setPricing(initialPricing);
                    }
                  }}
                />
                <button
            aria-label="Continuar checkout manual"
                  type="button"
                  onClick={() => void applyPromotion()}
                  disabled={promotionLoading || submitting}
                  className="min-h-12 shrink-0 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-wait disabled:opacity-60"
                >
                  {promotionLoading ? (english ? 'Validating…' : 'A validar…') : (english ? 'Apply code' : 'Aplicar código')}
                </button>
              </div>
              {promotionError ? (
                <p role="alert" className="mt-3 text-xs leading-5 text-red-300">
                  {promotionError}
                </p>
              ) : null}
              {promotionMessage ? (
                <p
                  role="status"
                  className="mt-3 text-xs leading-5 text-emerald-200"
                >
                  {promotionMessage}
                </p>
              ) : null}
              {pricing.discountAmount > 0 ? (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                  <span className="text-zinc-400">{english ? 'Discount applied' : 'Desconto aplicado'}</span>
                  <span className="font-semibold text-emerald-200">
                    −{formatMoney(pricing.discountAmount, 'EUR', english ? 'en-GB' : 'pt-PT')}
                  </span>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {english ? 'Additional information' : 'Informação adicional'}
                  </h2>
                  <p className="text-xs text-zinc-600">
                    {english ? 'Optional — share any useful context with the team.' : 'Opcional — deixa qualquer contexto útil para a equipa.'}
                  </p>
                </div>
              </div>
              <textarea
                className={inputClass + ' mt-6 min-h-32 resize-y py-3.5'}
                maxLength={2000}
                value={form.customerMessage}
                onChange={(e) => set('customerMessage', e.target.value)}
                placeholder={english ? 'e.g. We have two locations, need company invoicing and want to enable POS…' : 'Ex.: temos duas localizações, precisamos de faturação para a empresa e queremos ativar o POS…'}
              />
            </section>

            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm leading-6 text-red-200"
              >
                {error}
              </div>
            ) : null}

            <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.04] p-5 sm:p-6">
              <div className="flex gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {english ? 'What happens next?' : 'O que acontece depois?'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {english ? 'We receive your request, validate the details and send a payment link or instructions to the email you provided.' : 'Recebemos o teu pedido, validamos os dados e a equipa envia o link ou as instruções de pagamento para o email indicado.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/8 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 shadow-[0_14px_40px_rgba(52,211,153,0.12)] transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting
                  ? (english ? 'Sending request…' : 'A enviar pedido…')
                  : (english ? 'Submit subscription request' : 'Enviar pedido de subscrição')}
                {!submitting ? <ArrowRight className="size-4" /> : null}
              </button>
              <p className="mt-2 text-center text-[11px] leading-5 text-zinc-600">
                {english ? 'By submitting, you confirm the details are accurate and may be used to process your subscription.' : 'Ao enviar, confirmas que os dados fornecidos são corretos e podem ser usados para processar a tua subscrição.'}
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
