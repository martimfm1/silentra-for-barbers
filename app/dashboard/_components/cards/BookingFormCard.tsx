'use client';

import { format } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { type BookingFormProps } from '@/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
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
import {
  CalendarIcon,
  Plus,
  UserRound,
  Scissors,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';

export function BookingForm({
  clients,
  services,
  professionals,
  loading,
  formData,
  setFormData,
  selectedProfessionalId,
  setSelectedProfessionalId,
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  onSubmit,
}: BookingFormProps) {
  const { t } = useLanguage();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="interactive-card border border-emerald-500/20 bg-zinc-950/70 shadow-xl">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Plus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg text-zinc-50">
              {t('bookingForm.title')}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {t('bookingForm.description')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <form onSubmit={onSubmit} className="space-y-7">
          <section
            className="space-y-4"
            aria-labelledby="booking-client-section"
          >
            <div className="flex items-center gap-2">
              <UserRound
                className="size-4 text-emerald-400"
                aria-hidden="true"
              />
              <h2
                id="booking-client-section"
                className="text-sm font-semibold text-zinc-200"
              >
                {t('bookingForm.customer')}
              </h2>
              <span className="text-xs text-zinc-600">1/2</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="grid gap-2 lg:col-span-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-client"
                >
                  {t('bookingForm.existingCustomer')}{' '}
                  <span className="font-normal text-zinc-600">{t('bookingForm.optional')}</span>
                </label>
                <Combobox
                  value={formData.clientId || ''}
                  onValueChange={(val) => {
                    const cl = clients.find((c) => c.id === val);
                    if (cl) {
                      setFormData({
                        ...formData,
                        clientId: cl.id,
                        name_complete: cl.name_complete,
                        num_phone: cl.num_phone,
                        email: cl.email || '',
                        birth_date: cl.birth_date || '',
                      });
                    }
                  }}
                >
                  <ComboboxInput
                    id="booking-client"
                    placeholder={t('bookingForm.searchCustomer')}
                    className="min-h-11 border-white/10 bg-zinc-900 text-white"
                  />
                  <ComboboxContent className="border-white/10 bg-zinc-900 text-white">
                    <ComboboxList>
                      <ComboboxEmpty>{t('bookingForm.noCustomerFound')}</ComboboxEmpty>
                      {clients.map((c) => (
                        <ComboboxItem key={c.id} value={c.id}>
                          {c.name_complete}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-name"
                >
                  {t('bookingForm.fullName')}
                </label>
                <input
                  id="booking-name"
                  required
                  placeholder={t('bookingForm.namePlaceholder')}
                  className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={formData.name_complete}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      clientId: '',
                      name_complete: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-phone"
                >
                  {t('bookingForm.mobile')}
                </label>
                <input
                  id="booking-phone"
                  required
                  placeholder="912 345 678"
                  type="tel"
                  inputMode="tel"
                  className="min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={formData.num_phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      clientId: '',
                      num_phone: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-birth-date"
                >
                  {t('bookingForm.birthDate')}{' '}
                  <span className="font-normal text-zinc-600">(opcional)</span>
                </label>
                <input
                  id="booking-birth-date"
                  type="date"
                  max={today}
                  className="color-scheme-dark min-h-11 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={formData.birth_date}
                  onChange={(e) =>
                    setFormData({ ...formData, birth_date: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section
            className="space-y-4 border-t border-white/10 pt-6"
            aria-labelledby="booking-details-section"
          >
            <div className="flex items-center gap-2">
              <Scissors className="size-4 text-amber-400" aria-hidden="true" />
              <h2
                id="booking-details-section"
                className="text-sm font-semibold text-zinc-200"
              >
                {t('bookingForm.serviceAndProfessional')}
              </h2>
              <span className="text-xs text-zinc-600">2/2</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-service"
                >
                  {t('bookingForm.service')}
                </label>
                <Select
                  value={formData.service_id}
                  onValueChange={(val) =>
                    setFormData({ ...formData, service_id: val })
                  }
                >
                  <SelectTrigger
                    id="booking-service"
                    className="min-h-11 cursor-pointer border-white/10 bg-zinc-900 text-white"
                  >
                    <SelectValue placeholder={t('bookingForm.chooseService')} />
                  </SelectTrigger>
                  <SelectContent className="cursor-pointer border-white/10 bg-zinc-900 text-white">
                    <SelectGroup>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ·{' '}
                          {Number(s.price).toFixed(2).replace('.', ',')} €
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-barber"
                >
                  Barbeiro
                </label>
                <Select
                  value={selectedProfessionalId}
                  onValueChange={setSelectedProfessionalId}
                >
                  <SelectTrigger
                    id="booking-barber"
                    className="min-h-11 cursor-pointer border-white/10 bg-zinc-900 text-white"
                  >
                    <SelectValue placeholder="Escolher barbeiro" />
                  </SelectTrigger>
                  <SelectContent className="cursor-pointer border-white/10 bg-zinc-900 text-white">
                    <SelectGroup>
                      {professionals.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section
            className="space-y-4 border-t border-white/10 pt-6"
            aria-labelledby="booking-time-section"
          >
            <div className="flex items-center gap-2">
              <CalendarClock
                className="size-4 text-blue-400"
                aria-hidden="true"
              />
              <h2
                id="booking-time-section"
                className="text-sm font-semibold text-zinc-200"
              >
                Data e hora
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-zinc-400">
                  Data
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        'min-h-11 w-full justify-start border border-white/10 bg-white/5 text-white hover:bg-white/10',
                        !selectedDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon
                        className="mr-2 size-4"
                        aria-hidden="true"
                      />
                      {selectedDate
                        ? format(new Date(selectedDate + 'T00:00:00'), 'PPP')
                        : 'Escolher data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto cursor-pointer border-zinc-800 bg-zinc-900 p-0">
                    <Calendar
                      mode="single"
                      selected={
                        selectedDate
                          ? new Date(selectedDate + 'T00:00:00')
                          : undefined
                      }
                      onSelect={(d) =>
                        d && setSelectedDate(format(d, 'yyyy-MM-dd'))
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <label
                  className="text-xs font-medium text-zinc-400"
                  htmlFor="booking-time"
                >
                  Hora
                </label>
                <input
                  id="booking-time"
                  type="time"
                  required
                  className="color-scheme-dark min-h-11 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-zinc-500">
              Os campos obrigatórios estão reduzidos ao essencial para criares a
              marcação rapidamente.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="silentra-action-primary min-h-11 w-full bg-emerald-600 px-5 text-white hover:bg-emerald-500 sm:w-auto"
            >
              {loading ? (
                <Spinner className="mr-2" />
              ) : (
                <ArrowRight className="mr-2 size-4" aria-hidden="true" />
              )}
              {loading ? t('bookingForm.saving') : t('bookingForm.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
