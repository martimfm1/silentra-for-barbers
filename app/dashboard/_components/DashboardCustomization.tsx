'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Palette, Plus, RotateCcw,
  Save, Settings2, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type DashboardCustomizationConfig = {
  shortcuts: string[];
  sections: {
    quickActions: boolean;
    metrics: boolean;
    nextAppointment: boolean;
    activityChart: boolean;
    upcomingAppointments: boolean;
  };
  accentColor: string;
};

export type DashboardCustomizationPreset = {
  id: string;
  name: string;
  config: DashboardCustomizationConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const DEFAULT_CONFIG: DashboardCustomizationConfig = {
  shortcuts: ['new-booking', 'clients', 'services', 'team', 'analytics'],
  sections: {
    quickActions: true,
    metrics: true,
    nextAppointment: true,
    activityChart: true,
    upcomingAppointments: true,
  },
  accentColor: '#34d399',
};

const SHORTCUTS = [
  { id: 'new-booking', pt: 'Nova marcação', en: 'New booking' },
  { id: 'clients', pt: 'Clientes', en: 'Clients' },
  { id: 'services', pt: 'Serviços', en: 'Services' },
  { id: 'team', pt: 'Equipa', en: 'Team' },
  { id: 'analytics', pt: 'Estatísticas', en: 'Analytics' },
  { id: 'loyalty', pt: 'Fidelização', en: 'Loyalty' },
  { id: 'qr-code', pt: 'Código QR', en: 'QR code' },
  { id: 'automations', pt: 'Automações', en: 'Automations' },
  { id: 'messages', pt: 'Mensagens', en: 'Messages' },
  { id: 'marketing', pt: 'Campanhas', en: 'Campaigns' },
  { id: 'sales', pt: 'Vendas', en: 'Sales' },
  { id: 'website', pt: 'Site próprio', en: 'Website' },
  { id: 'support', pt: 'Suporte', en: 'Support' },
] as const;

const SECTION_LABELS = [
  { id: 'quickActions', pt: 'Atalhos rápidos', en: 'Quick shortcuts' },
  { id: 'metrics', pt: 'Resumo do negócio', en: 'Business overview' },
  { id: 'nextAppointment', pt: 'Próxima marcação', en: 'Next appointment' },
  { id: 'activityChart', pt: 'Gráfico de atividade', en: 'Activity chart' },
  { id: 'upcomingAppointments', pt: 'Próximas marcações', en: 'Upcoming appointments' },
] as const;

const COLORS = [
  { value: '#34d399', pt: 'Esmeralda', en: 'Emerald' },
  { value: '#60a5fa', pt: 'Azul', en: 'Blue' },
  { value: '#a78bfa', pt: 'Violeta', en: 'Violet' },
  { value: '#fbbf24', pt: 'Âmbar', en: 'Amber' },
  { value: '#fb7185', pt: 'Rosa', en: 'Rose' },
  { value: '#22d3ee', pt: 'Ciano', en: 'Cyan' },
  { value: '#f8fafc', pt: 'Branco', en: 'White' },
] as const;

async function requestJson(method: string, body?: Record<string, unknown>) {
  const response = await fetch('/api/dashboard/customizations', {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível guardar as alterações.');
  return payload;
}

export function useDashboardCustomization() {
  const [presets, setPresets] = useState<DashboardCustomizationPreset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfig] = useState<DashboardCustomizationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const payload = await requestJson('GET');
      const nextPresets = (payload.data ?? []) as DashboardCustomizationPreset[];
      setPresets(nextPresets);
      const active = nextPresets.find((item) => item.is_active) ?? nextPresets[0];
      if (active) {
        setActiveId(active.id);
        setConfig({ ...DEFAULT_CONFIG, ...active.config, sections: { ...DEFAULT_CONFIG.sections, ...active.config.sections } });
      }
    } catch (error) {
      console.error('[DASHBOARD_CUSTOMIZATION_LOAD_FAILED]', error);
      toast.error('Não foi possível carregar a personalização da dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activeId) ?? null,
    [activeId, presets],
  );

  const save = useCallback(async (name: string, nextConfig: DashboardCustomizationConfig = config) => {
    if (!activeId) throw new Error('Não existe uma personalização ativa.');
    const payload = await requestJson('PATCH', { id: activeId, name, config: nextConfig });
    await refresh();
    return payload.data as DashboardCustomizationPreset;
  }, [activeId, config, refresh]);

  const create = useCallback(async (name: string, nextConfig: DashboardCustomizationConfig = config) => {
    const payload = await requestJson('POST', { name, config: nextConfig });
    await requestJson('PATCH', { id: payload.data.id, activate: true });
    await refresh();
    return payload.data as DashboardCustomizationPreset;
  }, [config, refresh]);

  const activate = useCallback(async (id: string) => {
    await requestJson('PATCH', { id, activate: true });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await requestJson('DELETE', { id });
    await refresh();
  }, [refresh]);

  return { presets, activeId, activePreset, config, setConfig, loading, refresh, save, create, activate, remove };
}

type CustomizationState = ReturnType<typeof useDashboardCustomization>;

export function DashboardCustomizationDialog({
  customization,
  locale,
}: {
  customization: CustomizationState;
  locale: string;
}) {
  const isEnglish = locale === 'en';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('A minha dashboard');
  const [saving, setSaving] = useState(false);
  const [newPreset, setNewPreset] = useState(false);
  const [draftShortcuts, setDraftShortcuts] = useState<string[]>([]);
  const t = (pt: string, en: string) => isEnglish ? en : pt;

  useEffect(() => {
    if (customization.activePreset && !newPreset) setName(customization.activePreset.name);
  }, [customization.activePreset, newPreset]);

  const orderedShortcuts = useMemo(
    () => draftShortcuts.map((id) => SHORTCUTS.find((item) => item.id === id)).filter(Boolean),
    [draftShortcuts],
  );

  function openEditor() {
    setDraftShortcuts([...customization.config.shortcuts]);
    setName(customization.activePreset?.name ?? t('A minha dashboard', 'My dashboard'));
    setNewPreset(false);
    setOpen(true);
  }

  function toggleShortcut(id: string, checked: boolean) {
    setDraftShortcuts((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  function moveShortcut(index: number, direction: -1 | 1) {
    setDraftShortcuts((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave(asNew = false) {
    setSaving(true);
    try {
      const nextConfig = { ...customization.config, shortcuts: draftShortcuts };
      customization.setConfig(nextConfig);
      if (asNew || newPreset) {
        await customization.create(name.trim(), nextConfig);
        toast.success(t('Nova personalização guardada.', 'New customization saved.'));
      } else {
        await customization.save(name.trim(), nextConfig);
        toast.success(t('Personalização guardada.', 'Customization saved.'));
      }
      setNewPreset(false);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Não foi possível guardar.', 'Could not save changes.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    try {
      await customization.activate(id);
      const selected = customization.presets.find((item) => item.id === id);
      if (selected) {
        setDraftShortcuts([...selected.config.shortcuts]);
        setName(selected.name);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Não foi possível mudar a personalização.', 'Could not switch customization.'));
    }
  }

  async function handleDelete() {
    if (!customization.activeId || customization.presets.length <= 1) return;
    try {
      await customization.remove(customization.activeId);
      setNewPreset(false);
      toast.success(t('Personalização eliminada.', 'Customization deleted.'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Não foi possível eliminar.', 'Could not delete customization.'));
    }
  }

  const updateSection = (id: keyof DashboardCustomizationConfig['sections'], checked: boolean) => {
    customization.setConfig((current) => ({ ...current, sections: { ...current.sections, [id]: checked } }));
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openEditor}
        className="gap-2 border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10"
      >
        <Settings2 className="size-4" />
        {t('Personalizar', 'Customize')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>{t('A tua dashboard, à tua maneira', 'Your dashboard, your way')}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('Organiza os atalhos, escolhe o que queres ver e define a cor dos detalhes.', 'Organize shortcuts, choose what you see and set the accent color.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-medium" htmlFor="dashboard-preset-name">{t('Personalização', 'Customization')}</label>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={t('Escolher personalização', 'Choose customization')}
                    value={newPreset ? '__new__' : customization.activeId ?? ''}
                    onChange={(event) => {
                      if (event.target.value === '__new__') {
                        setNewPreset(true);
                        setName(t('Nova personalização', 'New customization'));
                        setDraftShortcuts([...customization.config.shortcuts]);
                      } else {
                        setNewPreset(false);
                        void handleActivate(event.target.value);
                      }
                    }}
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm"
                  >
                    {customization.presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                    <option value="__new__">{t('+ Nova personalização', '+ New customization')}</option>
                  </select>
                  <ChevronDown className="size-4 text-zinc-500" aria-hidden="true" />
                </div>
              </div>
              <Input id="dashboard-preset-name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} className="border-white/10 bg-zinc-900" />
              {customization.activePreset && !newPreset && (
                <p className="text-[11px] text-zinc-500">ID: <span className="font-mono">{customization.activePreset.id}</span></p>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">{t('Atalhos', 'Shortcuts')}</h3>
                <p className="text-xs text-zinc-500">{t('Escolhe os atalhos e usa as setas para alterar a ordem.', 'Choose shortcuts and use the arrows to change their order.')}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SHORTCUTS.map((shortcut) => (
                  <label key={shortcut.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draftShortcuts.includes(shortcut.id)}
                      onChange={(event) => toggleShortcut(shortcut.id, event.target.checked)}
                      className="size-4 accent-emerald-400"
                    />
                    <span className="min-w-0 flex-1">{isEnglish ? shortcut.en : shortcut.pt}</span>
                    {draftShortcuts.includes(shortcut.id) && (
                      <span className="flex items-center gap-1">
                        <button type="button" aria-label={t('Mover para cima', 'Move up')} onClick={() => moveShortcut(draftShortcuts.indexOf(shortcut.id), -1)} disabled={draftShortcuts.indexOf(shortcut.id) === 0} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                        <button type="button" aria-label={t('Mover para baixo', 'Move down')} onClick={() => moveShortcut(draftShortcuts.indexOf(shortcut.id), 1)} disabled={draftShortcuts.indexOf(shortcut.id) === draftShortcuts.length - 1} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-xs text-zinc-500">{t('Atalhos selecionados:', 'Selected shortcuts:')} {orderedShortcuts.length}/13</p>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">{t('Elementos da dashboard', 'Dashboard sections')}</h3>
                <p className="text-xs text-zinc-500">{t('Oculta os cartões e gráficos que não utilizas.', 'Hide cards and charts you do not use.')}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_LABELS.map((section) => (
                  <label key={section.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={customization.config.sections[section.id]}
                      onChange={(event) => updateSection(section.id, event.target.checked)}
                      className="size-4 accent-emerald-400"
                    />
                    {isEnglish ? section.en : section.pt}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-zinc-400" />
                <h3 className="text-sm font-semibold">{t('Cor dos detalhes', 'Accent color')}</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={isEnglish ? color.en : color.pt}
                    aria-pressed={customization.config.accentColor === color.value}
                    onClick={() => customization.setConfig((current) => ({ ...current, accentColor: color.value }))}
                    className="flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: color.value, borderColor: customization.config.accentColor === color.value ? '#fff' : 'transparent' }}
                  >
                    {customization.config.accentColor === color.value && <Check className="size-4 text-zinc-950" />}
                  </button>
                ))}
                <label className="flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-900" title={t('Escolher cor personalizada', 'Choose custom color')}>
                  <input
                    type="color"
                    aria-label={t('Escolher cor personalizada', 'Choose custom color')}
                    value={customization.config.accentColor}
                    onChange={(event) => customization.setConfig((current) => ({ ...current, accentColor: event.target.value }))}
                    className="size-12 cursor-pointer border-0 bg-transparent"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <span className="size-8 rounded-lg" style={{ backgroundColor: customization.config.accentColor }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400">{t('Pré-visualização', 'Preview')}</p>
                  <p className="text-sm font-semibold" style={{ color: customization.config.accentColor }}>{t('Detalhes com a tua cor', 'Details in your color')}</p>
                </div>
                <code className="text-xs text-zinc-500">{customization.config.accentColor.toUpperCase()}</code>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {!newPreset && customization.presets.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => void handleDelete()} className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200">
                  <Trash2 className="mr-2 size-4" />{t('Eliminar', 'Delete')}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => { customization.setConfig(DEFAULT_CONFIG); setDraftShortcuts([...DEFAULT_CONFIG.shortcuts]); }} className="text-zinc-400">
                <RotateCcw className="mr-2 size-4" />{t('Repor', 'Reset')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t('Cancelar', 'Cancel')}</Button>
              <Button type="button" disabled={saving || !name.trim() || (draftShortcuts.length === 0 && customization.config.sections.quickActions)} onClick={() => void handleSave(newPreset)} className="bg-white text-zinc-950 hover:bg-zinc-200">
                {saving ? t('A guardar…', 'Saving…') : <><Save className="mr-2 size-4" />{newPreset ? t('Criar personalização', 'Create customization') : t('Guardar alterações', 'Save changes')}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
