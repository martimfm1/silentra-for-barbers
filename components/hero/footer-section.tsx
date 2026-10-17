'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function FooterSection() {
  const { locale } = useLanguage();
  const pt = locale === 'pt';

  return (
    <footer className="relative overflow-hidden lg:rounded-3xl lg:ml-12 lg:mr-12 lg:mb-12 border border-white/10 bg-zinc-900/70 px-6 py-8 backdrop-blur-xl sm:px-8 sm:py-10 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_22%)]" />

      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-zinc-300">
            <Sparkles className="size-3.5 text-emerald-300" />
            Silentra for barbers
          </div>
          <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tighter text-zinc-50 sm:text-4xl">
            {pt ? 'Um SaaS feito para transformar marcações em fluxo, e fluxo em receita.' : 'A SaaS that turns bookings into momentum, and momentum into revenue.'}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            {pt ? 'Agenda, confirmações, lembretes e gestão da barbearia num produto que simplifica o trabalho e deixa o cliente avançar sem fricção.' : 'Appointments, confirmations, reminders and barbershop management in one place, making every visit easier from start to finish.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              {pt ? 'Produto' : 'Product'}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-zinc-300">
              <Link
                href="/software-gestao-barbearia"
                className="transition-colors hover:text-zinc-50"
              >
                {pt ? 'Software de gestão para barbearias' : 'Barbershop management software'}
              </Link>
              <Link
                href="/barbershops"
                className="transition-colors hover:text-zinc-50"
              >
                {pt ? 'Encontrar barbearias' : 'Find barbershops'}
              </Link>
              <Link
                href="/onboarding"
                className="transition-colors hover:text-zinc-50"
              >
                {pt ? 'Criar espaço' : 'Create a workspace'}
              </Link>
              <Link
                href="/login"
                className="transition-colors hover:text-zinc-50"
              >
                {pt ? 'Entrar' : 'Sign in'}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              {pt ? 'Contacto' : 'Contact'}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-zinc-300">
              <a
                href="mailto:silentra.contact@gmail.com"
                className="transition-colors hover:text-zinc-50"
              >
                silentra.contact@gmail.com
              </a>
              <a
                href="https://discord.gg/PwHWWyrGxe"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-zinc-50"
              >
                Discord
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © 2026{' '}
          <a
            href="https://silentra.me/"
            className="transition-colors hover:text-zinc-300"
          >
            Silentra
          </a>
          {pt ? '. Feito para barbearias modernas.' : '. Built for modern barbershops.'}
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="transition-colors hover:text-zinc-300">
            {pt ? 'Termos' : 'Terms'}
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-zinc-300"
          >
            {pt ? 'Privacidade' : 'Privacy'}
          </Link>
          <Link
            href="/registo"
            className="transition-colors hover:text-zinc-300"
          >
            {pt ? 'Começar grátis' : 'Start free'}
          </Link>
        </div>
      </div>
    </footer>
  );
}
