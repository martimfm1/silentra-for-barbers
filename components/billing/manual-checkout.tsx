'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    description: 'Para barbearias que querem crescer com CRM, automações e marketing.',
    features: ['CRM e clientes', 'Campanhas e automações', 'Fidelização e estatísticas'],
  },
  enterprise: {
    name: 'Barbers Enterprise',
    description: 'Para operações maiores, várias localizações e gestão avançada.',
    features: ['Equipas e localizações', 'POS e stock', 'Permissões e gestão avançada'],
  },
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
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-300">
        <span>{label}{required ? <span className="ml-1 text-emerald-300">*</span> : null}</span>
      </span>
      {children}
      {hint ? <span className="block text-[11px] leading-5 text-zinc-600">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-3.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/35 focus:ring-2 focus:ring-emerald-300/10';

export function ManualCheckout({
  checkoutToken,
  plan,
  interval,
}: {
  checkoutToken: string;
  plan: Plan;
  interval: 'month' | 'year';
}) {
  const router = useRouter();
  const copy = COPY[plan];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState('PT');
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

  const price = useMemo(() => {
    if (plan === 'pro') return interval === 'year' ? '99,00 € / ano' : '9,90 € / mês';
    return interval === 'year' ? '299,00 € / ano' : '29,90 € / mês';
  }, [interval, plan]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/billing/manual-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          checkoutToken,
          details: { ...form, country },
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(
        typeof body?.error === 'string'
          ? body.error
          : 'Não foi possível enviar o pedido.',
      );

      router.replace(body.redirectUrl || '/dashboard/billing?manual=pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/plans" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-white">
          <ArrowLeft className="size-3.5" /> Voltar aos planos
        </Link>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:p-7 lg:sticky lg:top-6">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              <Sparkles className="size-5" />
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              Manual checkout
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">{copy.name}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{copy.description}</p>

            <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/70">Plano selecionado</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="text-sm text-zinc-300">{interval === 'year' ? 'Faturação anual' : 'Faturação mensal'}</span>
                <span className="text-xl font-semibold text-white">{price}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3 border-t border-white/8 pt-5">
              {copy.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Check className="size-4 shrink-0 text-emerald-300" /> {feature}
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Pagamento manual e seguro</p>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                    Estes dados são usados pela equipa para preparar a faturação e enviar o método de pagamento.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <form onSubmit={submit} className="space-y-4">
            <header className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-zinc-950">1</span>
                Pedido de subscrição
                <ArrowRight className="size-3.5" />
                <span className="text-zinc-700">Pagamento</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                Conta-nos como devemos faturar a tua barbearia.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Preenche estes dados uma única vez. Depois analisamos o pedido e enviamos-te por email as instruções ou o link de pagamento.
              </p>
            </header>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300"><Building2 className="size-4" /></div>
                <div><h2 className="text-sm font-semibold text-white">Dados da barbearia</h2><p className="text-xs text-zinc-600">Informação que ajuda a preparar a subscrição.</p></div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nome da empresa / barbearia" required>
                  <input className={inputClass} required maxLength={160} value={form.billingName} onChange={(e) => set('billingName', e.target.value)} placeholder="Ex.: Barbearia Martim" autoComplete="organization" />
                </Field>
                <Field label="NIF / VAT ID" hint="Opcional, mas recomendado para faturação.">
                  <input className={inputClass} maxLength={40} value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="Ex.: PT123456789" autoComplete="tax-id" />
                </Field>
                <Field label="Tipo de negócio">
                  <select className={inputClass} value={form.businessType} onChange={(e) => set('businessType', e.target.value)}>
                    <option value="">Selecionar</option><option value="barbershop">Barbearia</option><option value="salon">Salão</option><option value="barbershop_salon">Barbearia + salão</option><option value="other">Outro</option>
                  </select>
                </Field>
                <Field label="Website" hint="Opcional.">
                  <input className={inputClass} type="url" maxLength={300} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." autoComplete="url" />
                </Field>
                <Field label="Número de localizações" hint="Ajuda-nos a enquadrar o plano.">
                  <input className={inputClass} type="number" min={1} max={10000} value={form.locationCount} onChange={(e) => set('locationCount', e.target.value)} placeholder="1" inputMode="numeric" />
                </Field>
                <Field label="Elementos da equipa" hint="Aproximado.">
                  <input className={inputClass} type="number" min={1} max={100000} value={form.teamSize} onChange={(e) => set('teamSize', e.target.value)} placeholder="5" inputMode="numeric" />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300"><MapPin className="size-4" /></div>
                <div><h2 className="text-sm font-semibold text-white">Dados de faturação</h2><p className="text-xs text-zinc-600">Onde devemos associar a faturação.</p></div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Email de faturação" required>
                  <input className={inputClass} required type="email" maxLength={254} value={form.billingEmail} onChange={(e) => set('billingEmail', e.target.value)} placeholder="faturacao@empresa.pt" autoComplete="email" />
                </Field>
                <Field label="Telefone" required>
                  <input className={inputClass} required type="tel" maxLength={40} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+351 912 345 678" autoComplete="tel" />
                </Field>
                <div className="sm:col-span-2"><Field label="Morada" required><input className={inputClass} required maxLength={200} value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="Rua, número e complemento" autoComplete="street-address" /></Field></div>
                <Field label="Complemento"><input className={inputClass} maxLength={200} value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Andar, porta, etc." autoComplete="address-line2" /></Field>
                <Field label="Código postal" required><input className={inputClass} required maxLength={30} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} placeholder="4000-000" autoComplete="postal-code" /></Field>
                <Field label="Cidade" required><input className={inputClass} required maxLength={100} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Porto" autoComplete="address-level2" /></Field>
                <Field label="País" required>
                  <select className={inputClass} required value={country} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.018] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300"><MessageSquare className="size-4" /></div>
                <div><h2 className="text-sm font-semibold text-white">Informação adicional</h2><p className="text-xs text-zinc-600">Opcional — deixa qualquer contexto útil para a equipa.</p></div>
              </div>
              <textarea className={inputClass + ' mt-6 min-h-32 resize-y py-3.5'} maxLength={2000} value={form.customerMessage} onChange={(e) => set('customerMessage', e.target.value)} placeholder="Ex.: temos duas localizações, precisamos de faturação para a empresa e queremos ativar o POS…" />
            </section>

            {error ? <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm leading-6 text-red-200">{error}</div> : null}

            <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.04] p-5 sm:p-6">
              <div className="flex gap-3">
                <Users className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">O que acontece depois?</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Recebemos o teu pedido, validamos os dados e a equipa envia o link ou as instruções de pagamento para o email indicado.</p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 z-20 -mx-4 border-t border-white/8 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
              <button type="submit" disabled={submitting} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 shadow-[0_14px_40px_rgba(52,211,153,0.12)] transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60">
                {submitting ? 'A enviar pedido…' : 'Enviar pedido de subscrição'}
                {!submitting ? <ArrowRight className="size-4" /> : null}
              </button>
              <p className="mt-2 text-center text-[11px] leading-5 text-zinc-600">
                Ao enviar, confirmas que os dados fornecidos são corretos e podem ser usados para processar a tua subscrição.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
