'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Mail, Palette, RefreshCw, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG,
  ENTERPRISE_LANDING_PAGE_PALETTES,
  ENTERPRISE_LANDING_PAGE_THEMES,
  normalizeEnterpriseLandingPageConfig,
  type EnterpriseLandingPageConfig,
  type EnterpriseLandingPageTheme,
} from '@/lib/barbershops/enterprise-landing-page-config';

type Props = {
  onDraftChange: (
    draft: EnterpriseLandingPageConfig,
    dirty: boolean,
  ) => void;
  saveVersion: number;
  saving: boolean;
};

const THEME_COPY: Record<
  EnterpriseLandingPageTheme,
  { pt: string; en: string }
> = {
  midnight: { pt: 'Meia-noite', en: 'Midnight' },
  forest: { pt: 'Floresta', en: 'Forest' },
  sand: { pt: 'Areia', en: 'Sand' },
  espresso: { pt: 'Ébano', en: 'Espresso' },
};

const inputClass =
  'min-h-11 rounded-xl border-white/10 bg-white/[.04] text-zinc-100 placeholder:text-zinc-600';

export function EnterpriseLandingPageSettingsCard({
  onDraftChange,
  saveVersion,
  saving,
}: Props) {
  const { locale } = useLanguage();
  const isPt = locale === 'pt';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [initial, setInitial] =
    useState<EnterpriseLandingPageConfig | null>(null);
  const [draft, setDraft] = useState<EnterpriseLandingPageConfig>(
    DEFAULT_ENTERPRISE_LANDING_PAGE_CONFIG,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch('/api/barbershops/public-profile', {
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        throw new Error('LANDING_PAGE_SETTINGS_LOAD_FAILED');
      }
      const next = normalizeEnterpriseLandingPageConfig(
        body.data.theme_config,
      );
      setDraft(next);
      setInitial(next);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => initial !== null && JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  useEffect(() => {
    if (initial) onDraftChange(draft, dirty);
  }, [draft, dirty, initial, onDraftChange]);

  useEffect(() => {
    if (saveVersion > 0 && initial && dirty) {
      setInitial(draft);
    }
  }, [saveVersion, initial, dirty, draft]);

  const update = (patch: Partial<EnterpriseLandingPageConfig>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const accentDefault = ENTERPRISE_LANDING_PAGE_PALETTES[draft.theme].accent;

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-1/3 rounded bg-white/10" />
        <div className="h-20 rounded-2xl bg-white/[.04]" />
        <div className="h-11 rounded-xl bg-white/[.04]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-400">
          {isPt
            ? 'Não foi possível carregar as opções do site Enterprise.'
            : 'Could not load Enterprise website options.'}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          className="min-h-10 rounded-xl border-white/10"
        >
          <RefreshCw className="mr-2 size-4" />
          {isPt ? 'Tentar novamente' : 'Try again'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="enterprise-landing-theme-title">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-400/[.06] text-violet-300">
            <Palette className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h3 id="enterprise-landing-theme-title" className="text-sm font-semibold text-zinc-100">
              {isPt ? 'Tema de cores' : 'Colour theme'}
            </h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {isPt
                ? 'Escolhe uma paleta pronta para combinar com a identidade da tua barbearia.'
                : 'Choose a ready-made palette that fits your barbershop identity.'}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {ENTERPRISE_LANDING_PAGE_THEMES.map((theme) => {
            const palette = ENTERPRISE_LANDING_PAGE_PALETTES[theme];
            const active = draft.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                aria-pressed={active}
                disabled={saving}
                onClick={() => update({ theme })}
                className={
                  'flex min-h-[76px] items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
                  (active
                    ? 'border-emerald-400/40 bg-emerald-400/[.06]'
                    : 'border-white/[.08] bg-white/[.02] hover:bg-white/[.045]')
                }
              >
                <span
                  className="flex size-12 shrink-0 flex-col justify-end gap-1 overflow-hidden rounded-xl border p-1.5"
                  style={{
                    backgroundColor: palette.background,
                    borderColor: palette.border,
                  }}
                  aria-hidden="true"
                >
                  <span className="h-2 rounded-full" style={{ backgroundColor: palette.surface }} />
                  <span className="h-2 w-3/4 rounded-full" style={{ backgroundColor: palette.accent }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-100">
                    {THEME_COPY[theme][locale]}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {[palette.background, palette.surface, palette.accent].map((color) => (
                      <span
                        key={color}
                        className="size-3 rounded-full border border-white/15"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </span>
                {active ? (
                  <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-label={isPt ? 'Selecionado' : 'Selected'} />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {isPt ? 'Cor de destaque' : 'Accent colour'}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {isPt
                ? 'Opcional. Personaliza botões, links e pequenos detalhes.'
                : 'Optional. Customizes buttons, links and small highlights.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label={isPt ? 'Escolher cor de destaque' : 'Choose accent colour'}
              value={draft.accentColor || accentDefault}
              disabled={saving}
              onChange={(event) => update({ accentColor: event.target.value.toLowerCase() })}
              className="size-11 cursor-pointer rounded-xl border border-white/10 bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving || !draft.accentColor}
              onClick={() => update({ accentColor: '' })}
              className="min-h-9 text-xs text-zinc-400 hover:text-white"
            >
              {isPt ? 'Repor cor do tema' : 'Reset theme colour'}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-white/[.08] pt-5" aria-labelledby="enterprise-landing-content-title">
        <div>
          <h3 id="enterprise-landing-content-title" className="text-sm font-semibold text-zinc-100">
            {isPt ? 'Conteúdo do site' : 'Website content'}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {isPt
              ? 'Acrescenta um pouco de contexto sobre a tua barbearia. O resto é preenchido automaticamente com os dados da plataforma.'
              : 'Add some context about your barbershop. The remaining sections are filled automatically from your Silentra data.'}
          </p>
        </div>
        <label className="grid gap-2 text-sm text-zinc-300">
          {isPt ? 'Descrição / Sobre nós' : 'Description / About us'}
          <Textarea
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
            maxLength={600}
            rows={4}
            disabled={saving}
            placeholder={
              isPt
                ? 'Conta aos clientes o que torna a tua barbearia especial...'
                : 'Tell customers what makes your barbershop special...'
            }
            className={inputClass + ' min-h-28 resize-y'}
          />
          <span className="text-right text-[11px] text-zinc-600">
            {draft.description.length}/600
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm text-zinc-300">
            Instagram
            <Input
              type="url"
              value={draft.instagramUrl}
              onChange={(event) => update({ instagramUrl: event.target.value })}
              maxLength={300}
              disabled={saving}
              placeholder="https://instagram.com/..."
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm text-zinc-300">
            Facebook
            <Input
              type="url"
              value={draft.facebookUrl}
              onChange={(event) => update({ facebookUrl: event.target.value })}
              maxLength={300}
              disabled={saving}
              placeholder="https://facebook.com/..."
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm text-zinc-300 sm:col-span-2">
            TikTok
            <Input
              type="url"
              value={draft.tiktokUrl}
              onChange={(event) => update({ tiktokUrl: event.target.value })}
              maxLength={300}
              disabled={saving}
              placeholder="https://tiktok.com/@..."
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 border-t border-white/[.08] pt-5" aria-labelledby="enterprise-landing-sections-title">
        <div>
          <h3 id="enterprise-landing-sections-title" className="text-sm font-semibold text-zinc-100">
            {isPt ? 'Secções visíveis' : 'Visible sections'}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {isPt
              ? 'Escolhe quais as secções opcionais que aparecem na landing page.'
              : 'Choose which optional sections appear on your landing page.'}
          </p>
        </div>
        {[
          {
            key: 'showTeam' as const,
            label: isPt ? 'Mostrar equipa' : 'Show team',
            description: isPt
              ? 'Apresenta os profissionais ativos da barbearia.'
              : 'Show the active professionals at your barbershop.',
          },
          {
            key: 'showReviews' as const,
            label: isPt ? 'Mostrar avaliações' : 'Show reviews',
            description: isPt
              ? 'Apresenta a classificação e as avaliações dos clientes.'
              : 'Display the customer rating and reviews.',
          },
          {
            key: 'showAmenities' as const,
            label: isPt ? 'Mostrar comodidades' : 'Show amenities',
            description: isPt
              ? 'Apresenta as características selecionadas no perfil público.'
              : 'Display the amenities selected in your public profile.',
          },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 border-b border-white/[.06] pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{item.description}</p>
            </div>
            <Switch
              checked={draft[item.key]}
              disabled={saving}
              onCheckedChange={(checked) => update({ [item.key]: checked })}
              aria-label={item.label}
            />
          </div>
        ))}
      </section>

      <section className="space-y-3 border-t border-white/[.08] pt-5" aria-labelledby="enterprise-landing-layout-title">
        <div>
          <h3 id="enterprise-landing-layout-title" className="text-sm font-semibold text-zinc-100">
            {isPt ? 'Alinhamento do destaque' : 'Hero alignment'}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {isPt
              ? 'Uma pequena alteração de layout que podes fazer sem um projeto à medida.'
              : 'A small layout adjustment you can make without a bespoke project.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['left', 'center'] as const).map((alignment) => {
            const active = draft.heroAlignment === alignment;
            return (
              <button
                key={alignment}
                type="button"
                aria-pressed={active}
                disabled={saving}
                onClick={() => update({ heroAlignment: alignment })}
                className={
                  'min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
                  (active
                    ? 'border-emerald-400/35 bg-emerald-400/[.07] text-emerald-100'
                    : 'border-white/10 bg-white/[.025] text-zinc-400 hover:bg-white/[.05]')
                }
              >
                {alignment === 'left'
                  ? isPt
                    ? 'À esquerda'
                    : 'Left'
                  : isPt
                    ? 'Centrado'
                    : 'Centered'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-violet-400/15 bg-violet-400/[.035] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-300/[.08] text-violet-200">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {isPt ? 'Queres um site totalmente personalizado?' : 'Need a fully bespoke website?'}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {isPt
                ? 'Para um design exclusivo, secções especiais ou alterações avançadas, fala com a equipa Silentra.'
                : 'For a unique design, special sections or advanced changes, talk to the Silentra team.'}
            </p>
          </div>
        </div>
        <a
          href={`mailto:contact.silentra@gmail.com?subject=${encodeURIComponent(isPt ? 'Site personalizado Enterprise' : 'Enterprise bespoke website')}`}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-4 text-xs font-semibold text-zinc-100 transition-colors hover:bg-white/[.09]"
        >
          <Mail className="size-4" aria-hidden="true" />
          {isPt ? 'Contactar a Silentra' : 'Contact Silentra'}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </section>

      <p className="text-[11px] leading-5 text-zinc-600">
        {isPt
          ? 'As alterações ficam pendentes até carregares em Guardar no topo das definições.'
          : 'Changes stay pending until you press Save at the top of Settings.'}
      </p>
    </div>
  );
}
