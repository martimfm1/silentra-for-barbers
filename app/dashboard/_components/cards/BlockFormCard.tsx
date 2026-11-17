'use client';

import { format } from 'date-fns';
import {
  CalendarDays,
  CalendarOff,
  Clock3,
  FileText,
  UserRound,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { type BlockScheduleFormProps } from '@/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const fieldClassName =
  'box-border min-h-12 w-full min-w-0 rounded-xl border border-white/[0.09] bg-white/[0.045] px-3.5 text-sm text-zinc-100 shadow-inner shadow-black/10 outline-none transition placeholder:text-zinc-600 hover:border-white/[0.15] focus-visible:border-rose-400/50 focus-visible:ring-2 focus-visible:ring-rose-400/10';

const labelClassName =
  'mb-2 block text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500';

export function BlockScheduleForm({
  professionals,
  loading,
  blockFormData,
  setBlockFormData,
  onSubmit,
}: BlockScheduleFormProps) {
  const { t } = useLanguage();

  return (
    <div className="relative -m-1 overflow-hidden rounded-2xl bg-zinc-950 sm:-m-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_left,rgba(244,63,94,0.13),transparent_68%)]"
      />
      <form
        onSubmit={onSubmit}
        className="relative flex min-w-0 flex-col"
      >
        <header className="border-b border-white/[0.07] px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/[0.09] text-rose-300 shadow-[0_8px_30px_rgba(244,63,94,0.08)]">
              <CalendarOff className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                  {t('agenda.blockTime')}
                </h3>
                <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-300/90">
                  {t('agenda.blockTime')}
                </span>
              </div>
              <p className="mt-1 max-w-md text-xs leading-5 text-zinc-500">
                {t('agenda.blockTimeDescription')}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-x-4 gap-y-5 px-4 py-5 sm:grid-cols-2 sm:px-6 sm:py-6">
          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="block-professional" className={labelClassName}>
              <span className="inline-flex items-center gap-2">
                <UserRound className="size-3.5" aria-hidden="true" />
                {t('agenda.blockProfessional')}
              </span>
            </label>
            <Select
              value={blockFormData.professional_id}
              onValueChange={(val) =>
                setBlockFormData({ ...blockFormData, professional_id: val })
              }
            >
              <SelectTrigger
                id="block-professional"
                className={cn(fieldClassName, 'cursor-pointer')}
              >
                <SelectValue placeholder={t('agenda.selectProfessional')} />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] border-white/10 bg-zinc-900 text-white">
                <SelectGroup>
                  {professionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>
                      {professional.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label className={labelClassName}>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {t('agenda.blockDate')}
              </span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    fieldClassName,
                    'justify-start gap-3 font-normal hover:bg-white/[0.07]',
                    !blockFormData.start_date && 'text-zinc-500',
                  )}
                >
                  <CalendarDays className="size-4 shrink-0 text-rose-300" />
                  <span className="truncate">
                    {blockFormData.start_date
                      ? format(
                          new Date(blockFormData.start_date + 'T00:00:00'),
                          'PPP',
                        )
                      : t('agenda.chooseDate')}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto border-white/10 bg-zinc-900 p-2 text-white shadow-2xl"
              >
                <Calendar
                  mode="single"
                  selected={
                    blockFormData.start_date
                      ? new Date(blockFormData.start_date + 'T00:00:00')
                      : undefined
                  }
                  onSelect={(date) =>
                    date &&
                    setBlockFormData({
                      ...blockFormData,
                      start_date: format(date, 'yyyy-MM-dd'),
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="min-w-0">
            <label htmlFor="block-start-time" className={labelClassName}>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {t('agenda.startTime')}
              </span>
            </label>
            <input
              id="block-start-time"
              type="time"
              required
              className={cn(fieldClassName, 'color-scheme-dark cursor-pointer')}
              value={blockFormData.start_time}
              onChange={(event) =>
                setBlockFormData({
                  ...blockFormData,
                  start_time: event.target.value,
                })
              }
            />
          </div>

          <div className="min-w-0">
            <label htmlFor="block-end-time" className={labelClassName}>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {t('agenda.endTime')}
              </span>
            </label>
            <input
              id="block-end-time"
              type="time"
              required
              className={cn(fieldClassName, 'color-scheme-dark cursor-pointer')}
              value={blockFormData.end_time}
              onChange={(event) =>
                setBlockFormData({
                  ...blockFormData,
                  end_time: event.target.value,
                })
              }
            />
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label htmlFor="block-reason" className={labelClassName}>
              <span className="inline-flex items-center gap-2">
                <FileText className="size-3.5" aria-hidden="true" />
                {t('agenda.blockReason')}
                <span className="font-normal normal-case tracking-normal text-zinc-700">
                  · {t('common.optional')}
                </span>
              </span>
            </label>
            <input
              id="block-reason"
              placeholder={t('agenda.blockReasonPlaceholder')}
              className={cn(fieldClassName, 'placeholder:text-zinc-600')}
              value={blockFormData.reason || ''}
              onChange={(event) =>
                setBlockFormData({
                  ...blockFormData,
                  reason: event.target.value,
                })
              }
            />
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-white/[0.07] bg-white/[0.015] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[11px] leading-4 text-zinc-600">
            {t('agenda.blockTimeDescription')}
          </p>
          <Button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-rose-500 px-5 font-semibold text-white shadow-[0_8px_24px_rgba(244,63,94,0.16)] transition hover:bg-rose-400 disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner className="mr-2 size-4" />
                {t('agenda.savingBlock')}
              </>
            ) : (
              <>
                <CalendarOff className="mr-2 size-4" aria-hidden="true" />
                {t('agenda.saveBlock')}
              </>
            )}
          </Button>
        </footer>
      </form>
    </div>
  );
}
