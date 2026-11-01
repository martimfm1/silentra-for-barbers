'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  LockKeyhole,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const groups = [
  {
    title: { pt: 'Usar a plataforma', en: 'Using the platform' },
    description: { pt: 'Regras gerais para contas, equipas e utilização do serviço.', en: 'General rules for accounts, teams, and use of the service.' },
    icon: BookOpen,
    links: [
      { href: '/terms', title: { pt: 'Termos e Condições', en: 'Terms and Conditions' }, description: { pt: 'O contrato de utilização da Silentra for Barbers.', en: 'The agreement for using Silentra for Barbers.' } },
      { href: '/acceptable-use', title: { pt: 'Utilização Aceitável', en: 'Acceptable Use' }, description: { pt: 'Segurança, acessos, dados, conteúdos e comportamentos proibidos.', en: 'Security, access, data, content, and prohibited conduct.' } },
      { href: '/billing-policy', title: { pt: 'Política de Faturação', en: 'Billing Policy' }, description: { pt: 'Planos, pagamentos, renovação, cancelamento e reembolsos.', en: 'Plans, payments, renewals, cancellations, and refunds.' } },
    ],
  },
  {
    title: { pt: 'Fazer uma reserva', en: 'Making a booking' },
    description: { pt: 'Informação para clientes que marcam um serviço numa barbearia.', en: 'Information for customers booking a service at a barbershop.' },
    icon: CalendarDays,
    links: [
      { href: '/booking-terms', title: { pt: 'Política de Reservas', en: 'Booking Policy' }, description: { pt: 'Confirmação, cancelamentos, MB WAY e responsabilidades da barbearia.', en: 'Confirmation, cancellations, MB WAY, and barbershop responsibilities.' } },
    ],
  },
  {
    title: { pt: 'Dados e privacidade', en: 'Data and privacy' },
    description: { pt: 'Como são tratados dados pessoais e como podes gerir as tuas escolhas.', en: 'How personal data is processed and how you can manage your choices.' },
    icon: LockKeyhole,
    links: [
      { href: '/privacy', title: { pt: 'Política de Privacidade', en: 'Privacy Policy' }, description: { pt: 'Dados tratados, finalidades, direitos e conservação.', en: 'Data processed, purposes, rights, and retention.' } },
      { href: '/cookies', title: { pt: 'Política de Cookies', en: 'Cookie Policy' }, description: { pt: 'Tecnologias necessárias, estatísticas, marketing e preferências.', en: 'Necessary technologies, analytics, marketing, and preferences.' } },
      { href: '/dpa', title: { pt: 'Adenda de Tratamento de Dados (DPA)', en: 'Data Processing Addendum (DPA)' }, description: { pt: 'Condições de tratamento quando a Silentra atua por conta da barbearia.', en: 'Processing terms when Silentra acts on behalf of a barbershop.' } },
      { href: '/subprocessors', title: { pt: 'Lista de Subprocessadores', en: 'Subprocessor List' }, description: { pt: 'Fornecedores tecnológicos e finalidades do respetivo acesso a dados.', en: 'Technology providers and why they may access data.' } },
    ],
  },
];

export function LegalCentrePage() {
  const { locale } = useLanguage();
  const active = locale === 'en' ? 'en' : 'pt';

  return (
    <main className="min-h-screen bg-[#09090b] px-4 pb-16 pt-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 hover:bg-white/[0.08] hover:text-white">
          {active === 'pt' ? 'Voltar ao site' : 'Back to website'}
        </Link>
        <header className="mt-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
            Silentra for Barbers
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {active === 'pt' ? 'Centro Legal' : 'Legal Centre'}
          </h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
            {active === 'pt'
              ? 'Encontra aqui os termos, políticas e informação sobre os dados e serviços da plataforma. Escolhe o documento que corresponde à tua utilização.'
              : 'Find the terms, policies, and information about the platform’s data and services here. Choose the document relevant to how you use the service.'}
          </p>
        </header>

        <div className="mt-9 space-y-7">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.title.pt} className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/[0.07] text-violet-200">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{group.title[active]}</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{group.description[active]}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex min-h-28 items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-violet-300/30 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-zinc-100 group-hover:text-white">
                          {link.title[active]}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-zinc-400">
                          {link.description[active]}
                        </span>
                      </span>
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-zinc-500 group-hover:text-violet-200" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-7 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/55 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {active === 'pt' ? 'Precisas de ajuda?' : 'Need help?'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {active === 'pt' ? 'Para dúvidas legais ou pedidos de privacidade, escreve-nos.' : 'For legal questions or privacy requests, contact us.'}
            </p>
          </div>
          <a href="mailto:contact.silentra@gmail.com" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white hover:bg-white/[0.1]">
            contact.silentra@gmail.com
          </a>
        </section>
      </div>
    </main>
  );
}
