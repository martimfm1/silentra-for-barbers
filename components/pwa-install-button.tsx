'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  EllipsisVertical,
  Monitor,
  PlusSquare,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PwaInstallButtonProps = {
  locale?: 'pt' | 'en';
};

type InstallGuide = 'apple' | 'android' | 'desktop';
type DesktopBrowser = 'safari' | 'other';

export function PwaInstallButton({ locale = 'pt' }: PwaInstallButtonProps) {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<InstallGuide>('desktop');
  const [desktopBrowser, setDesktopBrowser] = useState<DesktopBrowser>('other');
  const [isInstalled, setIsInstalled] = useState(false);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );

  const isEnglish = locale === 'en';
  const pathname = usePathname();
  const isDashboardPage =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const isMacSafari =
      /Macintosh|Mac OS X/i.test(userAgent) &&
      /Safari/i.test(userAgent) &&
      !/(Chrome|Chromium|CriOS|Edg|OPR|FxiOS)/i.test(userAgent);
    const standaloneNavigator = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      standaloneNavigator.standalone === true;

    setGuide(isAppleMobile ? 'apple' : isAndroid ? 'android' : 'desktop');
    setDesktopBrowser(isMacSafari ? 'safari' : 'other');
    setIsInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallFeedback(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallClick = async (fromDialog = false) => {
    if (!installPrompt) {
      if (fromDialog) {
        setInstallFeedback(
          guide === 'apple'
            ? isEnglish
              ? 'On iPhone and iPad, Safari does not allow a website to open the install prompt automatically. Use Share, choose “Add to Home Screen” and confirm.'
              : 'No iPhone e iPad, o Safari não permite abrir a instalação automaticamente. Usa Partilhar, escolhe «Adicionar ao ecrã principal» e confirma.'
            : isEnglish
              ? 'This browser has not made a direct install prompt available. Follow the steps beside this card and use your browser menu.'
              : 'Este navegador não disponibilizou a instalação direta. Segue os passos ao lado e utiliza o menu do navegador.',
        );
        document
          .getElementById('install-guide-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        setOpen(true);
      }
      return;
    }

    const deferredPrompt = installPrompt;
    setInstallPrompt(null);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallFeedback(null);
        setOpen(false);
      } else {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  };

  if (isInstalled) return null;

  const devices: {
    id: InstallGuide;
    label: string;
    Icon: typeof Smartphone;
  }[] = [
    {
      id: 'apple',
      label: 'iPhone / iPad',
      Icon: Smartphone,
    },
    { id: 'android', label: 'Android', Icon: Smartphone },
    {
      id: 'desktop',
      label: 'PC / Mac',
      Icon: Monitor,
    },
  ];

  const installSteps =
    guide === 'apple'
      ? [
          {
            title: isEnglish ? 'Open in Safari' : 'Abre no Safari',
            description: isEnglish
              ? 'If you opened this page inside another app, open it directly in Safari first.'
              : 'Se abriste esta página dentro de outra aplicação, abre-a primeiro diretamente no Safari.',
            Icon: Smartphone,
          },
          {
            title: isEnglish ? 'Tap Share' : 'Toca em Partilhar',
            description: isEnglish
              ? 'Use the Share icon in Safari’s toolbar.'
              : 'Usa o ícone Partilhar na barra de ferramentas do Safari.',
            Icon: Share,
          },
          {
            title: isEnglish
              ? 'Choose Add to Home Screen'
              : 'Escolhe Adicionar ao ecrã principal',
            description: isEnglish
              ? 'Scroll through the available actions if you do not see this option immediately.'
              : 'Percorre as ações disponíveis se esta opção não aparecer logo.',
            Icon: PlusSquare,
          },
          {
            title: isEnglish ? 'Confirm with Add' : 'Confirma em Adicionar',
            description: isEnglish
              ? 'The Silentra icon will be available on your home screen.'
              : 'O ícone da Silentra ficará disponível no ecrã principal.',
            Icon: CheckCircle2,
          },
        ]
      : guide === 'android'
        ? [
            {
              title: isEnglish
                ? 'Open the browser menu'
                : 'Abre o menu do navegador',
              description: isEnglish
                ? 'In Chrome or a compatible browser, tap the three-dot menu.'
                : 'No Chrome ou num navegador compatível, toca no menu dos três pontos.',
              Icon: EllipsisVertical,
            },
            {
              title: isEnglish
                ? 'Choose Install app'
                : 'Escolhe Instalar aplicação',
              description: isEnglish
                ? 'Depending on the browser, it may say “Install app” or “Add to Home screen”.'
                : 'Consoante o navegador, pode aparecer «Instalar aplicação» ou «Adicionar ao ecrã principal».',
              Icon: Download,
            },
            {
              title: isEnglish
                ? 'Confirm installation'
                : 'Confirma a instalação',
              description: isEnglish
                ? 'Accept the browser prompt. You can then open Silentra from your home screen.'
                : 'Aceita a confirmação do navegador. Depois, podes abrir a Silentra no ecrã principal.',
              Icon: CheckCircle2,
            },
          ]
        : desktopBrowser === 'safari'
          ? [
              {
                title: isEnglish
                  ? 'Open the File menu'
                  : 'Abre o menu Ficheiro',
                description: isEnglish
                  ? 'In a compatible version of Safari on macOS, use the menu at the top of your screen.'
                  : 'Numa versão compatível do Safari no macOS, abre o menu no topo do ecrã.',
                Icon: Monitor,
              },
              {
                title: isEnglish
                  ? 'Choose Add to Dock'
                  : 'Escolhe Adicionar à Dock',
                description: isEnglish
                  ? 'Select “Add to Dock” to keep Silentra available like an app.'
                  : 'Seleciona «Adicionar à Dock» para teres a Silentra disponível como uma aplicação.',
                Icon: Download,
              },
            ]
          : [
              {
                title: isEnglish
                  ? 'Look in the address bar'
                  : 'Procura na barra de endereço',
                description: isEnglish
                  ? 'Chrome and Edge may show an install icon on the right side of the address bar.'
                  : 'O Chrome e o Edge podem mostrar um ícone de instalação à direita da barra de endereço.',
                Icon: Download,
              },
              {
                title: isEnglish
                  ? 'Or open the browser menu'
                  : 'Ou abre o menu do navegador',
                description: isEnglish
                  ? 'Choose “Install app” or “Install this site as an app”, if available.'
                  : 'Escolhe «Instalar aplicação» ou «Instalar este site como aplicação», se a opção estiver disponível.',
                Icon: EllipsisVertical,
              },
              {
                title: isEnglish
                  ? 'Confirm installation'
                  : 'Confirma a instalação',
                description: isEnglish
                  ? 'Silentra will open in its own app window when supported by your browser.'
                  : 'Quando o navegador for compatível, a Silentra passa a abrir numa janela própria.',
                Icon: CheckCircle2,
              },
            ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleInstallClick()}
        className="h-10 shrink-0 gap-2 rounded-xl border-emerald-300/20 bg-emerald-300/[0.07] px-3 text-xs font-semibold text-emerald-100 hover:border-emerald-200/35 hover:bg-emerald-300/[0.12] sm:px-3.5 sm:text-sm"
        aria-label={
          isEnglish ? 'Install Silentra app' : 'Instalar aplicação Silentra'
        }
      >
        <Download className="size-4" aria-hidden="true" />
        <span className="sm:hidden">{isEnglish ? 'Install' : 'Instalar'}</span>
        <span className="hidden sm:inline">
          {isEnglish ? 'Install app' : 'Instalar app'}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden overscroll-contain rounded-[1.75rem] border-white/10 bg-zinc-950/95 p-0 text-zinc-50 shadow-[0_32px_120px_rgba(0,0,0,0.7)] sm:max-h-[min(88dvh,52rem)] sm:w-[calc(100%-2rem)] sm:max-w-5xl">
          <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-28 -z-10 size-72 rounded-full bg-emerald-300/[0.12] blur-[90px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 top-20 -z-10 size-56 rounded-full bg-sky-300/[0.06] blur-[90px]"
            />

            <DialogHeader className="relative shrink-0 px-5 pb-5 pr-14 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100 sm:text-[11px]">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {isEnglish ? 'Silentra web app' : 'Aplicação Web Silentra'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 sm:text-[11px]">
                  <ShieldCheck
                    className="size-3.5 text-emerald-200"
                    aria-hidden="true"
                  />
                  {isEnglish
                    ? 'Free · No store needed'
                    : 'Gratuita · Sem loja de apps'}
                </span>
              </div>
              <DialogTitle className="max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
                {isEnglish
                  ? 'Silentra, one tap away.'
                  : 'A Silentra, a um toque de distância.'}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">
                {isEnglish
                  ? 'Choose your device and follow the quick steps to add Silentra to your home screen or desktop.'
                  : 'Escolhe o teu dispositivo e segue os passos para adicionares a Silentra ao ecrã principal ou ao computador.'}
              </DialogDescription>
            </DialogHeader>

            <div className="relative min-w-0 px-5 pb-5 sm:px-8 sm:pb-8">
              <div
                role="tablist"
                aria-label={
                  isEnglish ? 'Choose your device' : 'Escolhe o teu dispositivo'
                }
                className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.07] bg-black/25 p-1.5 sm:gap-2"
              >
                {devices.map(({ id, label, Icon }) => {
                  const selected = guide === id;
                  return (
                    <button
                      key={id}
                      id={`install-guide-tab-${id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="install-guide-panel"
                      onClick={() => {
                        setGuide(id);
                        setInstallFeedback(null);
                      }}
                      className={
                        selected
                          ? 'flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200/20 bg-emerald-300/[0.12] px-1.5 text-[11px] font-semibold text-emerald-50 shadow-[0_4px_20px_rgba(16,185,129,0.07)] transition-colors sm:gap-2 sm:px-3 sm:text-sm'
                          : 'flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-transparent px-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.045] hover:text-zinc-100 sm:gap-2 sm:px-3 sm:text-sm'
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                id="install-guide-panel"
                role="tabpanel"
                aria-labelledby={`install-guide-tab-${guide}`}
                className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch lg:gap-5"
              >
                <section className="flex min-w-0 flex-col rounded-2xl border border-emerald-200/12 bg-gradient-to-br from-emerald-300/[0.075] via-white/[0.025] to-white/[0.015] p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/15 bg-emerald-300/[0.09] text-emerald-100">
                      {guide === 'desktop' ? (
                        <Monitor className="size-5" aria-hidden="true" />
                      ) : (
                        <Smartphone className="size-5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white sm:text-base">
                        {isEnglish
                          ? 'Made for everyday use'
                          : 'Feita para o dia a dia'}
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                        {isEnglish
                          ? 'Keep your workspace within reach.'
                          : 'Tem o teu espaço de trabalho sempre à mão.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-200"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-5 text-zinc-300">
                        {isEnglish
                          ? 'Quick access from your home screen or taskbar.'
                          : 'Acesso rápido pelo ecrã principal ou pela barra de tarefas.'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-200"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-5 text-zinc-300">
                        {isEnglish
                          ? 'Uses your existing Silentra account and dashboard.'
                          : 'Usa a tua conta e a dashboard Silentra que já tens.'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-200"
                        aria-hidden="true"
                      />
                      <p className="text-sm leading-5 text-zinc-300">
                        {isEnglish
                          ? 'No App Store download or separate account required.'
                          : 'Sem descarregar pela App Store ou criar outra conta.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck
                        className="mt-0.5 size-4 shrink-0 text-zinc-400"
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-5 text-zinc-400">
                        {isEnglish
                          ? 'The install option depends on your browser. If it is unavailable, Silentra still works normally in the browser.'
                          : 'A opção de instalação depende do navegador. Se não estiver disponível, podes continuar a usar a Silentra normalmente no navegador.'}
                      </p>
                    </div>
                  </div>

                  {isDashboardPage ? (
                    <button
                      type="button"
                      onClick={() => void handleInstallClick(true)}
                      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.1] px-4 py-2.5 text-sm font-semibold text-emerald-50 transition-colors hover:border-emerald-200/35 hover:bg-emerald-300/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:mt-auto"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      {isEnglish ? 'Install app' : 'Instalar aplicação'}
                    </button>
                  ) : (
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:mt-auto"
                    >
                      {isEnglish ? 'Open dashboard' : 'Abrir dashboard'}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                  {installFeedback ? (
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-3 rounded-xl border border-amber-200/10 bg-amber-200/[0.045] px-3 py-2.5 text-xs leading-5 text-amber-100/85"
                    >
                      {installFeedback}
                    </p>
                  ) : null}
                </section>

                <section className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white sm:text-base">
                        {isEnglish
                          ? 'Installation steps'
                          : 'Passos de instalação'}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {isEnglish
                          ? `${installSteps.length} simple steps`
                          : `${installSteps.length} passos simples`}
                      </p>
                    </div>
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-zinc-300">
                      <Download className="size-4" aria-hidden="true" />
                    </span>
                  </div>

                  <ol className="space-y-2.5">
                    {installSteps.map((step, index) => {
                      const StepIcon = step.Icon;
                      return (
                        <li
                          key={step.title}
                          className="flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3 sm:gap-3.5 sm:p-3.5"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200/15 bg-emerald-300/[0.07] text-xs font-semibold tabular-nums text-emerald-100">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <StepIcon
                                className="size-4 shrink-0 text-zinc-300"
                                aria-hidden="true"
                              />
                              <h4 className="text-sm font-semibold leading-5 text-zinc-100">
                                {step.title}
                              </h4>
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
                              {step.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </div>

              <p className="mt-4 flex items-start justify-center gap-2 px-1 text-center text-[11px] leading-5 text-zinc-500 sm:text-xs">
                <ShieldCheck
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {isEnglish
                    ? 'Installing creates a shortcut to the web app; you can keep using Silentra in your browser.'
                    : 'A instalação cria um atalho para a aplicação Web; podes continuar a usar a Silentra no navegador.'}
                </span>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
