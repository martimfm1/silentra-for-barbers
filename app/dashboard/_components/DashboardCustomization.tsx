'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Palette,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type DashboardMetricKey =
  'revenue' | 'appointments' | 'clients' | 'services';

export type DashboardCustomizationConfig = {
  shortcuts: string[];
  visibleMetrics: DashboardMetricKey[];
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
  visibleMetrics: ['revenue', 'appointments', 'clients', 'services'],
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
  { id: 'sales', pt: 'Vendas', en: 'Sales' },
  { id: 'website', pt: 'Site próprio', en: 'Website' },
  { id: 'support', pt: 'Suporte', en: 'Support' },
] as const;

const SECTION_LABELS = [
  { id: 'quickActions', pt: 'Atalhos rápidos', en: 'Quick shortcuts' },
  { id: 'metrics', pt: 'Resumo do negócio', en: 'Business overview' },
  { id: 'nextAppointment', pt: 'Próxima marcação', en: 'Next appointment' },
  { id: 'activityChart', pt: 'Gráfico de atividade', en: 'Activity chart' },
  {
    id: 'upcomingAppointments',
    pt: 'Próximas marcações',
    en: 'Upcoming appointments',
  },
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
  if (!response.ok)
    throw new Error(payload.error || 'Não foi possível guardar as alterações.');
  return payload;
}

type DashboardCustomizationContextValue = {
  presets: DashboardCustomizationPreset[];
  activeId: string | null;
  activePreset: DashboardCustomizationPreset | null;
  config: DashboardCustomizationConfig;
  setConfig: Dispatch<SetStateAction<DashboardCustomizationConfig>>;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (
    name: string,
    nextConfig?: DashboardCustomizationConfig,
  ) => Promise<DashboardCustomizationPreset>;
  create: (
    name: string,
    nextConfig?: DashboardCustomizationConfig,
  ) => Promise<DashboardCustomizationPreset>;
  activate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const DashboardCustomizationContext =
  createContext<DashboardCustomizationContextValue | null>(null);

const METRIC_KEYS: DashboardMetricKey[] = [
  'revenue',
  'appointments',
  'clients',
  'services',
];

function normalizeConfig(
  input?: Partial<DashboardCustomizationConfig> | null,
): DashboardCustomizationConfig {
  const visibleMetrics = Array.isArray(input?.visibleMetrics)
    ? input.visibleMetrics.filter((key): key is DashboardMetricKey =>
        METRIC_KEYS.includes(key as DashboardMetricKey),
      )
    : DEFAULT_CONFIG.visibleMetrics;

  return {
    ...DEFAULT_CONFIG,
    ...input,
    shortcuts: Array.isArray(input?.shortcuts)
      ? input.shortcuts.filter((id): id is string =>
          SHORTCUTS.some((shortcut) => shortcut.id === id),
        )
      : DEFAULT_CONFIG.shortcuts,
    visibleMetrics,
    sections: {
      ...DEFAULT_CONFIG.sections,
      ...input?.sections,
    },
  };
}

export function DashboardCustomizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [presets, setPresets] = useState<DashboardCustomizationPreset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [config, setConfig] =
    useState<DashboardCustomizationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const payload = await requestJson('GET');
      const nextPresets = (payload.data ??
        []) as DashboardCustomizationPreset[];
      setPresets(nextPresets);
      const active =
        nextPresets.find((item) => item.is_active) ?? nextPresets[0] ?? null;

      setActiveId(active?.id ?? null);
      setConfig(normalizeConfig(active?.config));
    } catch (error) {
      console.error('[DASHBOARD_CUSTOMIZATION_LOAD_FAILED]', error);
      toast.error('Não foi possível carregar a personalização da dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activeId) ?? null,
    [activeId, presets],
  );

  const save = useCallback(
    async (name: string, nextConfig: DashboardCustomizationConfig = config) => {
      if (!activeId) throw new Error('Não existe uma personalização ativa.');
      const payload = await requestJson('PATCH', {
        id: activeId,
        name,
        config: nextConfig,
      });
      await refresh();
      return payload.data as DashboardCustomizationPreset;
    },
    [activeId, config, refresh],
  );

  const create = useCallback(
    async (name: string, nextConfig: DashboardCustomizationConfig = config) => {
      const payload = await requestJson('POST', { name, config: nextConfig });
      await requestJson('PATCH', { id: payload.data.id, activate: true });
      await refresh();
      return payload.data as DashboardCustomizationPreset;
    },
    [config, refresh],
  );

  const activate = useCallback(
    async (id: string) => {
      await requestJson('PATCH', { id, activate: true });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await requestJson('DELETE', { id });
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      presets,
      activeId,
      activePreset,
      config,
      setConfig,
      loading,
      refresh,
      save,
      create,
      activate,
      remove,
    }),
    [
      presets,
      activeId,
      activePreset,
      config,
      loading,
      refresh,
      save,
      create,
      activate,
      remove,
    ],
  );

  return (
    <DashboardCustomizationContext.Provider value={value}>
      {children}
    </DashboardCustomizationContext.Provider>
  );
}

export function useDashboardCustomization() {
  const context = useContext(DashboardCustomizationContext);
  if (!context) {
    throw new Error(
      'useDashboardCustomization must be used within DashboardCustomizationProvider.',
    );
  }
  return context;
}

export function DashboardCustomizationDialog({
  config,
  setConfig,
  name,
  onNameChange,
  locale,
  disabled = false,
}: {
  config: DashboardCustomizationConfig;
  setConfig: Dispatch<SetStateAction<DashboardCustomizationConfig>>;
  name: string;
  onNameChange: (name: string) => void;
  locale: string;
  disabled?: boolean;
}) {
  const isEnglish = locale === 'en';
  const [open, setOpen] = useState(false);
  const [draftShortcuts, setDraftShortcuts] = useState<string[]>([]);
  const copy = (pt: string, en: string) => (isEnglish ? en : pt);

  const orderedShortcuts = useMemo(
    () =>
      draftShortcuts
        .map((id) => SHORTCUTS.find((item) => item.id === id))
        .filter(Boolean),
    [draftShortcuts],
  );

  function openEditor() {
    setDraftShortcuts([...config.shortcuts]);
    setOpen(true);
  }

  function toggleShortcut(id: string, checked: boolean) {
    const next = checked
      ? [...draftShortcuts, id]
      : draftShortcuts.filter((item) => item !== id);
    setDraftShortcuts(next);
    setConfig((current) => ({ ...current, shortcuts: next }));
  }

  function moveShortcut(index: number, direction: -1 | 1) {
    const next = [...draftShortcuts];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftShortcuts(next);
    setConfig((current) => ({ ...current, shortcuts: next }));
  }

  const updateSection = (
    id: keyof DashboardCustomizationConfig['sections'],
    checked: boolean,
  ) => {
    setConfig((current) => ({
      ...current,
      sections: { ...current.sections, [id]: checked },
    }));
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openEditor}
        disabled={disabled}
        className="gap-2 border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10"
      >
        <Settings2 className="size-4" />
        {copy('Personalizar', 'Customize')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>
              {copy(
                'A tua dashboard, à tua maneira',
                'Your dashboard, your way',
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {copy(
                'Organiza os atalhos, escolhe o que queres ver e define a cor dos detalhes.',
                'Organize shortcuts, choose what you see and set the accent color.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="dashboard-preset-name"
                >
                  {copy('Nome da personalização', 'Customization name')}
                </label>
                <p className="mt-1 text-xs text-zinc-500">
                  {copy(
                    'As alterações ficam pendentes até carregares em Guardar no topo das definições.',
                    'Changes stay pending until you press Save at the top of Settings.',
                  )}
                </p>
              </div>
              <Input
                id="dashboard-preset-name"
                value={name}
                maxLength={48}
                onChange={(event) => onNameChange(event.target.value)}
                className="border-white/10 bg-zinc-900"
              />
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {copy('Atalhos', 'Shortcuts')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {copy(
                    'Escolhe os atalhos e usa as setas para alterar a ordem.',
                    'Choose shortcuts and use the arrows to change their order.',
                  )}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SHORTCUTS.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm"
                  >
                    <input
                      id={`dashboard-shortcut-${shortcut.id}`}
                      type="checkbox"
                      checked={draftShortcuts.includes(shortcut.id)}
                      onChange={(event) =>
                        toggleShortcut(shortcut.id, event.target.checked)
                      }
                      className="size-4 accent-emerald-400"
                    />
                    <label
                      htmlFor={`dashboard-shortcut-${shortcut.id}`}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      {isEnglish ? shortcut.en : shortcut.pt}
                    </label>
                    {draftShortcuts.includes(shortcut.id) && (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={copy('Mover para cima', 'Move up')}
                          onClick={() =>
                            moveShortcut(
                              draftShortcuts.indexOf(shortcut.id),
                              -1,
                            )
                          }
                          disabled={draftShortcuts.indexOf(shortcut.id) === 0}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={copy('Mover para baixo', 'Move down')}
                          onClick={() =>
                            moveShortcut(draftShortcuts.indexOf(shortcut.id), 1)
                          }
                          disabled={
                            draftShortcuts.indexOf(shortcut.id) ===
                            draftShortcuts.length - 1
                          }
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                {copy('Atalhos selecionados:', 'Selected shortcuts:')}{' '}
                {orderedShortcuts.length}/13
              </p>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {copy('Elementos da dashboard', 'Dashboard sections')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {copy(
                    'Oculta os cartões e gráficos que não utilizas.',
                    'Hide cards and charts you do not use.',
                  )}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_LABELS.map((section) => (
                  <label
                    key={section.id}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={config.sections[section.id]}
                      onChange={(event) =>
                        updateSection(section.id, event.target.checked)
                      }
                      className="size-4 accent-emerald-400"
                    />
                    {isEnglish ? section.en : section.pt}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {copy('Estatísticas da overview', 'Overview statistics')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {copy(
                    'Escolhe os indicadores que aparecem no resumo do teu negócio.',
                    'Choose which metrics appear in your business overview.',
                  )}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { id: 'revenue', pt: 'Faturação', en: 'Revenue' },
                    {
                      id: 'appointments',
                      pt: 'Marcações ativas',
                      en: 'Active appointments',
                    },
                    {
                      id: 'clients',
                      pt: 'Clientes registados',
                      en: 'Registered clients',
                    },
                    { id: 'services', pt: 'Serviços', en: 'Services' },
                  ] as const
                ).map((metric) => (
                  <label
                    key={metric.id}
                    className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={config.visibleMetrics.includes(
                        metric.id,
                      )}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          visibleMetrics: event.target.checked
                            ? [
                                ...new Set([
                                  ...current.visibleMetrics,
                                  metric.id,
                                ]),
                              ]
                            : current.visibleMetrics.filter(
                                (key) => key !== metric.id,
                              ),
                        }))
                      }
                      className="size-4 accent-emerald-400"
                    />
                    {isEnglish ? metric.en : metric.pt}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="size-4 text-zinc-400" />
                <h3 className="text-sm font-semibold">
                  {copy('Cor dos detalhes', 'Accent color')}
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={isEnglish ? color.en : color.pt}
                    aria-pressed={
                      config.accentColor === color.value
                    }
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        accentColor: color.value,
                      }))
                    }
                    className="flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color.value,
                      borderColor:
                        config.accentColor === color.value
                          ? '#fff'
                          : 'transparent',
                    }}
                  >
                    {config.accentColor === color.value && (
                      <Check className="size-4 text-zinc-950" />
                    )}
                  </button>
                ))}
                <label
                  className="flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-900"
                  title={copy(
                    'Escolher cor personalizada',
                    'Choose custom color',
                  )}
                >
                  <input
                    type="color"
                    aria-label={copy(
                      'Escolher cor personalizada',
                      'Choose custom color',
                    )}
                    value={config.accentColor}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        accentColor: event.target.value,
                      }))
                    }
                    className="size-12 cursor-pointer border-0 bg-transparent"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <span
                  className="size-8 rounded-lg"
                  style={{ backgroundColor: config.accentColor }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400">
                    {copy('Pré-visualização', 'Preview')}
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: config.accentColor }}
                  >
                    {copy('Detalhes com a tua cor', 'Details in your color')}
                  </p>
                </div>
                <code className="text-xs text-zinc-500">
                  {config.accentColor.toUpperCase()}
                </code>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <p className="text-xs leading-5 text-zinc-500">
              {copy(
                'Guarda todas as alterações no botão do topo das definições.',
                'Save all changes using the button at the top of Settings.',
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {copy('Fechar', 'Close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
