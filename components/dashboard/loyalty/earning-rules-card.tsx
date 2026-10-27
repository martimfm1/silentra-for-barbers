'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';
import { useLanguage } from '@/context/LanguageContext';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { t } = useLanguage();
  const confirm = useDashboardConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [points, setPoints] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.loadError'));
      setServices(data.services ?? []);
      setRules(data.rules ?? []);
      if (!serviceId && data.services?.[0]) setServiceId(data.services[0].id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('earningRules.loadGenericError'),
      );
    } finally {
      setLoading(false);
    }
  }, [serviceId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule() {
    const selected = services.find((service) => service.id === serviceId);
    const value = Number(points);
    if (!selected || !Number.isInteger(value) || value <= 0)
      return toast.error(
        t('earningRules.invalidSelection'),
      );
    setSaving(true);
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        error instanceof Error ? error.message : t('earningRules.createGenericError'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: Rule) {
    try {
      const response = await fetch('/api/loyalty/earning-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.updateError'));
      setRules((current) =>
        current.map((item) => (item.id === rule.id ? data.rule : item)),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('earningRules.updateGenericError'),
      );
    }
  }

  async function deleteRule(id: string) {
    const confirmed = await confirm({
      title: t('earningRules.removeConfirm'),
      description: t('earningRules.removeDescription'),
      confirmLabel: t('earningRules.removeRule'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const response = await fetch(
        `/api/loyalty/earning-rules?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('earningRules.removeError'));
      setRules((current) => current.filter((item) => item.id !== id));
      toast.success(t('earningRules.ruleRemoved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('earningRules.removeGenericError'),
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('earningRules.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('earningRules.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <div>
            <Label>{t('earningRules.service')}</Label>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('earningRules.selectService')}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · €{Number(service.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t('earningRules.points')}</Label>
            <Input
              className="mt-1 min-h-11"
              type="number"
              min="1"
              max="100000"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </div>
          <Button
            onClick={() => void addRule()}
            disabled={saving || !serviceId}
            className="min-h-11"
          >
            <Plus className="mr-2 size-4" />
            {t('earningRules.addRule')}
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />{t('common.loading')}
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <p className="font-medium">{t('earningRules.noRules')}</p>
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
                      <p className="mt-1 text-xs text-muted-foreground">
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
                      {rule.active ? t('earningRules.active') : t('earningRules.paused')}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="min-h-10 flex-1"
                      onClick={() => void toggleRule(rule)}
                    >
                      <Check className="mr-2 size-4" />
                      {rule.active ? t('earningRules.pause') : t('earningRules.activate')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      onClick={() => void deleteRule(rule.id)}
                      aria-label={t('earningRules.removeRule')}
                    >
                      <Trash2 className="size-4 text-red-300" />
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
