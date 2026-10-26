'use client';

import { useEffect, useState } from 'react';
import { PlusSquare, Share, Smartphone } from 'lucide-react';
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

export function PwaInstallButton({ locale = 'pt' }: PwaInstallButtonProps) {
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );

  const isEnglish = locale === 'en';

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' &&
        window.navigator.maxTouchPoints > 1);
    const standaloneNavigator = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      standaloneNavigator.standalone === true;

    setIsIOS(isAppleMobile);
    setIsInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      setOpen(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setOpen(false);
      } else {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleInstallClick()}
        className="h-10 shrink-0 gap-1.5 border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/10 sm:gap-2 sm:px-3 sm:text-sm"
        aria-label={isEnglish ? 'Install Silentra app' : 'Instalar aplicação Silentra'}
      >
        <Smartphone className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{isEnglish ? 'Install app' : 'Instalar app'}</span>
        <span className="sm:hidden">App</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEnglish ? 'Add Silentra to your home screen' : 'Instala a Silentra no teu ecrã principal'}
            </DialogTitle>
            <DialogDescription>
              {isEnglish
                ? 'Use the existing Silentra dashboard as an app. No App Store account or Apple Developer subscription is needed.'
                : 'Usa a dashboard atual da Silentra como uma aplicação. Não precisas de conta da App Store nem de subscrição Apple Developer.'}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="space-y-3 text-sm text-zinc-200">
              <li className="flex items-start gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-semibold text-emerald-200">1</span>
                <span>
                  {isEnglish
                    ? 'Open this page in Safari (not inside Instagram or another app).'
                    : 'Abre esta página no Safari (não dentro do Instagram ou de outra aplicação).'}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-semibold text-emerald-200">2</span>
                <span className="flex items-center gap-1">
                  {isEnglish ? 'Tap' : 'Toca em'} <Share className="inline size-4" aria-label={isEnglish ? 'Share' : 'Partilhar'} /> <strong>{isEnglish ? 'Share' : 'Partilhar'}</strong> {isEnglish ? 'in the Safari toolbar.' : 'na barra do Safari.'}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-semibold text-emerald-200">3</span>
                <span className="flex items-center gap-1">
                  {isEnglish ? 'Select' : 'Escolhe'} <PlusSquare className="inline size-4" aria-label={isEnglish ? 'Add to Home Screen' : 'Adicionar ao ecrã principal'} /> <strong>{isEnglish ? 'Add to Home Screen' : 'Adicionar ao ecrã principal'}</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-xs font-semibold text-emerald-200">4</span>
                <span>
                  {isEnglish ? 'Confirm by tapping Add. The Silentra icon will appear on your home screen.' : 'Confirma em Adicionar. O ícone da Silentra ficará no ecrã principal.'}
                </span>
              </li>
            </ol>
          ) : (
            <div className="space-y-3 text-sm text-zinc-200">
              <p>
                {isEnglish
                  ? 'In Chrome, open the browser menu (⋮) and choose “Install app” or “Add to Home screen”.'
                  : 'No Chrome, abre o menu do navegador (⋮) e escolhe «Instalar aplicação» ou «Adicionar ao ecrã principal».'}
              </p>
              <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-zinc-400">
                {isEnglish
                  ? 'The install option appears only in browsers that support it. The dashboard still works in the browser if it is not shown.'
                  : 'A opção de instalação só aparece em navegadores compatíveis. Se não aparecer, podes continuar a usar a dashboard no navegador.'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
