'use client';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { currentTerms } from '@/lib/legal/current-terms';

type TermsDrawerProps = {
  trigger: React.ReactNode;
};

export function TermsDrawer({ trigger }: TermsDrawerProps) {
  const { locale, t } = useLanguage();
  const updatedTerms = currentTerms[locale];

  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="glassmorphism mx-auto h-[min(90dvh,48rem)] max-h-[90dvh] w-full max-w-lg rounded-t-2xl border-white/10 bg-zinc-950 text-zinc-50 sm:h-[85vh]">
        <DrawerHeader className="shrink-0 px-5 pb-3 pt-5 text-left sm:px-6">
          <DrawerTitle className="font-heading text-lg">
            {t('legal.termsTitle', { defaultValue: 'Terms & Conditions' })}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-zinc-400">
            {t('legal.termsLastUpdated', {
              defaultValue: 'Last updated: {date}',
              date: updatedTerms.lastUpdated,
            })}
          </DrawerDescription>
        </DrawerHeader>

        <div
          data-terms-scroll-area
          tabIndex={0}
          aria-label={t('legal.termsTitle', {
            defaultValue: 'Terms & Conditions',
          })}
          data-vaul-no-drag="true"
          className="scrollbar-thin min-h-0 flex-1 touch-pan-y overscroll-y-contain overflow-y-scroll [-webkit-overflow-scrolling:touch] px-5 pb-8 text-xs leading-relaxed text-zinc-400 sm:px-6"
        >
          <div className="space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p>{updatedTerms.intro}</p>

            {updatedTerms.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-200">
                  {section.title}
                </h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
