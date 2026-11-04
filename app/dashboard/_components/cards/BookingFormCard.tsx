'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { type BookingFormProps } from '@/types';
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
import { DialogClose } from '@/components/ui/dialog';
import {
  CalendarClock,
  Check,
  Clock3,
  Plus,
  Search,
  Scissors,
  UserRound,
  X,
} from 'lucide-react';

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  const { t, locale } = useLanguage();
  const today = localDateValue(new Date());
  const selectedClient = clients.find((client) => client.id === formData.clientId);
  const selectedService = services.find((service) => service.id === formData.service_id);
  const singleProfessional = professionals.length === 1 ? professionals[0] : null;
  const selectedProfessional = professionals.find(
    (professional) => professional.id === selectedProfessionalId,
  );

  const [clientQuery, setClientQuery] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);

  useEffect(() => {
    if (selectedClient) setClientQuery(selectedClient.name_complete);
  }, [selectedClient?.id, selectedClient?.name_complete]);

  useEffect(() => {
    if (singleProfessional && selectedProfessionalId !== singleProfessional.id) {
      setSelectedProfessionalId(singleProfessional.id);
    }
  }, [singleProfessional?.id, selectedProfessionalId, setSelectedProfessionalId]);

  useEffect(() => {
    if (services.length === 1 && !formData.service_id) {
      setFormData((previous) => ({ ...previous, service_id: services[0].id }));
    }
  }, [formData.service_id, services, setFormData]);

  const matchingClients = useMemo(() => {
    const query = clientQuery.trim().toLocaleLowerCase(
      locale === 'en' ? 'en-GB' : 'pt-PT',
    );
    if (query.length < 2 || selectedClient) return [];

    const digits = query.replace(/\\D/g, '');
    return clients
      .filter((client) => {
        const name = client.name_complete.toLocaleLowerCase(
          locale === 'en' ? 'en-GB' : 'pt-PT',
        );
        const phone = (client.num_phone ?? '').toLocaleLowerCase();
        const phoneDigits = phone.replace(/\\D/g, '');
        return (
          name.includes(query) ||
          phone.includes(query) ||
          (digits.length >= 3 && phoneDigits.includes(digits))
        );
      })
      .slice(0, 7);
  }, [clientQuery, clients, locale, selectedClient]);

  const updateCustomer = (
    field: 'name_complete' | 'num_phone' | 'birth_date',
    value: string,
  ) => {
    setFormData((previous) => ({
      ...previous,
      clientId:
        field === 'birth_date' ? previous.clientId : undefined,
      [field]: value,
    }));
    if (field !== 'birth_date') setClientQuery('');
  };

  const chooseClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;

    setFormData((previous) => ({
      ...previous,
      clientId: client.id,
      name_complete: client.name_complete,
      num_phone: client.num_phone ?? '',
      email: client.email ?? '',
      birth_date: client.birth_date ?? '',
    }));
    setClientQuery(client.name_complete);
    setShowClientResults(false);
  };

  const clearSelectedClient = () => {
    setFormData((previous) => ({
      ...previous,
      clientId: undefined,
      name_complete: '',
      num_phone: '',
      email: '',
      birth_date: '',
    }));
    setClientQuery('');
    setShowClientResults(false);
  };

  const setQuickDate = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    setSelectedDate(localDateValue(date));
  };

  const formatPrice = (price: string) => {
    const amount = Number(price);
    return Number.isFinite(amount)
      ? `${amount.toFixed(2).replace('.', ',')} €`
      : price;
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950/95 sm:h-auto">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
              {t('bookingForm.title')}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500 sm:text-sm">
              {t('bookingForm.description')}
            </p>
          </div>
        </div>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={locale === 'en' ? 'Close booking form' : 'Fechar formulário de marcação'}
            className="size-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </DialogClose>
      </header>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
          <section
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-5"
            aria-labelledby="booking-client-section"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 id="booking-client-section" className="text-sm font-semibold text-zinc-100">
                  {t('bookingForm.customer')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {locale === 'en'
                    ? 'Find a regular or add a new customer'
                    : 'Procura um cliente habitual ou adiciona um novo'}
                </p>
              </div>
              {selectedClient ? (
                <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-300">
                  <Check className="size-3" aria-hidden="true" />
                  {locale === 'en' ? 'Linked' : 'Associado'}
                </span>
              ) : null}
            </div>

            <div className="relative mb-3 grid gap-2">
              <label htmlFor="booking-client-search" className="text-xs font-medium text-zinc-400">
                {t('bookingForm.existingCustomer')} <span className="font-normal text-zinc-600">({t('bookingForm.optional')})</span>
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  id="booking-client-search"
                  type="search"
                  autoComplete="off"
                  value={clientQuery}
                  onFocus={() => setShowClientResults(true)}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setFormData((previous) => ({ ...previous, clientId: undefined }));
                    setShowClientResults(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setShowClientResults(false);
                    if (event.key === 'Enter' && matchingClients.length > 0) {
                      event.preventDefault();
                      chooseClient(matchingClients[0].id);
                    }
                  }}
                  placeholder={t('bookingForm.searchCustomer')}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showClientResults && matchingClients.length > 0}
                  aria-controls="booking-client-results"
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-zinc-900/80 pl-10 pr-11 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
                {selectedClient ? (
                  <button
                    type="button"
                    onClick={clearSelectedClient}
                    aria-label={locale === 'en' ? 'Clear selected customer' : 'Limpar cliente selecionado'}
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {showClientResults && matchingClients.length > 0 ? (
                <div
                  id="booking-client-results"
                  role="listbox"
                  aria-label={locale === 'en' ? 'Matching customers' : 'Clientes encontrados'}
                  className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl shadow-black/50"
                >
                  {matchingClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => chooseClient(client.id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-zinc-300">
                          {client.name_complete.trim().slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-zinc-100">{client.name_complete}</span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">{client.num_phone}</span>
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
              {showClientResults && clientQuery.trim().length >= 2 && !selectedClient && matchingClients.length === 0 ? (
                <p role="status" className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs text-zinc-500">
                  {t('bookingForm.noCustomerFound')} {locale === 'en' ? 'You can continue with a new customer below.' : 'Podes continuar com um novo cliente abaixo.'}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor="booking-name" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.fullName')}
                </label>
                <input
                  id="booking-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={120}
                  placeholder={t('bookingForm.namePlaceholder')}
                  value={formData.name_complete}
                  onChange={(event) => updateCustomer('name_complete', event.target.value)}
                  className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor="booking-phone" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.mobile')}
                </label>
                <input
                  id="booking-phone"
                  name="tel"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={32}
                  placeholder="912 345 678"
                  value={formData.num_phone}
                  onChange={(event) => updateCustomer('num_phone', event.target.value)}
                  className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
              </div>
            </div>

            <details className="group mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
              <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-zinc-400 marker:hidden">
                <span>{locale === 'en' ? 'Customer details (optional)' : 'Detalhes do cliente (opcional)'}</span>
                <span className="text-zinc-600 transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-3 grid gap-1.5">
                <label htmlFor="booking-birth-date" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.birthDate')} <span className="font-normal text-zinc-600">({t('bookingForm.optional')})</span>
                </label>
                <input
                  id="booking-birth-date"
                  name="bday"
                  type="date"
                  max={today}
                  value={formData.birth_date ?? ''}
                  onChange={(event) => updateCustomer('birth_date', event.target.value)}
                  className="color-scheme-dark min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08]"
                />
              </div>
            </details>
          </section>

          <section
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-5"
            aria-labelledby="booking-service-section"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                <Scissors className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 id="booking-service-section" className="text-sm font-semibold text-zinc-100">
                  {t('bookingForm.serviceAndProfessional')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {locale === 'en' ? 'Choose what is being booked and who will do it' : 'Escolhe o serviço e quem o vai realizar'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor="booking-service" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.service')}
                </label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) => setFormData((previous) => ({ ...previous, service_id: value }))}
                >
                  <SelectTrigger
                    id="booking-service"
                    className="min-h-12 w-full rounded-xl border-white/10 bg-zinc-900 px-3.5 text-base text-white"
                  >
                    <SelectValue placeholder={t('bookingForm.chooseService')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 border-white/10 bg-zinc-900 text-white">
                    <SelectGroup>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id} className="min-h-11 rounded-lg py-2.5">
                          <span className="min-w-0 flex-1 truncate">{service.name}</span>
                          <span className="shrink-0 text-xs text-zinc-400">
                            {formatPrice(service.price)} · {Number(service.duration)} min
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {selectedService ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {Number(selectedService.duration)} min
                    <span className="text-zinc-700">·</span>
                    <span className="font-medium text-zinc-300">{formatPrice(selectedService.price)}</span>
                  </p>
                ) : null}
              </div>

              {singleProfessional ? (
                <div className="grid min-w-0 gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">{t('bookingForm.barber')}</label>
                  <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] px-3.5">
                    <UserRound className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-zinc-100">{singleProfessional.name}</span>
                    <Check className="ml-auto size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  </div>
                </div>
              ) : (
                <div className="grid min-w-0 gap-1.5">
                  <label htmlFor="booking-barber" className="text-xs font-medium text-zinc-400">
                    {t('bookingForm.barber')}
                  </label>
                  <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                    <SelectTrigger
                      id="booking-barber"
                      className="min-h-12 w-full rounded-xl border-white/10 bg-zinc-900 px-3.5 text-base text-white"
                    >
                      <SelectValue placeholder={t('bookingForm.chooseProfessional')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 border-white/10 bg-zinc-900 text-white">
                      <SelectGroup>
                        {professionals.map((professional) => (
                          <SelectItem key={professional.id} value={professional.id} className="min-h-11 rounded-lg py-2.5">
                            {professional.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {services.length === 0 || professionals.length === 0 ? (
              <p role="status" className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
                {locale === 'en'
                  ? 'Add at least one active service and one barber before creating a booking.'
                  : 'Adiciona pelo menos um serviço ativo e um barbeiro antes de criares uma marcação.'}
              </p>
            ) : null}
          </section>

          <section
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:p-5"
            aria-labelledby="booking-time-section"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 id="booking-time-section" className="text-sm font-semibold text-zinc-100">
                  {t('bookingForm.dateTime')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {locale === 'en' ? 'Set the day and start time' : 'Define o dia e a hora de início'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor="booking-date" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.date')}
                </label>
                <input
                  id="booking-date"
                  name="date"
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="color-scheme-dark min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08]"
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickDate(0)}
                    aria-pressed={selectedDate === today}
                    className={cn(
                      'min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                      selectedDate === today
                        ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200'
                        : 'border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06]',
                    )}
                  >
                    {locale === 'en' ? 'Today' : 'Hoje'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate(1)}
                    aria-pressed={selectedDate === localDateValue(new Date(Date.now() + 86400000))}
                    className={cn(
                      'min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                      selectedDate === localDateValue(new Date(Date.now() + 86400000))
                        ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200'
                        : 'border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06]',
                    )}
                  >
                    {locale === 'en' ? 'Tomorrow' : 'Amanhã'}
                  </button>
                </div>
              </div>
              <div className="grid min-w-0 content-start gap-1.5">
                <label htmlFor="booking-time" className="text-xs font-medium text-zinc-400">
                  {t('bookingForm.time')}
                </label>
                <input
                  id="booking-time"
                  name="time"
                  type="time"
                  required
                  step={300}
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                  className="color-scheme-dark min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08]"
                />
                <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {locale === 'en' ? 'Uses your device time picker' : 'Usa o seletor de horas do teu dispositivo'}
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-white/[0.08] bg-zinc-950/95 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0 text-xs leading-5 text-zinc-500" aria-live="polite">
            {selectedService ? (
              <span className="block truncate font-medium text-zinc-300">
                {selectedService.name} · {formatPrice(selectedService.price)}
              </span>
            ) : (
              <span className="block">{t('bookingForm.help')}</span>
            )}
            {selectedProfessional ? (
              <span className="block truncate">
                {selectedProfessional.name}
                {selectedDate && selectedTime ? ` · ${selectedDate} ${selectedTime}` : ''}
              </span>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={loading || services.length === 0 || professionals.length === 0}
            className="silentra-action-primary min-h-12 w-full shrink-0 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 shadow-[0_8px_24px_rgba(52,211,153,0.15)] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-48"
          >
            {loading ? (
              <Spinner className="mr-2" />
            ) : (
              <Check className="mr-2 size-4" aria-hidden="true" />
            )}
            {loading ? t('bookingForm.saving') : t('bookingForm.save')}
          </Button>
        </footer>
      </form>
    </div>
  );
}
