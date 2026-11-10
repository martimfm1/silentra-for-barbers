'use client';

import { useEffect, useState } from 'react';
import { CalendarX2, Check, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { barbershopService } from '@/app/dashboard/_services/barbershop.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PRESETS = [0, 2, 6, 12, 24, 48, 72] as const;

export function AgendaCancellationPolicyPanel() {
  const { barbershopId } = useBarbershop();
  const { locale } = useLanguage();
  const english = locale === 'en';
  const [hours, setHours] = useState(24);
  const [initial, setInitial] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!barbershopId) return;
      setLoading(true);
      const result = await barbershopService.getConfig(barbershopId);
      if (!active) return;
      if (result.error) toast.error(english ? 'Could not load cancellation policy.' : 'Não foi possível carregar a política de cancelamento.');
      const value = Math.max(0, Math.min(720, Number(result.data?.time_limit_cancellation_hours ?? 24)));
      setHours(value);
      setInitial(value);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [barbershopId, english]);

  const invalid = !Number.isInteger(hours) || hours < 0 || hours > 720;
  const dirty = hours !== initial;
  async function save() {
    if (!barbershopId || !dirty || invalid || saving) return;
    setSaving(true);
    const result = await barbershopService.updateConfig(barbershopId, { time_limit_cancellation_hours: hours });
    if (result.error) toast.error(result.error.message);
    else {
      setInitial(hours);
      toast.success(english ? 'Cancellation policy saved.' : 'Política de cancelamento guardada.');
    }
    setSaving(false);
  }

  return (
    <Card className="border border-white/10 bg-white/[.02] text-zinc-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarX2 className="size-4 text-amber-300" />{english ? 'Cancellation policy' : 'Política de cancelamento'}</CardTitle>
        <p className="text-sm leading-5 text-zinc-500">{english ? 'Choose how long before an appointment customers can cancel or reschedule.' : 'Define com quantas horas de antecedência os clientes podem cancelar ou reagendar uma marcação.'}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-2 text-sm text-zinc-300">
            {english ? 'Hours before appointment' : 'Horas antes da marcação'}
            <Input type="number" min={0} max={720} step={1} value={hours} disabled={loading || saving} onChange={(event) => setHours(Number(event.target.value))} className="min-h-12 rounded-xl border-white/10 bg-white/[0.04] text-lg tabular-nums" aria-invalid={invalid} />
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-sm">
            <Clock3 className="size-4 text-zinc-500" />
            <span className="font-medium">{hours === 0 ? (english ? 'No minimum' : 'Sem prazo mínimo') : english ? `${hours} hours` : `${hours} horas`}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => <button key={preset} type="button" disabled={loading || saving} onClick={() => setHours(preset)} aria-label={english ? `Set cancellation notice to ${preset} hours` : `Definir antecedência de cancelamento para ${preset} horas`} aria-pressed={hours === preset} className={`min-h-10 rounded-xl border px-3 text-sm transition-colors ${hours === preset ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : 'border-white/10 bg-white/[.03] text-zinc-400 hover:bg-white/[.06]'}`}>{preset === 0 ? (english ? 'No limit' : 'Sem limite') : english ? `${preset}h` : `${preset}h`}</button>)}
        </div>
        {invalid ? <p className="text-xs text-red-300">{english ? 'Enter an integer between 0 and 720.' : 'Introduz um número inteiro entre 0 e 720.'}</p> : null}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={!dirty || invalid || loading || saving} className="min-h-10">
            {saving ? (english ? 'Saving…' : 'A guardar…') : <><Check className="mr-2 size-4" />{english ? 'Save policy' : 'Guardar política'}</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
