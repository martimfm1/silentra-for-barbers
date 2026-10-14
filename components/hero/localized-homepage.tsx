'use client';

import Link from 'next/link';
import { TrackedMarketingLink } from '@/components/marketing/tracked-marketing-link';
import { useLanguage } from '@/context/LanguageContext';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  Mail,
  MapPin,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
} from 'lucide-react';
import { motion } from 'motion/react';

const featureIcons = [
  CalendarDays,
  UsersRound,
  Gift,
  BarChart3,
  Mail,
  QrCode,
  ShieldCheck,
  Store,
];

export function LocalizedHomepage() {
  const { locale } = useLanguage();
  const pt = locale === 'pt';

  const copy = pt
    ? {
        eyebrow: 'Silentra for Barbers',
        heroTitle: 'A barbearia inteira. Num só lugar.',
        heroText:
          'Marcações, clientes, equipa, fidelização e crescimento numa plataforma simples para quem reserva e poderosa para quem gere.',
        barberCta: 'Criar barbearia grátis',
        customerCta: 'Encontrar uma barbearia',
        freeNote: 'Plano Free disponível',
        noCard: 'Sem cartão para começar',
        noAccount: 'Clientes podem reservar sem conta',
        demoTitle: 'A experiência do cliente',
        available: 'Disponível',
        service: 'Serviço',
        time: 'Horário',
        summary: 'Resumo',
        book: 'Reservar',
        shop: 'Barbearia Silentra',
        bookingFlow: 'Escolhe. Reserva. Recebe confirmação.',
        customerTitle: 'Para clientes: menos fricção.',
        customerText:
          'Encontra uma barbearia, vê serviços, horários, avaliações e localização. Reserva pelo browser e gere as tuas marcações por email.',
        explore: 'Explorar barbearias',
        customerItems: [
          'Marketplace de barbearias',
          'Página pública com serviços e equipa',
          'Reservas sem criar conta',
          'Confirmações e lembretes por email',
          'Reagendamento e cancelamento',
          'Google / Apple Calendar',
          'Google / Apple Maps',
          'Fidelização, pontos e recompensas',
        ],
        barberTitle: 'Para barbeiros: uma operação inteira.',
        barberText:
          'Controla a agenda, equipa e clientes. Automatiza comunicação. Mantém os clientes a voltar. E acompanha o negócio com dados reais.',
        start: 'Começar agora',
        barberItems: [
          'Agenda e marcações',
          'Serviços, duração e disponibilidade',
          'Clientes e histórico',
          'Equipa e roles com permissões',
          'Página pública da barbearia',
          'QR code para reservas',
          'Fidelização e recompensas',
          'Avaliações de clientes',
          'Emails e confirmações',
          'Mensagens e automações',
          'Campanhas e aniversários',
          'Estatísticas e analytics',
          'Localização e presença pública',
          'Faturação e subscrição',
          'Módulos de crescimento e POS',
        ],
        allInOneEyebrow: 'Tudo ligado',
        allInOneTitle: 'Da primeira visita ao cliente recorrente.',
        allInOneText:
          'A Silentra liga aquisição, reserva, operação e retenção. O cliente tem uma experiência simples; a barbearia tem controlo sobre o que acontece depois.',
        flow: [
          'Descobrir',
          'Reservar',
          'Confirmar',
          'Atender',
          'Fidelizar',
          'Voltar',
        ],
        modulesEyebrow: 'Plataforma',
        modulesTitle: 'Tudo o que precisas para operar e crescer.',
        modules: [
          [
            'Agenda',
            'Marcações, disponibilidade, conflitos, duração, pausas e bloqueios.',
          ],
          [
            'Clientes',
            'Histórico, contactos, notas e contexto para atender melhor.',
          ],
          [
            'Equipa',
            'Owner, admin, manager, barber, receptionist e staff com permissões ligadas à barbearia.',
          ],
          [
            'Presença',
            'Página pública, marketplace, localização, avaliações e QR para captar reservas.',
          ],
          [
            'Fidelização',
            'Pontos, recompensas, transações, resgates e recuperação de vouchers ativos.',
          ],
          [
            'Automação',
            'Emails, confirmações, lembretes, aniversários e workflows sem trabalho manual.',
          ],
          [
            'Analytics',
            'Métricas da operação, clientes, marcações e evolução do negócio.',
          ],
          [
            'Crescimento',
            'Campanhas, mensagens, módulos premium, faturação e ferramentas preparadas para escalar.',
          ],
        ],
        securityTitle: 'Construída para ser usada todos os dias.',
        securityText:
          'Permissões server-side, isolamento por barbearia, validações críticas e observabilidade de produção fazem parte da plataforma.',
        proTitle: 'Uma experiência profissional para os dois lados.',
        proText:
          'Não precisas de escolher entre simplicidade para o cliente e controlo para a barbearia. A Silentra foi desenhada para os dois.',
        finalTitle: 'Menos tarefas. Mais clientes a voltar.',
        finalText:
          'Cria a tua barbearia gratuitamente ou encontra a próxima marcação.',
        finalBarber: 'Criar barbearia',
        finalCustomer: 'Encontrar barbearia',
      }
    : {
        eyebrow: 'Silentra for Barbers',
        heroTitle: 'Your whole barbershop. One place.',
        heroText:
          'Bookings, customers, team, loyalty and growth in one platform — simple for the person booking, powerful for the person running the shop.',
        barberCta: 'Create a free barbershop',
        customerCta: 'Find a barbershop',
        freeNote: 'Free plan available',
        noCard: 'No card required',
        noAccount: 'Customers can book without an account',
        demoTitle: 'The customer experience',
        available: 'Available',
        service: 'Service',
        time: 'Time',
        summary: 'Summary',
        book: 'Book',
        shop: 'Silentra Barbershop',
        bookingFlow: 'Choose. Book. Get confirmation.',
        customerTitle: 'For customers: less friction.',
        customerText:
          'Find a barbershop, browse services, times, reviews and location. Book in the browser and manage appointments by email.',
        explore: 'Explore barbershops',
        customerItems: [
          'Barbershop marketplace',
          'Public page with services and team',
          'Book without an account',
          'Email confirmations and reminders',
          'Reschedule and cancel',
          'Google / Apple Calendar',
          'Google / Apple Maps',
          'Loyalty, points and rewards',
        ],
        barberTitle: 'For barbers: the whole operation.',
        barberText:
          'Run the schedule, team and customer base. Automate communication. Keep people coming back. Track the business with real data.',
        start: 'Get started',
        barberItems: [
          'Schedule and bookings',
          'Services, duration and availability',
          'Customers and history',
          'Team roles and permissions',
          'Public barbershop page',
          'QR code for bookings',
          'Loyalty and rewards',
          'Customer reviews',
          'Emails and confirmations',
          'Messages and automations',
          'Campaigns and birthdays',
          'Analytics and insights',
          'Location and public presence',
          'Billing and subscriptions',
          'Growth modules and POS',
        ],
        allInOneEyebrow: 'Connected operations',
        allInOneTitle: 'From first visit to repeat customer.',
        allInOneText:
          'Silentra connects discovery, booking, operations and retention. Customers get a simple experience; barbershops keep control of what happens next.',
        flow: ['Discover', 'Book', 'Confirm', 'Serve', 'Reward', 'Return'],
        modulesEyebrow: 'Platform',
        modulesTitle: 'Everything you need to operate and grow.',
        modules: [
          [
            'Scheduling',
            'Bookings, availability, conflicts, duration, breaks and blocks.',
          ],
          [
            'Customers',
            'History, contacts, notes and context for better service.',
          ],
          [
            'Team',
            'Owner, admin, manager, barber, receptionist and staff roles with barbershop-level permissions.',
          ],
          [
            'Presence',
            'Public page, marketplace, location, reviews and QR for acquisition.',
          ],
          [
            'Loyalty',
            'Points, rewards, transactions, redemptions and active voucher recovery.',
          ],
          [
            'Automation',
            'Emails, confirmations, reminders, birthdays and workflows without manual work.',
          ],
          [
            'Analytics',
            'Operational, customer and booking metrics to track the business.',
          ],
          [
            'Growth',
            'Campaigns, messages, premium modules, billing and tools built to scale.',
          ],
        ],
        securityTitle: 'Built for everyday operations.',
        securityText:
          'Server-side permissions, barbershop isolation, critical validation and production observability are part of the platform.',
        proTitle: 'A professional experience on both sides.',
        proText:
          'You should not have to choose between customer simplicity and operational control. Silentra is designed for both.',
        finalTitle: 'Less admin. More customers coming back.',
        finalText:
          'Create your barbershop for free or find your next appointment.',
        finalBarber: 'Create barbershop',
        finalCustomer: 'Find a barbershop',
      };

  const services = pt
    ? [
        ['Corte + Barba', '45 min', '20 €'],
        ['Corte', '30 min', '15 €'],
        ['Barba', '20 min', '10 €'],
      ]
    : [
        ['Haircut + Beard', '45 min', '20 €'],
        ['Haircut', '30 min', '15 €'],
        ['Beard', '20 min', '10 €'],
      ];
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];

  return (
    <main className="relative mt-24 overflow-hidden">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pb-28 lg:pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
              <Sparkles className="size-3.5 text-emerald-300" />
              {copy.eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-[2.75rem] font-semibold leading-[0.95] tracking-[-0.065em] text-white sm:text-6xl lg:text-[5.2rem]">
              {copy.heroTitle}
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-zinc-400 sm:text-lg">
              {copy.heroText}
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <TrackedMarketingLink
                href="/registo"
                ctaId="homepage_start_free_hero"
                ctaLocation="homepage_hero"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5"
              >
                {copy.barberCta}
                <ArrowRight className="size-4" />
              </TrackedMarketingLink>
              <Link
                href="/barbershops"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                {copy.customerCta}
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
              {[copy.freeNote, copy.noCard, copy.noAccount].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55 }}
            className="relative"
          >
            <div className="absolute -inset-12 bg-emerald-400/[0.035] blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-900/80 p-2 shadow-[0_35px_110px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-3">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      {copy.demoTitle}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {copy.shop}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {copy.bookingFlow}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[11px] text-emerald-200">
                    <Scissors className="size-3.5" />
                    {copy.available}
                  </span>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      {copy.service}
                    </p>
                    <span className="text-[10px] text-zinc-600">
                      {pt ? 'Preço · duração' : 'Price · duration'}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {services.map(([name, duration, price], index) => (
                      <div
                        key={name}
                        className={`flex min-h-14 items-center justify-between rounded-xl border px-3.5 ${index === 0 ? 'border-white/20 bg-white/[0.06]' : 'border-white/8 bg-white/[0.025]'}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-100">
                            {name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {duration}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-zinc-200">
                          {price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {copy.time}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {slots.map((slot, index) => (
                      <div
                        key={slot}
                        className={`min-h-10 rounded-lg border py-3 text-center text-xs font-medium ${index === 2 ? 'border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-200' : 'border-white/8 bg-white/[0.025] text-zinc-300'}`}
                      >
                        {slot}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">{copy.summary}</p>
                    <p className="mt-1 text-sm text-zinc-200">
                      {services[0][0]} · 45 min · 10:00
                    </p>
                  </div>
                  <Link
                    href="/barbershops"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950"
                  >
                    {copy.book}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      <section
        className="border-y border-white/8 bg-white/[0.015]"
        id="howitworks"
      >
        <div className="mx-auto grid max-w-7xl md:grid-cols-2">
          <div className="border-b border-white/8 p-6 sm:p-8 lg:p-10 md:border-r">
            <div className="flex items-center gap-3">
              <Store className="size-5 text-emerald-300" />
              <h2 className="text-xl font-semibold text-white">
                {copy.customerTitle}
              </h2>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              {copy.customerText}
            </p>
            <Link
              href="/barbershops"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-zinc-300"
            >
              {copy.explore}
              <ArrowRight className="size-4" />
            </Link>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {copy.customerItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 text-xs text-zinc-400"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <BarChart3 className="size-5 text-emerald-300" />
              <h2 className="text-xl font-semibold text-white">
                {copy.barberTitle}
              </h2>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              {copy.barberText}
            </p>
            <Link
              href="/registo"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-zinc-300"
            >
              {copy.start}
              <ArrowRight className="size-4" />
            </Link>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {copy.barberItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 text-xs text-zinc-400"
                >
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            {copy.allInOneEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            {copy.allInOneTitle}
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
            {copy.allInOneText}
          </p>
        </div>
        <div className="mt-10 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {copy.flow.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                0{index + 1}
              </span>
              <p className="mt-7 text-sm font-semibold text-white">{item}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
              {copy.modulesEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              {copy.modulesTitle}
            </h2>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {copy.modules.map(([title, text], index) => {
              const Icon = featureIcons[index];
              return (
                <article
                  key={title}
                  className="group rounded-2xl border border-white/8 bg-zinc-950/50 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.035]"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-emerald-300">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-6 sm:p-8 lg:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="size-5" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              {copy.securityTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              {copy.securityText}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-6 sm:p-8 lg:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <Sparkles className="size-5" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              {copy.proTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {copy.proText}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
              Silentra
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
              {copy.finalTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400 sm:text-base">
              {copy.finalText}
            </p>
          </div>
          <div className="grid gap-2 sm:flex">
            <Link
              href="/registo"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950"
            >
              {copy.finalBarber}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/barbershops"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white"
            >
              {copy.finalCustomer}
              <MapPin className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
