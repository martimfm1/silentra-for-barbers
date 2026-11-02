import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin, Scissors, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPublicProfileBySlug,
  isValidPublicProfileSlug,
} from '@/lib/barbershops/public-profile';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getData(slug: string) {
  if (!isValidPublicProfileSlug(slug)) return null;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) return null;

  const db = createAdminClient();
  const { data: services } = await db
    .from('services')
    .select('id,name,price,duration,popular')
    .eq('barbershop_id', profile.barbershop_id ?? profile.id)
    .eq('is_active', true)
    .order('popular', { ascending: false })
    .order('name', { ascending: true });

  return { profile, services: services ?? [] };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return {};
  const title = `Serviços e preços | ${data.profile.name}`;
  const description = `Consulta os serviços, preços e horários da ${data.profile.name}. Escolhe o serviço e marca o teu horário online.`;
  return {
    title,
    description,
    alternates: {
      canonical: `/barbershops/${encodeURIComponent(slug)}/vendas`,
    },
  };
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(value) || 0,
  );

export default async function PublicSalesPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();

  const { profile, services } = data;
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_42%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
          <Link
            href={`/barbershops/${slug}`}
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Voltar à barbearia
          </Link>
          <div className="mt-8 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Sparkles className="size-3.5" /> Serviços e preços
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              Escolhe o teu próximo serviço.
            </h1>
            <p className="mt-5 text-base leading-7 text-zinc-400 sm:text-lg">
              Consulta os serviços disponíveis na {profile.name}, compara preços
              e escolhe um horário sem complicações.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm text-zinc-400">
              {profile.city && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4" />
                  {profile.city}
                </span>
              )}
            </div>
            <Link
              href={`/barbershops/${slug}`}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 font-semibold text-zinc-950 transition hover:bg-emerald-300"
            >
              Marcar agora <ArrowRight className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              O que podes marcar
            </p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Serviços disponíveis
            </h2>
          </div>
          <span className="text-sm text-zinc-500">
            {services.length} opções
          </span>
        </div>
        {services.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-zinc-500">
            Ainda não existem serviços publicados.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article
                key={service.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/20 hover:bg-white/[0.035]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <Scissors className="size-4" />
                  </div>
                  {service.popular && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      Mais procurado
                    </span>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{service.name}</h3>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold">
                      {money(Number(service.price))}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {Number(service.duration) || 0} minutos
                    </p>
                  </div>
                  <Link
                    href={`/barbershops/${slug}`}
                    className="inline-flex min-h-10 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-200 hover:bg-white/[0.07]"
                  >
                    Marcar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.05] p-6 sm:p-8 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Pronto para marcar?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Escolhe o serviço, o barbeiro, o dia e a hora. O resto fica
              tratado online.
            </p>
          </div>
          <Link
            href={`/barbershops/${slug}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 font-semibold text-zinc-950 hover:bg-zinc-200 lg:mt-0"
          >
            Escolher horário <ArrowRight className="ml-2 size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
