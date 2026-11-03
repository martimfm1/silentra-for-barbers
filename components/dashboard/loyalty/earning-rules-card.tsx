'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';
import { useLanguage } from '@/context/LanguageContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Gift, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Rule {
  id: string;
  name: string;
  service_id: string;
  points: number;
  active: boolean;
}

export function EarningRulesCard() {
  const { t, locale } = useLanguage();
  const confirm = useDashboardConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [points, setPoints] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingRuleId, setChangingRuleId] = useState<string | null>(null);

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.active),
    [rules],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.loadError'));
      const nextServices = Array.isArray(data.services) ? data.services : [];
      setServices(nextServices);
      setRules(Array.isArray(data.rules) ? data.rules : []);
      setServiceId((current) =>
        nextServices.some((service: Service) => service.id === current)
          ? current
          : nextServices[0]?.id ?? '',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('earningRules.loadGenericError'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule() {
    const selected = services.find((service) => service.id === serviceId);
    const value = Number(points);
    if (!selected || !Number.isInteger(value) || value <= 0 || value > 100000)
      return toast.error(t('earningRules.invalidSelection'));

    setSaving(true);
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: `${selected.name} — ${value} pontos`,
          serviceId,
          points: value,
          active: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.createError'));
      setRules((current) => [data.rule, ...current]);
      setPoints('10');
      toast.success(t('earningRules.ruleCreated'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('earningRules.createGenericError'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: Rule) {
    if (changingRuleId) return;
    setChangingRuleId(rule.id);
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.updateError'));
      setRules((current) =>
        current.map((item) => (item.id === rule.id ? data.rule : item)),
      );
      toast.success(
        rule.active ? t('earningRules.pausedSuccess') : t('earningRules.activatedSuccess'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('earningRules.updateGenericError'),
      );
    } finally {
      setChangingRuleId(null);
    }
  }

  async function deleteRule(id: string) {
    const confirmed = await confirm({
      title: t('earningRules.removeConfirm'),
      description: t('earningRules.removeDescription'),
      confirmLabel: t('earningRules.removeRule'),
      destructive: true,
    });
    if (!confirmed || changingRuleId) return;

    setChangingRuleId(id);
    try {
      const response = await fetch(
        `/api/loyalty/earning-rules?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.removeError'));
      setRules((current) => current.filter((item) => item.id !== id));
      toast.success(t('earningRules.ruleRemoved'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('earningRules.removeGenericError'),
      );
    } finally {
      setChangingRuleId(null);
    }
  }

  return (
    <Card className="border-white/10">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{t('earningRules.title')}</CardTitle>
            <CardDescription className="mt-1">
              {t('earningRules.description')}
            </CardDescription>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary tabular-nums">
            {activeRules.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5" aria-labelledby="earning-rule-create">
          <div className="mb-4">
            <h3 id="earning-rule-create" className="text-sm font-semibold">
              {t('earningRules.addRule')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {locale === 'en'
                ? 'Choose the service and decide how many points a completed booking earns.'
                : 'Escolhe o serviço e define quantos pontos uma marcação concluída atribui.'}
            </p>
          </div>

          {services.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
              <p className="text-sm font-medium">
                {locale === 'en' ? 'No services available yet' : 'Ainda não tens serviços disponíveis'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {locale === 'en'
                  ? 'Create at least one service before setting its points.'
                  : 'Cria pelo menos um serviço para poderes definir os pontos.'}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href="/dashboard/servicos">
                  {locale === 'en' ? 'Manage services' : 'Gerir serviços'}
                </a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="loyalty-earning-service">{t('earningRules.service')}</Label>
                <select
                  id="loyalty-earning-service"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  disabled={loading || saving}
                >
                  <option value="">{t('earningRules.selectService')}</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(service.price))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loyalty-earning-points">{t('earningRules.points')}</Label>
                <Input
                  id="loyalty-earning-points"
                  className="min-h-11"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  inputMode="numeric"
                  value={points}
                  onChange={(event) => setPoints(event.target.value)}
                  disabled={saving}
                />
              </div>
              <Button
                type="button"
                onClick={() => void addRule()}
                disabled={saving || loading || !serviceId}
                className="min-h-11 sm:min-w-32"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {t('earningRules.addRule')}
              </Button>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              {locale === 'en' ? 'Configured rules' : 'Regras configuradas'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === 'en'
                ? 'You can pause or remove a rule at any time.'
                : 'Podes pausar ou remover uma regra a qualquer momento.'}
            </p>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {rules.length} {locale === 'en' ? 'rules' : 'regras'}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 font-medium">{t('earningRules.noRules')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('earningRules.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rules.map((rule) => {
              const service = services.find(
                (item) => item.id === rule.service_id,
              );
              const busy = changingRuleId === rule.id;
              return (
                <article
                  key={rule.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {service?.name ?? rule.name}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {t('earningRules.pointsPerBooking', { points: rule.points })}
                      </p>
                    </div>
                    <span
                      className={
                        rule.active
                          ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300'
                          : 'rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-500'
                      }
                    >
                      {rule.active
                        ? t('earningRules.active')
                        : t('earningRules.paused')}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 flex-1"
                      onClick={() => void toggleRule(rule)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="mr-2 size-4" aria-hidden="true" />
                      )}
                      {rule.active
                        ? t('earningRules.pause')
                        : t('earningRules.activate')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      onClick={() => void deleteRule(rule.id)}
                      disabled={busy}
                      aria-label={t('earningRules.removeRule')}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4 text-red-300" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
