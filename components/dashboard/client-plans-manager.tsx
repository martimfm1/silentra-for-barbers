'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Settings2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PlanStatus = 'active' | 'paused' | 'cancelled';
type PaymentMethod = 'cash' | 'mbway' | 'transfer' | 'card' | 'other';

type PlanPayment = {
  id: string;
  period_start: string;
  period_end: string;
  amount: number | string;
  status: 'pending' | 'paid';
  payment_method?: PaymentMethod | null;
  paid_at?: string | null;
};

type ClientPlan = {
  id: string;
  name: string;
  monthly_price: number | string;
  included_appointments: number;
  service_ids: string[];
  start_date: string;
  status: PlanStatus;
  notes?: string | null;
  used_appointments?: number | null;
  remaining_appointments?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  current_payment?: PlanPayment | null;
  payment_history?: PlanPayment[];
};

type ServiceOption = { id: string; name: string };

type PlanForm = {
  name: string;
  monthly_price: string;
  included_appointments: string;
  service_ids: string[];
  start_date: string;
  notes: string;
};

const emptyForm = (): PlanForm => ({
  name: '',
  monthly_price: '',
  included_appointments: '2',
  service_ids: [],
  start_date: new Date().toISOString().slice(0, 10),
  notes: '',
});

async function getAuthHeaders(
  json: boolean,
  sessionExpiredMessage: string,
): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error(sessionExpiredMessage);

  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export function ClientPlansManager({ clientId }: { clientId: string }) {
  const { t, locale } = useLanguage();
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClientPlan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mbway');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/clients/${clientId}/plans`, {
        headers: await getAuthHeaders(false, t('clientsPage.planSessionError')),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t('clientsPage.planLoadError'));
      }
      setPlans(Array.isArray(payload.plans) ? payload.plans : []);
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('clientsPage.planLoadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [clientId, t]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const activePlan = plans.find((plan) => plan.status === 'active') ?? null;
  const previousPlans = plans.filter((plan) => plan.status !== 'active');

  function openCreateDialog() {
    setEditingPlan(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEditDialog(plan: ClientPlan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      monthly_price: String(plan.monthly_price),
      included_appointments: String(plan.included_appointments),
      service_ids: plan.service_ids ?? [],
      start_date: plan.start_date,
      notes: plan.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const editing = Boolean(editingPlan);
      const response = await fetch(`/api/crm/clients/${clientId}/plans`, {
        method: editing ? 'PATCH' : 'POST',
        headers: await getAuthHeaders(true, t('clientsPage.planSessionError')),
        body: JSON.stringify(
          editing
            ? { ...form, plan_id: editingPlan?.id, action: 'update' }
            : form,
        ),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t('clientsPage.planSaveError'));
      }

      toast.success(
        editing ? t('clientsPage.planUpdated') : t('clientsPage.planCreated'),
      );
      setDialogOpen(false);
      await loadPlans();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('clientsPage.planSaveError'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function updatePlanAction(
    plan: ClientPlan,
    action: 'pause' | 'activate' | 'cancel' | 'mark-paid' | 'mark-pending',
  ) {
    if (saving) return;
    if (
      action === 'cancel' &&
      !window.confirm(t('clientsPage.planCancelConfirm'))
    ) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/crm/clients/${clientId}/plans`, {
        method: 'PATCH',
        headers: await getAuthHeaders(true, t('clientsPage.planSessionError')),
        body: JSON.stringify({
          plan_id: plan.id,
          action,
          ...(action === 'mark-paid' ? { payment_method: paymentMethod } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? t('clientsPage.planActionError'));
      }

      const messages: Record<typeof action, string> = {
        pause: t('clientsPage.planPaused'),
        activate: t('clientsPage.planResumed'),
        cancel: t('clientsPage.planCancelled'),
        'mark-paid': t('clientsPage.planPaymentSaved'),
        'mark-pending': t('clientsPage.planPaymentPending'),
      };
      toast.success(messages[action]);
      await loadPlans();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('clientsPage.planActionError'),
      );
    } finally {
      setSaving(false);
    }
  }

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(value) || 0);
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return '—';
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function serviceNames(plan: ClientPlan) {
    if (!plan.service_ids?.length) return t('clientsPage.planAllServices');
    const names = plan.service_ids
      .map((id) => services.find((service) => service.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length ? names.join(', ') : t('clientsPage.planSelectedServices');
  }

  const used = activePlan?.used_appointments ?? 0;
  const quota = activePlan?.included_appointments ?? 0;
  const usagePercent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const currentPayment = activePlan?.current_payment ?? null;
  const isPaid = currentPayment?.status === 'paid';
  const isFutureStart =
    activePlan?.start_date
      ? new Date(`${activePlan.start_date}T00:00:00`).getTime() >
        new Date(new Date().toDateString()).getTime()
      : false;

  return (
    <>
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <CreditCard className="size-5 shrink-0 text-blue-400" />
            <span>{t('clientsPage.plansTitle')}</span>
          </CardTitle>
          {activePlan ? (
            <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              {t('clientsPage.planActive')}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div
              className="flex min-h-24 items-center justify-center"
              role="status"
              aria-label={t('clientsPage.planLoading')}
            >
              <Spinner className="size-5" />
            </div>
          ) : activePlan ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">{activePlan.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t('clientsPage.planMonthlyPrice')}
                  </p>
                </div>
                <p className="text-xl font-semibold tabular-nums text-zinc-100">
                  {formatCurrency(activePlan.monthly_price)}
                  <span className="ml-1 text-xs font-normal text-zinc-500">
                    / {t('clientsPage.planMonth')}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-zinc-200">
                    {t('clientsPage.planUsage')}
                  </span>
                  <span className="tabular-nums text-zinc-300">
                    {used} / {quota}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label={t('clientsPage.planUsage')}
                  aria-valuemin={0}
                  aria-valuemax={quota}
                  aria-valuenow={Math.min(used, quota)}
                >
                  <div
                    className="h-full rounded-full bg-blue-400 transition-[width]"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {t('clientsPage.planRemaining', {
                    count: Math.max(0, quota - used),
                  })}
                </p>
              </div>

              <div className="space-y-1 text-xs text-zinc-500">
                <p>{t('clientsPage.planServices')}: <span className="text-zinc-300">{serviceNames(activePlan)}</span></p>
                <p>
                  {t('clientsPage.planCycle')}: <span className="text-zinc-300">{formatDate(activePlan.period_start)} — {activePlan.period_end ? formatDate(new Date(new Date(`${activePlan.period_end}T00:00:00`).getTime() - 86400000).toISOString().slice(0, 10)) : '—'}</span>
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-zinc-400" />
                  <p className="text-sm font-medium text-zinc-200">
                    {t('clientsPage.planPayment')}
                  </p>
                  <span
                    className={`ml-auto rounded-full px-2 py-1 text-[11px] font-medium ${isPaid ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}
                  >
                    {isPaid
                      ? t('clientsPage.planPaid')
                      : isFutureStart
                        ? t('clientsPage.planNotStarted')
                        : t('clientsPage.planUnpaid')}
                  </span>
                </div>
                {currentPayment?.paid_at ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t('clientsPage.planPaidOn', {
                      date: formatDate(currentPayment.paid_at),
                    })}
                  </p>
                ) : null}
                {!isPaid && !isFutureStart ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      aria-label={t('clientsPage.planPaymentMethod')}
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as PaymentMethod)
                      }
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-blue-500/50"
                    >
                      <option value="mbway">MB WAY</option>
                      <option value="cash">{t('clientsPage.planCash')}</option>
                      <option value="transfer">{t('clientsPage.planTransfer')}</option>
                      <option value="card">{t('clientsPage.planCard')}</option>
                      <option value="other">{t('clientsPage.planOther')}</option>
                    </select>
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void updatePlanAction(activePlan, 'mark-paid')}
                      className="min-h-10"
                    >
                      <BadgeCheck className="mr-2 size-4" />
                      {t('clientsPage.planMarkPaid')}
                    </Button>
                  </div>
                ) : isPaid ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void updatePlanAction(activePlan, 'mark-pending')}
                    className="mt-2 min-h-9 px-2 text-xs text-zinc-400"
                  >
                    {t('clientsPage.planUndoPayment')}
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => openEditDialog(activePlan)}
                  className="min-h-10 flex-1"
                >
                  <Settings2 className="mr-2 size-4" />
                  {t('clientsPage.planEdit')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void updatePlanAction(activePlan, 'pause')}
                  className="min-h-10"
                >
                  <PauseCircle className="mr-2 size-4" />
                  {t('clientsPage.planPause')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void updatePlanAction(activePlan, 'cancel')}
                  className="min-h-10 text-red-300 hover:text-red-200"
                >
                  {t('clientsPage.planEnd')}
                </Button>
              </div>

              {activePlan.payment_history?.length ? (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-xs font-medium text-zinc-400">
                    {t('clientsPage.planPaymentHistory')}
                  </p>
                  {activePlan.payment_history.slice(0, 4).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-zinc-500">
                        {formatDate(payment.period_start)}
                      </span>
                      <span className="tabular-nums text-zinc-300">
                        {formatCurrency(payment.amount)}
                      </span>
                      <span className={payment.status === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>
                        {payment.status === 'paid'
                          ? t('clientsPage.planPaid')
                          : t('clientsPage.planUnpaid')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
              <CalendarClock className="mx-auto size-7 text-zinc-500" />
              <p className="mt-2 text-sm font-medium text-zinc-200">
                {t('clientsPage.planEmptyTitle')}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500">
                {t('clientsPage.planEmptyDescription')}
              </p>
              <Button
                type="button"
                onClick={openCreateDialog}
                className="mt-4 min-h-10"
              >
                <Plus className="mr-2 size-4" />
                {t('clientsPage.planAdd')}
              </Button>
            </div>
          )}

          {previousPlans.length ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-medium text-zinc-400">
                {t('clientsPage.planPrevious')}
              </p>
              {previousPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{plan.name}</p>
                    <p className="text-xs text-zinc-500">
                      {formatCurrency(plan.monthly_price)} / {t('clientsPage.planMonth')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      {plan.status === 'paused'
                        ? t('clientsPage.planPausedStatus')
                        : t('clientsPage.planCancelledStatus')}
                    </span>
                    {plan.status === 'paused' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void updatePlanAction(plan, 'activate')}
                        className="min-h-9"
                      >
                        <PlayCircle className="mr-1.5 size-4" />
                        {t('clientsPage.planResume')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlan
                ? t('clientsPage.planEditTitle')
                : t('clientsPage.planCreateTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {t('clientsPage.planFormDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-4">
            <div className="grid gap-2">
              <label htmlFor="client-plan-name" className="text-xs text-zinc-400">
                {t('clientsPage.planName')}
              </label>
              <Input
                id="client-plan-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t('clientsPage.planNamePlaceholder')}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="client-plan-price" className="text-xs text-zinc-400">
                  {t('clientsPage.planMonthlyPrice')}
                </label>
                <div className="relative">
                  <Input
                    id="client-plan-price"
                    type="number"
                    min="0"
                    max="99999"
                    step="0.01"
                    required
                    value={form.monthly_price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        monthly_price: event.target.value,
                      }))
                    }
                    placeholder="26,00"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="client-plan-quota" className="text-xs text-zinc-400">
                  {t('clientsPage.planIncluded')}
                </label>
                <Input
                  id="client-plan-quota"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  required
                  value={form.included_appointments}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      included_appointments: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="client-plan-start" className="text-xs text-zinc-400">
                {t('clientsPage.planStartDate')}
              </label>
              <Input
                id="client-plan-start"
                type="date"
                required
                value={form.start_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-zinc-400">
                {t('clientsPage.planServices')}
              </legend>
              <p className="text-xs text-zinc-500">
                {t('clientsPage.planServicesHint')}
              </p>
              <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-white/10 p-3 sm:grid-cols-2">
                {services.length ? (
                  services.map((service) => {
                    const checked = form.service_ids.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-zinc-300 hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              service_ids: event.target.checked
                                ? [...current.service_ids, service.id]
                                : current.service_ids.filter((id) => id !== service.id),
                            }))
                          }
                          className="size-4 rounded border-white/20 bg-zinc-900 accent-blue-500"
                        />
                        <span>{service.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-500">
                    {t('clientsPage.planNoServices')}
                  </p>
                )}
              </div>
            </fieldset>

            <div className="grid gap-2">
              <label htmlFor="client-plan-notes" className="text-xs text-zinc-400">
                {t('clientsPage.planNotes')}
              </label>
              <Textarea
                id="client-plan-notes"
                rows={3}
                maxLength={2000}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder={t('clientsPage.planNotesPlaceholder')}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
                className="min-h-11"
              >
                {t('clientsPage.planCancel')}
              </Button>
              <Button type="submit" disabled={saving} className="min-h-11">
                {saving ? <Spinner className="mr-2 size-4" /> : <RefreshCw className="mr-2 size-4" />}
                {editingPlan
                  ? t('clientsPage.planSave')
                  : t('clientsPage.planCreate')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
