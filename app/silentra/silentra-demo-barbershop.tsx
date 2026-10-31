'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Menu,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type DemoDate = {
  value: string;
  weekday: string;
  day: string;
  label: string;
};

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  featured?: boolean;
};

const TIMES = ['09:30', '10:15', '11:00', '11:45', '14:30', '15:15', '16:00', '17:15'];

const PHOTO = {
  // Unsplash — free under the Unsplash License.
  hero: 'https://images.unsplash.com/photo-1781455793310-8427c96454c7?auto=format&fit=crop&w=2000&q=85',
  detail: 'https://images.unsplash.com/photo-1582771498000-8ad44e6c84db?auto=format&fit=crop&w=1400&q=85',
  craft: 'https://images.unsplash.com/photo-1771489465791-00ee339a9c92?auto=format&fit=crop&w=1400&q=85',
};

const PT = {
  demo: 'EXPERIÊNCIA DEMONSTRATIVA',
  demoNote: 'Esta barbearia, os preços e os contactos são exemplos.',
  navServices: 'Serviços',
  navStory: 'A experiência',
  navTeam: 'Equipa',
  navContact: 'Contactos',
  book: 'Marcar horário',
  eyebrow: 'BARBEARIA · LISBOA',
  heroTitleA: 'O teu estilo.',
  heroTitleB: 'A nossa assinatura.',
  heroDescription: 'Mais do que um corte. Um espaço para abrandar, cuidar de ti e sair com a confiança no ponto.',
  explore: 'Explorar a barbearia',
  heroFoot: 'Técnica apurada. Ambiente tranquilo. Atenção ao detalhe.',
  introKicker: 'O ritual começa aqui',
  introTitle: 'Há cortes. E há a forma como te fazem sentir.',
  introText: 'Na Silentra, cada visita é pensada ao pormenor. Ouvimos o que procuras, aconselhamos com honestidade e trabalhamos cada detalhe até o resultado fazer sentido contigo.',
  introLink: 'Conhecer a experiência',
  statOne: 'Atenção ao detalhe',
  statTwo: 'Tempo para ti',
  statThree: 'Estilo à tua medida',
  serviceKicker: 'O menu',
  serviceTitle: 'Escolhe o teu próximo ritual.',
  serviceText: 'Serviços de barbearia com tempo, técnica e intenção. Estes valores são meramente ilustrativos.',
  from: 'A partir de',
  minutes: 'min',
  selectService: 'Escolher serviço',
  signature: 'Favorito da casa',
  storyKicker: 'A experiência Silentra',
  storyTitle: 'Entra. Desliga. Sai no teu melhor.',
  storyText: 'Um ambiente pensado para que a experiência seja tão boa como o resultado. Sem pressas, sem complicações — só bom trabalho.',
  storyOneTitle: 'Um momento só teu',
  storyOneText: 'Uma pausa na rotina, com atenção total ao que precisas.',
  storyTwoTitle: 'O detalhe importa',
  storyTwoText: 'Do primeiro conselho ao último acabamento, nada fica ao acaso.',
  storyThreeTitle: 'Consistência em cada visita',
  storyThreeText: 'O objetivo é simples: saíres daqui com vontade de voltar.',
  galleryKicker: 'Dentro da barbearia',
  galleryTitle: 'O ambiente também faz parte do corte.',
  teamKicker: 'As mãos por trás do trabalho',
  teamTitle: 'Conhece a equipa.',
  teamText: 'Uma equipa de exemplo para ilustrar como os profissionais da tua barbearia podem ser apresentados.',
  barberRole: 'Barbeiro',
  barberOne: 'Rui Martins',
  barberOneText: 'Cortes clássicos e degradês com acabamento preciso.',
  barberTwo: 'André Costa',
  barberTwoText: 'Barba, contornos e atenção aos pequenos detalhes.',
  barberThree: 'Miguel Santos',
  barberThreeText: 'Textura, styling e cortes com personalidade.',
  bookingKicker: 'A tua próxima visita',
  bookingTitleA: 'O próximo bom corte',
  bookingTitleB: 'começa aqui.',
  bookingText: 'Experimenta o fluxo de marcação. Escolhe um serviço, um dia e um horário — sem compromisso.',
  bookingDemo: 'Simulação — não será criada uma marcação real.',
  stepService: '1. Serviço',
  stepDay: '2. Dia',
  stepTime: '3. Horário',
  noDates: 'A preparar disponibilidade…',
  noTimes: 'Escolhe um horário para continuar.',
  simulate: 'Simular marcação',
  simulatedTitle: 'Assim seria a tua confirmação.',
  simulatedText: 'Esta foi apenas uma demonstração. Numa barbearia real, o pedido seguiria para a agenda e receberias a confirmação por email.',
  simulateAgain: 'Experimentar novamente',
  locationKicker: 'Encontra-nos',
  locationTitle: 'Um espaço à tua espera.',
  locationText: 'Lisboa, Portugal · localização ilustrativa para esta demonstração.',
  hoursTitle: 'Horário de exemplo',
  weekdays: 'Segunda — Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
  closed: 'Encerrado',
  locationLabel: 'Localização demonstrativa',
  locationDetail: 'Lisboa, Portugal',
  footerCta: 'Tens uma barbearia?',
  footerTitle: 'A tua marca merece uma presença à altura.',
  footerText: 'Uma página como esta, marcações online e uma gestão simples — tudo ligado na Silentra for Barbers.',
  createMyPage: 'Quero uma página assim',
  platform: 'Conhecer a Silentra for Barbers',
  allRights: 'Conteúdo demonstrativo. Marca e informações de exemplo.',
  backTop: 'Voltar ao topo',
  menuOpen: 'Abrir menu',
  menuClose: 'Fechar menu',
  featuredLabel: 'Demonstração',
  serviceCut: 'Corte assinatura',
  serviceCutDesc: 'Corte personalizado, lavagem e finalização.',
  serviceFade: 'Skin fade',
  serviceFadeDesc: 'Degradê preciso com transições limpas.',
  serviceBeard: 'Barba & contornos',
  serviceBeardDesc: 'Modelação, toalha quente e acabamento.',
  serviceCombo: 'Corte + barba',
  serviceComboDesc: 'O ritual completo para um visual renovado.',
  serviceBuzz: 'Corte à máquina',
  serviceBuzzDesc: 'Corte uniforme, simples e sem complicações.',
  serviceWash: 'Lavagem & styling',
  serviceWashDesc: 'Lavagem, secagem e styling final.',
};

const EN = {
  demo: 'DEMO EXPERIENCE',
  demoNote: 'This barbershop, its prices and contacts are examples.',
  navServices: 'Services',
  navStory: 'The experience',
  navTeam: 'Team',
  navContact: 'Contact',
  book: 'Book a time',
  eyebrow: 'BARBERSHOP · LISBON',
  heroTitleA: 'Your style.',
  heroTitleB: 'Our signature.',
  heroDescription: 'More than a haircut. A place to slow down, take care of yourself and leave feeling your best.',
  explore: 'Explore the barbershop',
  heroFoot: 'Sharp technique. Calm atmosphere. Attention to detail.',
  introKicker: 'The ritual starts here',
  introTitle: 'There are haircuts. And there is how they make you feel.',
  introText: 'At Silentra, every visit is considered down to the last detail. We listen, give honest advice and work on every finish until it feels right for you.',
  introLink: 'Discover the experience',
  statOne: 'Attention to detail',
  statTwo: 'Time for you',
  statThree: 'Your style, your way',
  serviceKicker: 'The menu',
  serviceTitle: 'Choose your next ritual.',
  serviceText: 'Barbering with time, technique and intention. Prices are illustrative only.',
  from: 'From',
  minutes: 'min',
  selectService: 'Choose service',
  signature: 'House favourite',
  storyKicker: 'The Silentra experience',
  storyTitle: 'Come in. Switch off. Leave at your best.',
  storyText: 'A space designed to make the experience as good as the result. No rush, no fuss — just good work.',
  storyOneTitle: 'A moment for yourself',
  storyOneText: 'A break from the routine, with our full attention on you.',
  storyTwoTitle: 'Details matter',
  storyTwoText: 'From the first recommendation to the final finish, nothing is left to chance.',
  storyThreeTitle: 'Consistency, every visit',
  storyThreeText: 'The goal is simple: leave already looking forward to coming back.',
  galleryKicker: 'Inside the barbershop',
  galleryTitle: 'The atmosphere is part of the cut.',
  teamKicker: 'The people behind the craft',
  teamTitle: 'Meet the team.',
  teamText: 'A sample team to show how your barbers can be presented on your own website.',
  barberRole: 'Barber',
  barberOne: 'Rui Martins',
  barberOneText: 'Classic cuts and fades with a precise finish.',
  barberTwo: 'André Costa',
  barberTwoText: 'Beards, clean lines and attention to the small details.',
  barberThree: 'Miguel Santos',
  barberThreeText: 'Texture, styling and cuts with personality.',
  bookingKicker: 'Your next visit',
  bookingTitleA: 'Your next great cut',
  bookingTitleB: 'starts here.',
  bookingText: 'Try the booking flow. Choose a service, day and time — no commitment.',
  bookingDemo: 'Demo only — no real appointment will be created.',
  stepService: '1. Service',
  stepDay: '2. Day',
  stepTime: '3. Time',
  noDates: 'Preparing availability…',
  noTimes: 'Choose a time to continue.',
  simulate: 'Preview booking',
  simulatedTitle: 'This is what your confirmation could look like.',
  simulatedText: 'This was only a demo. In a real barbershop, the request would go to the calendar and you would receive an email confirmation.',
  simulateAgain: 'Try again',
  locationKicker: 'Find us',
  locationTitle: 'A space waiting for you.',
  locationText: 'Lisbon, Portugal · illustrative location for this demo.',
  hoursTitle: 'Sample opening hours',
  weekdays: 'Monday — Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  closed: 'Closed',
  locationLabel: 'Demo location',
  locationDetail: 'Lisbon, Portugal',
  footerCta: 'Own a barbershop?',
  footerTitle: 'Your brand deserves a presence to match.',
  footerText: 'A page like this, online bookings and simple management — all connected with Silentra for Barbers.',
  createMyPage: 'I want a page like this',
  platform: 'Explore Silentra for Barbers',
  allRights: 'Demo content. Sample brand and information.',
  backTop: 'Back to top',
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  featuredLabel: 'Demo',
  serviceCut: 'Signature cut',
  serviceCutDesc: 'Tailored haircut, wash and finish.',
  serviceFade: 'Skin fade',
  serviceFadeDesc: 'Precise fade with clean transitions.',
  serviceBeard: 'Beard & lines',
  serviceBeardDesc: 'Shaping, hot towel and finish.',
  serviceCombo: 'Haircut + beard',
  serviceComboDesc: 'The complete ritual for a refreshed look.',
  serviceBuzz: 'Buzz cut',
  serviceBuzzDesc: 'An even, simple and effortless cut.',
  serviceWash: 'Wash & styling',
  serviceWashDesc: 'Wash, dry and final styling.',
};

export default function SilentraDemoBarbershop() {
  const { locale, setLocale } = useLanguage();
  const copy = locale === 'en' ? EN : PT;
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('signature');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [dates, setDates] = useState<DemoDate[]>([]);
  const [simulated, setSimulated] = useState(false);

  const services: Service[] = [
    { id: 'signature', name: copy.serviceCut, description: copy.serviceCutDesc, duration: 45, price: 18, featured: true },
    { id: 'fade', name: copy.serviceFade, description: copy.serviceFadeDesc, duration: 50, price: 20 },
    { id: 'beard', name: copy.serviceBeard, description: copy.serviceBeardDesc, duration: 30, price: 12 },
    { id: 'combo', name: copy.serviceCombo, description: copy.serviceComboDesc, duration: 75, price: 26 },
    { id: 'buzz', name: copy.serviceBuzz, description: copy.serviceBuzzDesc, duration: 25, price: 12 },
    { id: 'wash', name: copy.serviceWash, description: copy.serviceWashDesc, duration: 25, price: 10 },
  ];

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0]!;
  const selectedDateLabel = dates.find((date) => date.value === selectedDate);

  useEffect(() => {
    const dateLocale = locale === 'en' ? 'en-GB' : 'pt-PT';
    const today = new Date();
    const nextDates = Array.from({ length: 5 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const value = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
      const weekday = date.toLocaleDateString(dateLocale, { weekday: 'short' }).replace('.', '');
      const label = index === 0
        ? (locale === 'en' ? 'Today' : 'Hoje')
        : index === 1
          ? (locale === 'en' ? 'Tomorrow' : 'Amanhã')
          : weekday;
      return {
        value,
        weekday: weekday.toUpperCase(),
        day: String(date.getDate()).padStart(2, '0'),
        label,
      };
    });
    setDates(nextDates);
    setSelectedDate(nextDates[0]?.value ?? '');
    setSelectedTime('');
    setSimulated(false);
  }, [locale]);

  const chooseService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSimulated(false);
    document.getElementById('marcacao')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBooking = () => {
    setMenuOpen(false);
    setSimulated(false);
  };

  return (
    <main id="topo" className="min-h-screen overflow-x-clip bg-[#11100e] text-[#f5f0e8] selection:bg-[#b88450]/35 selection:text-white">
      <div className="flex flex-col items-center justify-center gap-1 border-b border-[#b88450]/20 bg-[#221a13] px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d4b18b] sm:flex-row sm:gap-3 sm:text-[10px]">
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#d5a46f]" />
          {copy.demo}
        </span>
        <span className="hidden text-[#80654a] sm:inline">/</span>
        <span className="font-normal tracking-[0.08em] text-[#b6a18c]">{copy.demoNote}</span>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#11100e]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-14">
          <Link href="/silentra" className="group flex min-w-0 items-center gap-3" aria-label="Silentra Barbershop">
            <span className="flex size-10 shrink-0 items-center justify-center border border-[#b88450]/45 bg-[#b88450]/10 text-[#d8ad7d] transition group-hover:bg-[#b88450]/20">
              <Scissors className="size-5" strokeWidth={1.3} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-lg leading-none tracking-[0.16em] text-[#f4ece1] sm:text-xl">SILENTRA</span>
              <span className="mt-1 block text-[8px] font-medium uppercase tracking-[0.31em] text-[#a89176]">Barbershop</span>
            </span>
          </Link>

          <nav aria-label={locale === 'en' ? 'Main navigation' : 'Navegação principal'} className="hidden items-center gap-8 lg:flex">
            <a href="#servicos" className="text-xs font-medium text-[#c8bfb3] transition hover:text-[#e4b783]">{copy.navServices}</a>
            <a href="#experiencia" className="text-xs font-medium text-[#c8bfb3] transition hover:text-[#e4b783]">{copy.navStory}</a>
            <a href="#equipa" className="text-xs font-medium text-[#c8bfb3] transition hover:text-[#e4b783]">{copy.navTeam}</a>
            <a href="#contactos" className="text-xs font-medium text-[#c8bfb3] transition hover:text-[#e4b783]">{copy.navContact}</a>
          </nav>

          <div className="hidden items-center gap-1 sm:flex">
            <button type="button" onClick={() => setLocale('pt')} aria-label="Mudar para português" aria-pressed={locale === 'pt'} className={['min-h-10 border px-3 text-[10px] font-semibold', locale === 'pt' ? 'border-[#b88450] text-[#e5bd91]' : 'border-white/10 text-[#9f8e7a] hover:text-white'].join(' ')}>PT</button>
            <button type="button" onClick={() => setLocale('en')} aria-label="Switch to English" aria-pressed={locale === 'en'} className={['min-h-10 border px-3 text-[10px] font-semibold', locale === 'en' ? 'border-[#b88450] text-[#e5bd91]' : 'border-white/10 text-[#9f8e7a] hover:text-white'].join(' ')}>EN</button>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <a href="#marcacao" onClick={scrollToBooking} className="hidden min-h-11 items-center justify-center gap-2 bg-[#c99560] px-5 text-xs font-bold text-[#17120e] transition hover:bg-[#ddb17f] sm:inline-flex">
              {copy.book}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex size-11 items-center justify-center border border-white/10 text-[#eee3d6] lg:hidden"
              aria-label={menuOpen ? copy.menuClose : copy.menuOpen}
              aria-expanded={menuOpen}
              aria-controls="silentra-demo-mobile-menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav id="silentra-demo-mobile-menu" className="grid gap-1 border-t border-white/10 bg-[#16130f] px-5 py-4 lg:hidden">
            {[
              ['#servicos', copy.navServices],
              ['#experiencia', copy.navStory],
              ['#equipa', copy.navTeam],
              ['#contactos', copy.navContact],
              ['#marcacao', copy.book],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center justify-between border-b border-white/[0.06] text-sm text-[#e8dccd]">
                {label}
                <ArrowUpRight className="size-4 text-[#bb8a5b]" aria-hidden="true" />
              </a>
            ))}
            <div className="flex items-center gap-2 pt-3">
              <span className="mr-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9f8e7a]">Idioma / Language</span>
              <button type="button" onClick={() => setLocale('pt')} aria-pressed={locale === 'pt'} className={['min-h-10 border px-4 text-xs font-semibold', locale === 'pt' ? 'border-[#b88450] bg-[#b88450]/15 text-[#e5bd91]' : 'border-white/10 text-[#bdb2a5]'].join(' ')}>PT</button>
              <button type="button" onClick={() => setLocale('en')} aria-pressed={locale === 'en'} className={['min-h-10 border px-4 text-xs font-semibold', locale === 'en' ? 'border-[#b88450] bg-[#b88450]/15 text-[#e5bd91]' : 'border-white/10 text-[#bdb2a5]'].join(' ')}>EN</button>
            </div>
          </nav>
        ) : null}
      </header>

      <section className="relative isolate min-h-[680px] overflow-hidden border-b border-white/[0.06] sm:min-h-[760px] lg:min-h-[790px]">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: 'url("' + PHOTO.hero + '")', backgroundPosition: 'center 48%' }}
          role="img"
          aria-label={locale === 'en' ? 'Warm, intimate barbershop interior' : 'Interior acolhedor de uma barbearia'}
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(13,12,10,0.98)_0%,rgba(13,12,10,0.91)_38%,rgba(13,12,10,0.43)_72%,rgba(13,12,10,0.2)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,#11100e_0%,transparent_34%)]" />
        <div className="mx-auto flex min-h-[680px] w-full max-w-[1440px] items-center px-5 py-20 sm:min-h-[760px] sm:px-8 lg:min-h-[790px] lg:px-14">
          <div className="max-w-[760px]">
            <div className="mb-7 inline-flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d9b58f]">
              <span className="h-px w-9 bg-[#c99560]" />
              {copy.eyebrow}
            </div>
            <h1 className="font-serif text-[clamp(3.5rem,8.4vw,7.6rem)] leading-[0.91] tracking-[-0.055em] text-[#f4eee4]">
              <span className="block">{copy.heroTitleA}</span>
              <span className="mt-2 block italic text-[#d2a475]">{copy.heroTitleB}</span>
            </h1>
            <p className="mt-8 max-w-[520px] text-base leading-8 text-[#d1c7bb] sm:text-lg">
              {copy.heroDescription}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#marcacao" onClick={scrollToBooking} className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#c99560] px-7 text-sm font-bold text-[#17120e] transition hover:bg-[#ddb17f]">
                <CalendarDays className="size-4" aria-hidden="true" />
                {copy.book}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
              <a href="#servicos" className="inline-flex min-h-14 items-center justify-center gap-3 border border-white/20 bg-black/15 px-7 text-sm font-semibold text-[#f0e8dd] backdrop-blur-sm transition hover:border-[#d2a475]/60 hover:bg-white/[0.06]">
                {copy.explore}
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-[#aa9b89]">{copy.heroFoot}</p>
          </div>
        </div>
      </section>

      <div className="border-b border-white/[0.06] bg-[#171511]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-white/[0.07] px-5 py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-14">
          {[copy.statOne, copy.statTwo, copy.statThree].map((item, index) => (
            <div key={item} className="flex min-h-[66px] items-center justify-center gap-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9b9a7] sm:py-3">
              <span className="font-serif text-lg italic text-[#b78352]">0{index + 1}</span>
              {item}
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20 lg:px-14">
        <div>
          <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#c99560]">{copy.introKicker}</p>
          <h2 className="max-w-[560px] font-serif text-4xl leading-[1.08] tracking-tight text-[#f4ece1] sm:text-5xl lg:text-6xl">{copy.introTitle}</h2>
        </div>
        <div className="max-w-[630px] lg:pb-2">
          <p className="text-base leading-8 text-[#bdb2a5] sm:text-lg">{copy.introText}</p>
          <a href="#experiencia" className="mt-8 inline-flex items-center gap-3 border-b border-[#b88450]/50 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#dfb486] transition hover:border-[#dfb486]">
            {copy.introLink}
            <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section id="servicos" className="scroll-mt-24 bg-[#eae3d8] py-24 text-[#1e1a16] sm:py-32">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-14">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[#94673e]">{copy.serviceKicker}</p>
              <h2 className="font-serif text-4xl leading-tight tracking-tight sm:text-6xl">{copy.serviceTitle}</h2>
            </div>
            <p className="max-w-[430px] text-sm leading-7 text-[#6f6255]">{copy.serviceText}</p>
          </div>
          <div className="mt-12 grid gap-x-12 md:grid-cols-2">
            {services.map((service, index) => (
              <article key={service.id} className="group border-t border-[#b9ab99] py-6 sm:py-7">
                <div className="flex items-start justify-between gap-5">
                  <div className="flex min-w-0 gap-4">
                    <span className="pt-1 font-serif text-sm italic text-[#a17c56]">0{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-2xl text-[#201a15] sm:text-3xl">{service.name}</h3>
                        {service.featured ? <span className="inline-flex items-center gap-1 border border-[#b88450]/40 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.15em] text-[#865a34]"><Sparkles className="size-3" />{copy.signature}</span> : null}
                      </div>
                      <p className="mt-2 max-w-[360px] text-sm leading-6 text-[#75695d]">{service.description}</p>
                      <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#9a8875]">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        {service.duration} {copy.minutes}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-2xl text-[#1d1915]">€{service.price}</p>
                    <button type="button" onClick={() => chooseService(service.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 border-b border-[#a47b54]/60 text-[10px] font-bold uppercase tracking-[0.11em] text-[#805b3b] transition hover:border-[#4d3725] hover:text-[#4d3725]">
                      {copy.selectService}
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-[#b9ab99] pt-7 sm:flex-row sm:items-center">
            <p className="text-xs text-[#807466]">{copy.featuredLabel} · {copy.serviceText}</p>
            <a href="#marcacao" className="inline-flex min-h-12 items-center gap-3 bg-[#1b1814] px-6 text-xs font-bold uppercase tracking-[0.12em] text-[#eee5da] transition hover:bg-[#3a2d22]">
              {copy.book}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="experiencia" className="scroll-mt-24 mx-auto grid w-full max-w-[1440px] gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:px-14">
        <div className="relative min-w-0">
          <div className="aspect-[4/5] overflow-hidden bg-[#28211a]">
            <div
              className="size-full bg-cover bg-center transition duration-700 hover:scale-[1.025]"
              style={{ backgroundImage: 'url("' + PHOTO.detail + '")' }}
              role="img"
              aria-label={locale === 'en' ? 'Barber carefully finishing a client haircut' : 'Barbeiro a finalizar cuidadosamente o corte de um cliente'}
            />
          </div>
          <div className="absolute -bottom-6 -right-2 max-w-[230px] border border-[#b88450]/35 bg-[#201a14] p-5 sm:-right-6 sm:p-7">
            <Scissors className="size-6 text-[#d1a272]" strokeWidth={1.2} aria-hidden="true" />
            <p className="mt-4 font-serif text-xl italic leading-snug text-[#f1e5d7]">{copy.heroFoot}</p>
          </div>
        </div>
        <div className="pt-5 lg:pt-0">
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c99560]">{copy.storyKicker}</p>
          <h2 className="max-w-[580px] font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">{copy.storyTitle}</h2>
          <p className="mt-7 max-w-[550px] text-sm leading-8 text-[#bdb2a5] sm:text-base">{copy.storyText}</p>
          <div className="mt-10 space-y-7">
            {[
              [copy.storyOneTitle, copy.storyOneText],
              [copy.storyTwoTitle, copy.storyTwoText],
              [copy.storyThreeTitle, copy.storyThreeText],
            ].map(([title, description], index) => (
              <div key={title} className="flex gap-5 border-t border-white/10 pt-5">
                <span className="font-serif text-lg italic text-[#b88450]">0{index + 1}</span>
                <div>
                  <h3 className="font-serif text-xl text-[#f1e8dd]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#a99e92]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#211b15] py-20 sm:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c99560]">{copy.galleryKicker}</p>
              <h2 className="font-serif text-4xl sm:text-5xl">{copy.galleryTitle}</h2>
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#998673]">{copy.featuredLabel}</span>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="relative min-h-[390px] overflow-hidden bg-[#30271e] sm:min-h-[500px]">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("' + PHOTO.hero + '")' }} role="img" aria-label={locale === 'en' ? 'Silentra sample barbershop interior' : 'Interior de exemplo da barbearia Silentra'} />
              <span className="absolute bottom-5 left-5 border border-white/20 bg-black/35 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">SILENTRA / 01</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              <div className="relative min-h-[230px] overflow-hidden bg-[#30271e] sm:min-h-[242px] md:min-h-0">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("' + PHOTO.detail + '")' }} role="img" aria-label={locale === 'en' ? 'Barber finishing a haircut' : 'Acabamento de um corte de cabelo'} />
                <span className="absolute bottom-5 left-5 border border-white/20 bg-black/35 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">SILENTRA / 02</span>
              </div>
              <div className="relative min-h-[230px] overflow-hidden bg-[#30271e] sm:min-h-[242px] md:min-h-0">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("' + PHOTO.craft + '")' }} role="img" aria-label={locale === 'en' ? 'Barbers working in a shop' : 'Barbeiros a trabalhar numa barbearia'} />
                <span className="absolute bottom-5 left-5 border border-white/20 bg-black/35 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-md">SILENTRA / 03</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="equipa" className="scroll-mt-24 mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 sm:py-32 lg:px-14">
        <div className="max-w-[700px]">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c99560]">{copy.teamKicker}</p>
          <h2 className="font-serif text-4xl sm:text-6xl">{copy.teamTitle}</h2>
          <p className="mt-6 text-sm leading-7 text-[#bdb2a5]">{copy.teamText}</p>
        </div>
        <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            { initials: 'RM', name: copy.barberOne, specialty: copy.barberOneText, number: '01' },
            { initials: 'AC', name: copy.barberTwo, specialty: copy.barberTwoText, number: '02' },
            { initials: 'MS', name: copy.barberThree, specialty: copy.barberThreeText, number: '03' },
          ].map((barber) => (
            <article key={barber.initials} className="flex min-h-[260px] flex-col justify-between bg-[#171511] p-7 sm:min-h-[310px] sm:p-9">
              <div className="flex items-start justify-between">
                <span className="font-serif text-sm italic text-[#ae8157]">{barber.number}</span>
                <span className="flex size-14 items-center justify-center border border-[#b88450]/40 bg-[#b88450]/10 font-serif text-lg italic text-[#e0b487]">{barber.initials}</span>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#b88450]">{copy.barberRole}</p>
                <h3 className="mt-2 font-serif text-2xl text-[#f2e9de]">{barber.name}</h3>
                <p className="mt-3 text-sm leading-6 text-[#a99e92]">{barber.specialty}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="marcacao" className="scroll-mt-24 bg-[#eae3d8] py-24 text-[#201a15] sm:py-32">
        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:px-14">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#94673e]">{copy.bookingKicker}</p>
            <h2 className="font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              {copy.bookingTitleA}
              <span className="block italic text-[#9b7049]">{copy.bookingTitleB}</span>
            </h2>
            <p className="mt-7 max-w-[400px] text-sm leading-7 text-[#75695d]">{copy.bookingText}</p>
            <div className="mt-7 flex items-start gap-3 border-l-2 border-[#b88450] bg-[#dfd5c7] p-4 text-xs leading-6 text-[#6e5b48]">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#94673e]" aria-hidden="true" />
              {copy.bookingDemo}
            </div>
          </div>

          <div className="border border-[#c8b9a7] bg-[#f4eee5] p-5 shadow-[0_24px_80px_rgba(49,37,26,0.09)] sm:p-8 lg:p-10">
            {simulated ? (
              <div className="flex min-h-[570px] flex-col items-start justify-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#dce4d7] text-[#496849]"><Check className="size-7" aria-hidden="true" /></span>
                <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#94673e]">{copy.featuredLabel}</p>
                <h3 className="mt-3 font-serif text-3xl sm:text-4xl">{copy.simulatedTitle}</h3>
                <p className="mt-5 max-w-[520px] text-sm leading-7 text-[#75695d]">{copy.simulatedText}</p>
                <div className="mt-8 w-full border-y border-[#c8b9a7] py-5">
                  <div className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-[#817467]">{copy.stepService}</span>
                    <strong className="text-right">{selectedService.name}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-[#817467]">{copy.stepDay}</span>
                    <strong className="text-right">{selectedDateLabel?.label ?? '—'} · {selectedDateLabel?.day ?? ''}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="text-[#817467]">{copy.stepTime}</span>
                    <strong>{selectedTime}</strong>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#c8b9a7] pt-4">
                    <span className="text-sm text-[#817467]">{copy.from}</span>
                    <strong className="font-serif text-2xl">€{selectedService.price}</strong>
                  </div>
                </div>
                <button type="button" onClick={() => setSimulated(false)} className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[#201a15] px-6 text-xs font-bold uppercase tracking-[0.12em] text-[#f4eee5] transition hover:bg-[#493728]">
                  {copy.simulateAgain}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94673e]">{copy.stepService}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {services.map((service) => (
                      <button key={service.id} type="button" onClick={() => setSelectedServiceId(service.id)} className={['flex min-h-[76px] items-center justify-between gap-3 border p-4 text-left transition', selectedServiceId === service.id ? 'border-[#a8784c] bg-[#e9ddce]' : 'border-[#d4c8b9] bg-white/35 hover:border-[#aa8866]'].join(' ')}>
                        <span className="min-w-0">
                          <span className="block font-serif text-lg leading-tight">{service.name}</span>
                          <span className="mt-1 block text-[10px] text-[#88796a]">{service.duration} {copy.minutes}</span>
                        </span>
                        <span className="shrink-0 font-serif text-xl">€{service.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-9 border-t border-[#c8b9a7] pt-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94673e]">{copy.stepDay}</p>
                  {dates.length ? (
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {dates.map((date) => (
                        <button key={date.value} type="button" onClick={() => { setSelectedDate(date.value); setSelectedTime(''); }} className={['flex min-h-[82px] flex-col items-center justify-center border px-1 py-3 transition', selectedDate === date.value ? 'border-[#a8784c] bg-[#e9ddce]' : 'border-[#d4c8b9] bg-white/35 hover:border-[#aa8866]'].join(' ')}>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8b7968]">{date.weekday}</span>
                          <span className="mt-1 font-serif text-2xl">{date.day}</span>
                          <span className="mt-0.5 text-[9px] text-[#8b7968]">{date.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="mt-4 text-sm text-[#88796a]">{copy.noDates}</p>}
                </div>

                <div className="mt-9 border-t border-[#c8b9a7] pt-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94673e]">{copy.stepTime}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TIMES.map((time) => (
                      <button key={time} type="button" onClick={() => { setSelectedTime(time); setSimulated(false); }} className={['min-h-11 border px-3 text-sm transition', selectedTime === time ? 'border-[#a8784c] bg-[#e9ddce] font-semibold' : 'border-[#d4c8b9] bg-white/35 hover:border-[#aa8866]'].join(' ')}>
                        {time}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-[#8b7968]">{copy.noTimes}</p>
                </div>

                <div className="mt-9 flex flex-col justify-between gap-5 border-t border-[#c8b9a7] pt-7 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.13em] text-[#88796a]">{selectedService.name}</p>
                    <p className="mt-1 font-serif text-3xl">€{selectedService.price}</p>
                  </div>
                  <button type="button" disabled={!selectedDate || !selectedTime} onClick={() => setSimulated(true)} className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#201a15] px-7 text-xs font-bold uppercase tracking-[0.12em] text-[#f4eee5] transition hover:bg-[#493728] disabled:cursor-not-allowed disabled:opacity-40">
                    {copy.simulate}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="contactos" className="scroll-mt-24 mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:px-14">
        <div>
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#c99560]">{copy.locationKicker}</p>
          <h2 className="font-serif text-4xl leading-tight sm:text-6xl">{copy.locationTitle}</h2>
          <p className="mt-6 max-w-[470px] text-sm leading-7 text-[#bdb2a5]">{copy.locationText}</p>
          <div className="mt-9 flex items-start gap-4 border-t border-white/10 py-5">
            <MapPin className="mt-1 size-5 shrink-0 text-[#c99560]" aria-hidden="true" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#a58a6e]">{copy.locationLabel}</p>
              <p className="mt-2 font-serif text-2xl">{copy.locationDetail}</p>
            </div>
          </div>
        </div>
        <div className="border border-white/10 bg-[#191611] p-7 sm:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c99560]">{copy.hoursTitle}</p>
          <div className="mt-6 divide-y divide-white/10">
            {[
              [copy.weekdays, '09:00 — 19:00'],
              [copy.saturday, '09:00 — 16:00'],
              [copy.sunday, copy.closed],
            ].map(([label, time]) => (
              <div key={label} className="flex min-h-14 items-center justify-between gap-4 text-sm">
                <span className="text-[#bdb2a5]">{label}</span>
                <span className="font-medium text-[#eee3d6]">{time}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-[#9f8e7a]">
            <Clock3 className="size-4 text-[#c99560]" aria-hidden="true" />
            {copy.demoNote}
          </div>
        </div>
      </section>

      <section className="border-y border-[#b88450]/20 bg-[#2a2118] px-5 py-20 text-center sm:px-8 sm:py-28">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d2a475]">{copy.footerCta}</p>
        <h2 className="mx-auto mt-5 max-w-[850px] font-serif text-4xl leading-[1.08] sm:text-6xl">{copy.footerTitle}</h2>
        <p className="mx-auto mt-6 max-w-[620px] text-sm leading-7 text-[#c4b4a3]">{copy.footerText}</p>
        <Link href="/registo" className="mt-9 inline-flex min-h-14 items-center justify-center gap-3 bg-[#d0a071] px-7 text-xs font-bold uppercase tracking-[0.12em] text-[#1b1510] transition hover:bg-[#e0b78d]">
          {copy.createMyPage}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <footer className="bg-[#11100e] px-5 py-8 sm:px-8 lg:px-14">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex items-center gap-3 text-[#ded2c4]">
            <Scissors className="size-4 text-[#c99560]" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">SILENTRA FOR BARBERS</span>
          </Link>
          <p className="text-[10px] text-[#817365]">{copy.allRights}</p>
          <a href="#topo" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c99560]">{copy.backTop}</a>
        </div>
      </footer>

      <a href="#marcacao" onClick={scrollToBooking} className="fixed inset-x-4 bottom-4 z-30 inline-flex min-h-12 items-center justify-center gap-2 border border-[#e3bb8b]/30 bg-[#c99560] px-5 text-xs font-bold text-[#17120e] shadow-2xl shadow-black/30 sm:hidden">
        <CalendarDays className="size-4" aria-hidden="true" />
        {copy.book}
      </a>
    </main>
  );
}
