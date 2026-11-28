'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useBarbershop } from '@/context/BarbershopContext';
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
  Repeat,
  Search,
  Scissors,
  UserRound,
  X,
} from 'lucide-react';

type ManualBookingSlotStatus = 'available' | 'booked' | 'blocked' | 'break' | 'past';

type ManualBookingAvailabilitySlot = {
  time: string;
  endTime: string;
  status: ManualBookingSlotStatus;
  detail: string | null;
};

type ManualBookingAvailabilityDay = {
  date: string;
  available: boolean;
  closedDay: boolean;
  availableCount: number;
  bookedCount: number;
  blockedCount: number;
};

type ManualBookingAvailabilityResponse = {
  selectedDate: string;
  days: ManualBookingAvailabilityDay[];
  slots: ManualBookingAvailabilitySlot[];
  dayOff: boolean;
  workingIntervals: Array<{ start: string; end: string }>;
  breakIntervals: Array<{ start: string; end: string }>;
  serviceDuration: number;
  serviceBuffer: number;
};

type ManualBookingCalendarDay = {
  dateStr: string;
  weekdayShort: string;
  dayNumeric: number;
  fullDateFormatted: string;
  isToday: boolean;
};

function buildManualBookingDays(locale: 'pt' | 'en', count = 14): ManualBookingCalendarDay[] {
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateStr = localDateValue(date);
    const fullDate = date.toLocaleDateString(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return {
      dateStr,
      weekdayShort: date
        .toLocaleDateString(dateLocale, { weekday: 'short' })
        .replace('.', '')
        .toUpperCase(),
      dayNumeric: date.getDate(),
      fullDateFormatted: fullDate.charAt(0).toUpperCase() + fullDate.slice(1),
      isToday: index === 0,
    };
  });
}

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
  recurrence,
  setRecurrence,
  recurrenceEndDate,
  setRecurrenceEndDate,
  onSubmit,
}: BookingFormProps) {
  const { t, locale } = useLanguage();
  const { barbershopId } = useBarbershop();
  const calendarDays = useMemo(() => buildManualBookingDays(locale), [locale]);
  const today = localDateValue(new Date());
  const [availability, setAvailability] =
    useState<ManualBookingAvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityRetryKey, setAvailabilityRetryKey] = useState(0);
  const selectableServices = useMemo(
    () => services.filter((service) => service.is_active === true),
    [services],
  );
  const selectableProfessionals = useMemo(
    () => professionals.filter((professional) => professional.active === true),
    [professionals],
  );
  const selectedClient = clients.find(
    (client) => client.id === formData.clientId,
  );
  const selectedClientName = selectedClient?.name_complete ?? '';
  const selectedService = selectableServices.find(
    (service) => service.id === formData.service_id,
  );
  const singleProfessional =
    selectableProfessionals.length === 1 ? selectableProfessionals[0] : null;
  const singleProfessionalId = singleProfessional?.id;
  const selectedProfessional = selectableProfessionals.find(
    (professional) => professional.id === selectedProfessionalId,
  );
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
        dateStyle: 'medium',
      }).format(new Date(`${selectedDate}T00:00:00`))
    : '';

  useEffect(() => {
    setSelectedTime('');
  }, [formData.service_id, selectedProfessionalId, setSelectedTime]);

  useEffect(() => {
    if (
      !barbershopId ||
      !formData.service_id ||
      !selectedProfessionalId ||
      !selectedDate
    ) {
      setAvailability(null);
      setAvailabilityLoading(false);
      setAvailabilityError(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      fromDate: today,
      selectedDate,
      serviceId: formData.service_id,
      professionalId: selectedProfessionalId,
    });

    setAvailability(null);
    setAvailabilityError(false);
    setAvailabilityLoading(true);

    void fetch(
      `/api/barbershops/${barbershopId}/booking-availability?${query.toString()}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            responseData?.error ||
              (locale === 'en'
                ? 'Could not load the barber’s availability.'
                : 'Não foi possível carregar a disponibilidade do barbeiro.'),
          );
        }
        return responseData as ManualBookingAvailabilityResponse;
      })
      .then((responseData) => {
        if (controller.signal.aborted) return;
        setAvailability(responseData);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') {
          console.error('[MANUAL_BOOKING_AVAILABILITY_ERROR]', reason);
          setAvailability(null);
          setAvailabilityError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false);
      });

    return () => controller.abort();
  }, [
    barbershopId,
    formData.service_id,
    locale,
    selectedDate,
    selectedProfessionalId,
    today,
    availabilityRetryKey,
  ]);

  const selectedAvailabilityDay = availability?.days.find(
    (day) => day.date === selectedDate,
  );
  const selectedAvailabilitySlots = availability?.slots ?? [];
  const selectedSlotIsAvailable = selectedAvailabilitySlots.some(
    (slot) => slot.time === selectedTime && slot.status === 'available',
  );
  const availabilityIsReady =
    availability?.selectedDate === selectedDate && !availabilityLoading;

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!selectedSlotIsAvailable || availabilityLoading || availabilityError) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };

  const [clientQuery, setClientQuery] = useState('');
  const [showClientResults, setShowClientResults] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(-1);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showClientResults) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !clientSearchRef.current?.contains(event.target)
      ) {
        setShowClientResults(false);
        setActiveClientIndex(-1);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showClientResults]);

  useEffect(() => {
    if (selectedClientName) setClientQuery(selectedClientName);
  }, [selectedClientName]);

  useEffect(() => {
    if (
      singleProfessionalId &&
      selectedProfessionalId !== singleProfessionalId
    ) {
      setSelectedProfessionalId(singleProfessionalId);
    }
  }, [singleProfessionalId, selectedProfessionalId, setSelectedProfessionalId]);

  useEffect(() => {
    if (selectableServices.length === 1 && !formData.service_id) {
      setFormData((previous) => ({
        ...previous,
        service_id: selectableServices[0].id,
      }));
    }
  }, [formData.service_id, selectableServices, setFormData]);

  const matchingClients = useMemo(() => {
    const query = clientQuery
      .trim()
      .toLocaleLowerCase(locale === 'en' ? 'en-GB' : 'pt-PT');
    if (query.length < 2 || formData.clientId) return [];

    const digits = query.replace(/\D/g, '');
    return clients
      .filter((client) => {
        const name = client.name_complete.toLocaleLowerCase(
          locale === 'en' ? 'en-GB' : 'pt-PT',
        );
        const phone = (client.num_phone ?? '').toLocaleLowerCase();
        const phoneDigits = phone.replace(/\D/g, '');
        return (
          name.includes(query) ||
          phone.includes(query) ||
          (digits.length >= 3 && phoneDigits.includes(digits))
        );
      })
      .slice(0, 7);
  }, [clientQuery, clients, formData.clientId, locale]);

  const updateCustomer = (
    field: 'name_complete' | 'num_phone' | 'email' | 'birth_date',
    value: string,
  ) => {
    setFormData((previous) => ({
      ...previous,
      clientId:
        field === 'birth_date' || field === 'email'
          ? previous.clientId
          : undefined,
      [field]: value,
    }));
    if (field !== 'birth_date' && field !== 'email') setClientQuery('');
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
    setActiveClientIndex(-1);
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
    setActiveClientIndex(-1);
  };

  const formatPrice = (price: string) => {
    const amount = Number(price);
    return Number.isFinite(amount)
      ? `${amount.toFixed(2).replace('.', ',')} €`
      : price;
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-zinc-950/95 sm:h-auto">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.13),transparent_68%)]" />
      <header className="relative flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] bg-white/[0.012] px-4 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:pb-6 sm:pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.09] text-emerald-300 shadow-[0_8px_30px_rgba(16,185,129,0.08)]">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
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
            aria-label={
              locale === 'en'
                ? 'Close booking form'
                : 'Fechar formulário de marcação'
            }
            className="size-11 shrink-0 rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </DialogClose>
      </header>

      <form onSubmit={handleFormSubmit} className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-5 sm:px-6 sm:py-6">
          <section
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-3.5 shadow-inner shadow-black/10 sm:p-5"
            aria-labelledby="booking-client-section"
          >
            <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-3.5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3
                  id="booking-client-section"
                  className="text-sm font-semibold text-zinc-100"
                >
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

            <div ref={clientSearchRef} className="relative mb-3 grid gap-2">
              <label
                htmlFor="booking-client-search"
                className="text-xs font-medium text-zinc-400"
              >
                {t('bookingForm.existingCustomer')}{' '}
                <span className="font-normal text-zinc-600">
                  ({t('bookingForm.optional')})
                </span>
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="booking-client-search"
                  type="search"
                  autoComplete="off"
                  value={clientQuery}
                  onFocus={() => setShowClientResults(true)}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setActiveClientIndex(-1);
                    setFormData((previous) =>
                      previous.clientId
                        ? {
                            ...previous,
                            clientId: undefined,
                            name_complete: '',
                            num_phone: '',
                            email: '',
                            birth_date: '',
                          }
                        : previous,
                    );
                    setShowClientResults(true);
                  }}
                  onKeyDown={(event) => {
                    const hasResults = matchingClients.length > 0;
                    const listIsOpen = showClientResults && hasResults;

                    if (event.key === 'Escape' && showClientResults) {
                      event.preventDefault();
                      setShowClientResults(false);
                      setActiveClientIndex(-1);
                      return;
                    }

                    if (event.key === 'ArrowDown' && hasResults) {
                      event.preventDefault();
                      setShowClientResults(true);
                      setActiveClientIndex((current) =>
                        current >= matchingClients.length - 1 ? 0 : current + 1,
                      );
                      return;
                    }

                    if (event.key === 'ArrowUp' && hasResults) {
                      event.preventDefault();
                      setShowClientResults(true);
                      setActiveClientIndex((current) =>
                        current <= 0 ? matchingClients.length - 1 : current - 1,
                      );
                      return;
                    }

                    if (event.key === 'Home' && listIsOpen) {
                      event.preventDefault();
                      setActiveClientIndex(0);
                      return;
                    }

                    if (event.key === 'End' && listIsOpen) {
                      event.preventDefault();
                      setActiveClientIndex(matchingClients.length - 1);
                      return;
                    }

                    if (event.key === 'Enter' && showClientResults) {
                      event.preventDefault();
                      const selectedIndex =
                        activeClientIndex >= 0 ? activeClientIndex : 0;
                      const selectedClient = matchingClients[selectedIndex];
                      if (selectedClient) chooseClient(selectedClient.id);
                      else setShowClientResults(false);
                    }
                  }}
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (
                      !(nextTarget instanceof Node) ||
                      !clientSearchRef.current?.contains(nextTarget)
                    ) {
                      setShowClientResults(false);
                      setActiveClientIndex(-1);
                    }
                  }}
                  placeholder={t('bookingForm.searchCustomer')}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={
                    showClientResults && matchingClients.length > 0
                  }
                  aria-controls={
                    showClientResults && matchingClients.length > 0
                      ? 'booking-client-results'
                      : undefined
                  }
                  aria-activedescendant={
                    showClientResults && activeClientIndex >= 0
                      ? `booking-client-option-${activeClientIndex}`
                      : undefined
                  }
                  aria-describedby={
                    showClientResults && matchingClients.length > 0
                      ? 'booking-client-results-status'
                      : undefined
                  }
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-zinc-900/80 pl-10 pr-11 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
                {selectedClient ? (
                  <button
                    type="button"
                    onClick={clearSelectedClient}
                    aria-label={
                      locale === 'en'
                        ? 'Clear selected customer'
                        : 'Limpar cliente selecionado'
                    }
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {showClientResults && matchingClients.length > 0 ? (
                <>
                  <p
                    id="booking-client-results-status"
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {locale === 'en'
                      ? matchingClients.length === 1
                        ? '1 matching customer. Use the arrow keys to navigate.'
                        : `${matchingClients.length} matching customers. Use the arrow keys to navigate.`
                      : matchingClients.length === 1
                        ? '1 cliente encontrado. Usa as setas para navegar.'
                        : `${matchingClients.length} clientes encontrados. Usa as setas para navegar.`}
                  </p>
                  <div
                    id="booking-client-results"
                    role="listbox"
                    aria-label={
                      locale === 'en'
                        ? 'Matching customers'
                        : 'Clientes encontrados'
                    }
                    className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl shadow-black/50"
                  >
                    {matchingClients.map((client, index) => (
                      <button
                        key={client.id}
                        id={`booking-client-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeClientIndex === index}
                        tabIndex={-1}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveClientIndex(index)}
                        onClick={() => chooseClient(client.id)}
                        className={cn(
                          'flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                          activeClientIndex === index
                            ? 'bg-white/[0.09]'
                            : 'hover:bg-white/[0.06]',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-zinc-300">
                            {client.name_complete
                              .trim()
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-zinc-100">
                              {client.name_complete}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-zinc-500">
                              {client.num_phone}
                            </span>
                          </span>
                        </span>
                        <Plus
                          className="size-4 shrink-0 text-emerald-300"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {showClientResults &&
              clientQuery.trim().length >= 2 &&
              !selectedClient &&
              matchingClients.length === 0 ? (
                <p
                  role="status"
                  className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs text-zinc-500"
                >
                  {t('bookingForm.noCustomerFound')}{' '}
                  {locale === 'en'
                    ? 'You can continue with a new customer below.'
                    : 'Podes continuar com um novo cliente abaixo.'}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label
                  htmlFor="booking-name"
                  className="text-xs font-medium text-zinc-400"
                >
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
                  onFocus={() => setShowClientResults(false)}
                  onChange={(event) =>
                    updateCustomer('name_complete', event.target.value)
                  }
                  className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <label
                  htmlFor="booking-phone"
                  className="text-xs font-medium text-zinc-400"
                >
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
                  onFocus={() => setShowClientResults(false)}
                  onChange={(event) =>
                    updateCustomer('num_phone', event.target.value)
                  }
                  className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="mt-3 grid min-w-0 gap-1.5">
              <label
                htmlFor="booking-email"
                className="text-xs font-medium text-zinc-400"
              >
                {t('bookingForm.email')}
              </label>
              <input
                id="booking-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                value={formData.email}
                onFocus={() => setShowClientResults(false)}
                onChange={(event) => updateCustomer('email', event.target.value)}
                placeholder={t('bookingForm.emailPlaceholder')}
                aria-describedby="booking-email-help"
                className="min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] placeholder:text-zinc-600"
              />
              <p id="booking-email-help" className="text-xs leading-5 text-zinc-500">
                {t('bookingForm.emailHelp')}
              </p>
            </div>

            <details className="group mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-zinc-400 marker:hidden">
                <span>
                  {locale === 'en'
                    ? 'Customer details (optional)'
                    : 'Detalhes do cliente (opcional)'}
                </span>
                <span className="text-zinc-600 transition group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <div className="mt-3 grid gap-1.5">
                <label
                  htmlFor="booking-birth-date"
                  className="text-xs font-medium text-zinc-400"
                >
                  {t('bookingForm.birthDate')}{' '}
                  <span className="font-normal text-zinc-600">
                    ({t('bookingForm.optional')})
                  </span>
                </label>
                <input
                  id="booking-birth-date"
                  name="bday"
                  type="date"
                  max={today}
                  value={formData.birth_date ?? ''}
                  onChange={(event) =>
                    updateCustomer('birth_date', event.target.value)
                  }
                  className="color-scheme-dark min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-base text-white outline-none focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08]"
                />
              </div>
            </details>
          </section>

          <section
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-3.5 shadow-inner shadow-black/10 sm:p-5"
            aria-labelledby="booking-service-section"
          >
            <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-3.5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
                <Scissors className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3
                  id="booking-service-section"
                  className="text-sm font-semibold text-zinc-100"
                >
                  {t('bookingForm.serviceAndProfessional')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {locale === 'en'
                    ? 'Choose what is being booked and who will do it'
                    : 'Escolhe o serviço e quem o vai realizar'}
                </p>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label
                  htmlFor="booking-service"
                  className="text-xs font-medium text-zinc-400"
                >
                  {t('bookingForm.service')}
                </label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      service_id: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="booking-service"
                    className="box-border flex min-h-12 w-full min-w-0 max-w-full items-center rounded-xl border-white/10 bg-zinc-900 px-3.5 text-base text-white"
                  >
                    <SelectValue placeholder={t('bookingForm.chooseService')} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="w-[var(--radix-select-trigger-width)] max-h-72 min-w-0 max-w-[calc(100vw-2rem)] border-white/10 bg-zinc-900 text-white"
                  >
                    <SelectGroup>
                      {selectableServices.map((service) => (
                        <SelectItem
                          key={service.id}
                          value={service.id}
                          className="min-h-11 min-w-0 rounded-lg py-2.5"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {service.name}
                          </span>
                          <span className="shrink-0 text-xs text-zinc-400">
                            {formatPrice(service.price)} ·{' '}
                            {Number(service.duration)} min
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
                    <span className="font-medium text-zinc-300">
                      {formatPrice(selectedService.price)}
                    </span>
                  </p>
                ) : null}
              </div>

              {singleProfessional ? (
                <div className="grid min-w-0 gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">
                    {t('bookingForm.barber')}
                  </label>
                  <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] px-3.5">
                    <UserRound
                      className="size-4 shrink-0 text-emerald-300"
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {singleProfessional.name}
                    </span>
                    <Check
                      className="ml-auto size-4 shrink-0 text-emerald-300"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid min-w-0 gap-1.5">
                  <label
                    htmlFor="booking-barber"
                    className="text-xs font-medium text-zinc-400"
                  >
                    {t('bookingForm.barber')}
                  </label>
                  <Select
                    value={selectedProfessionalId}
                    onValueChange={setSelectedProfessionalId}
                  >
                    <SelectTrigger
                      id="booking-barber"
                      className="box-border flex min-h-12 w-full min-w-0 max-w-full items-center rounded-xl border-white/10 bg-zinc-900 px-3.5 text-base text-white"
                    >
                      <SelectValue
                        placeholder={t('bookingForm.chooseProfessional')}
                      />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="w-[var(--radix-select-trigger-width)] max-h-72 min-w-0 max-w-[calc(100vw-2rem)] border-white/10 bg-zinc-900 text-white"
                    >
                      <SelectGroup>
                        {selectableProfessionals.map((professional) => (
                          <SelectItem
                            key={professional.id}
                            value={professional.id}
                            className="min-h-11 rounded-lg py-2.5"
                          >
                            {professional.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {selectableServices.length === 0 || selectableProfessionals.length === 0 ? (
              <p
                role="status"
                className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5 text-xs leading-5 text-amber-200/80"
              >
                {locale === 'en'
                  ? 'Add at least one active service and one barber before creating a booking.'
                  : 'Adiciona pelo menos um serviço ativo e um barbeiro antes de criares uma marcação.'}
              </p>
            ) : null}
          </section>

          <section
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.015] p-3.5 shadow-inner shadow-black/10 sm:p-5"
            aria-labelledby="booking-time-section"
          >
            <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-3.5">
              <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3
                  id="booking-time-section"
                  className="text-sm font-semibold text-zinc-100"
                >
                  {t('bookingForm.dateTime')}
                </h3>
                <p className="text-xs text-zinc-500">
                  {locale === 'en'
                    ? 'Set the day and start time'
                    : 'Define o dia e a hora de início'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {!selectedService || !selectedProfessional ? (
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-3 text-xs leading-5 text-amber-100/80">
                  {locale === 'en'
                    ? 'Choose a service and a barber first to see the real schedule.'
                    : 'Escolhe primeiro o serviço e o barbeiro para veres a agenda real.'}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-300">
                        {locale === 'en' ? 'Choose a day' : 'Escolhe o dia'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        {locale === 'en'
                          ? 'Next 14 days · days off and full days are identified'
                          : 'Próximos 14 dias · folgas e dias sem vagas identificados'}
                      </p>
                    </div>
                    {availabilityLoading ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500">
                        <Spinner className="size-3" />
                        {locale === 'en' ? 'Checking' : 'A verificar'}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
                    aria-label={locale === 'en' ? 'Available days' : 'Dias disponíveis'}
                  >
                    {calendarDays.map((day) => {
                      const dayStatus = availability?.days.find(
                        (item) => item.date === day.dateStr,
                      );
                      const isSelected = selectedDate === day.dateStr;
                      const isDayOff = dayStatus?.closedDay === true;
                      const isFullyBooked = Boolean(
                        dayStatus && !dayStatus.available && !dayStatus.closedDay,
                      );
                      const isDisabled = isDayOff || availabilityLoading || !dayStatus;

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          disabled={isDisabled}
                          aria-pressed={isSelected}
                          aria-label={`${day.fullDateFormatted}${isDayOff ? locale === 'en' ? ', day off' : ', folga' : isFullyBooked ? locale === 'en' ? ', fully booked' : ', sem vagas' : ''}`}
                          onClick={() => {
                            if (isDisabled || isSelected) return;
                            setSelectedDate(day.dateStr);
                            setSelectedTime('');
                          }}
                          className={cn(
                            'min-w-[72px] shrink-0 snap-start rounded-2xl border px-2.5 py-3 text-center transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed',
                            isSelected
                              ? 'border-emerald-400/40 bg-emerald-400/[0.09] text-white'
                              : isDayOff || isFullyBooked
                                ? 'border-rose-400/25 bg-rose-400/[0.055] text-rose-200/80 opacity-80'
                                : 'border-white/10 bg-white/[0.025] text-zinc-200 hover:border-white/20',
                          )}
                        >
                          <span className="block text-[10px] font-semibold text-zinc-500">
                            {day.isToday
                              ? locale === 'en'
                                ? 'TODAY'
                                : 'HOJE'
                              : day.weekdayShort}
                          </span>
                          <span className="mt-1 block text-xl font-black">
                            {day.dayNumeric}
                          </span>
                          <span
                            className={cn(
                              'mt-1 block text-[10px] font-semibold',
                              isDayOff || isFullyBooked
                                ? 'text-rose-300'
                                : isSelected
                                  ? 'text-emerald-200'
                                  : 'text-zinc-500',
                            )}
                          >
                            {availabilityLoading || !dayStatus
                              ? locale === 'en'
                                ? 'Checking'
                                : 'A verificar'
                              : isDayOff
                                ? locale === 'en'
                                  ? 'Day off'
                                  : 'Folga'
                                : isFullyBooked
                                  ? locale === 'en'
                                    ? 'No slots'
                                    : 'Sem vagas'
                                  : locale === 'en'
                                    ? `${dayStatus.availableCount} free`
                                    : `${dayStatus.availableCount} livres`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {selectedService && selectedProfessional ? (
                <>
                  {availabilityError ? (
                    <div
                      role="alert"
                      className="flex flex-col gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-xs leading-5 text-rose-200/90">
                        {locale === 'en'
                          ? 'Availability could not be confirmed. Retry before choosing a time.'
                          : 'Não foi possível confirmar a disponibilidade. Volta a tentar antes de escolheres uma hora.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setAvailabilityRetryKey((current) => current + 1)}
                        className="min-h-9 shrink-0 rounded-lg border border-rose-300/20 px-3 text-xs font-semibold text-rose-100 hover:bg-rose-300/[0.08]"
                      >
                        {locale === 'en' ? 'Try again' : 'Tentar novamente'}
                      </button>
                    </div>
                  ) : null}

                  {availabilityLoading ? (
                    <div className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-black/15 text-xs text-zinc-500">
                      <Spinner className="size-4" />
                      {locale === 'en'
                        ? 'Checking bookings and working hours…'
                        : 'A confirmar marcações e horário de trabalho…'}
                    </div>
                  ) : availabilityIsReady && availability ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {selectedDateLabel}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {locale === 'en'
                              ? `${availability.serviceDuration} min service${availability.serviceBuffer ? ` + ${availability.serviceBuffer} min buffer` : ''}`
                              : `Serviço de ${availability.serviceDuration} min${availability.serviceBuffer ? ` + ${availability.serviceBuffer} min de intervalo` : ''}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-medium">
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-1 text-emerald-200">
                            {availability.days.find((day) => day.date === selectedDate)?.availableCount ?? 0} {locale === 'en' ? 'free' : 'livres'}
                          </span>
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1 text-amber-200">
                            {selectedAvailabilityDay?.bookedCount ?? 0} {locale === 'en' ? 'booked' : 'marcados'}
                          </span>
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-2 py-1 text-rose-200">
                            {selectedAvailabilityDay?.blockedCount ?? 0} {locale === 'en' ? 'blocked' : 'bloqueados'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
                        <p className="text-[11px] leading-5 text-zinc-400">
                          <span className="font-semibold text-zinc-300">
                            {locale === 'en' ? 'Working hours' : 'Horário de trabalho'}:
                          </span>{' '}
                          {availability.dayOff || availability.workingIntervals.length === 0
                            ? locale === 'en'
                              ? 'Day off'
                              : 'Dia de folga'
                            : availability.workingIntervals
                                .map((interval) => `${interval.start}–${interval.end}`)
                                .join(' · ')}
                        </p>
                        {availability.breakIntervals.length > 0 ? (
                          <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                            <span className="font-semibold text-zinc-400">
                              {locale === 'en' ? 'Breaks' : 'Pausas'}:
                            </span>{' '}
                            {availability.breakIntervals
                              .map((interval) => `${interval.start}–${interval.end}`)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>

                      {availability.dayOff ? (
                        <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.055] px-3 py-4 text-center">
                          <p className="text-sm font-semibold text-rose-200">
                            {locale === 'en' ? 'The barber is off on this day.' : 'O barbeiro está de folga neste dia.'}
                          </p>
                        </div>
                      ) : selectedAvailabilitySlots.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-zinc-300">
                              {locale === 'en' ? 'Start time' : 'Hora de início'}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {locale === 'en'
                                ? 'Unavailable times show the reason'
                                : 'Os horários ocupados mostram o motivo'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {selectedAvailabilitySlots.map((slot) => {
                              const isAvailable = slot.status === 'available';
                              const isSelected = selectedTime === slot.time && isAvailable;
                              const statusLabel =
                                slot.status === 'booked'
                                  ? locale === 'en' ? 'Booked' : 'Marcado'
                                  : slot.status === 'blocked'
                                    ? locale === 'en' ? 'Blocked' : 'Bloqueado'
                                    : slot.status === 'break'
                                      ? locale === 'en' ? 'Break' : 'Pausa'
                                      : slot.status === 'past'
                                        ? locale === 'en' ? 'Passed' : 'Já passou'
                                        : locale === 'en' ? 'Available' : 'Livre';
                              return (
                                <button
                                  key={slot.time}
                                  type="button"
                                  disabled={!isAvailable}
                                  aria-pressed={isSelected}
                                  onClick={() => setSelectedTime(slot.time)}
                                  className={cn(
                                    'min-w-0 rounded-xl border px-2.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed',
                                    isSelected
                                      ? 'border-emerald-400/45 bg-emerald-400/[0.11] text-emerald-100'
                                      : isAvailable
                                        ? 'border-white/10 bg-white/[0.025] text-zinc-100 hover:border-emerald-400/30 hover:bg-emerald-400/[0.04]'
                                        : slot.status === 'booked'
                                          ? 'border-amber-400/20 bg-amber-400/[0.045] text-amber-100/80'
                                          : slot.status === 'blocked'
                                            ? 'border-rose-400/20 bg-rose-400/[0.045] text-rose-100/80'
                                            : 'border-white/[0.07] bg-white/[0.015] text-zinc-500 opacity-80',
                                  )}
                                >
                                  <span className="flex items-center justify-between gap-1">
                                    <span className="text-sm font-semibold tabular-nums">
                                      {slot.time}
                                    </span>
                                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">
                                      {statusLabel}
                                    </span>
                                  </span>
                                  {slot.detail ? (
                                    <span className="mt-1 block line-clamp-2 text-[10px] leading-4 opacity-75">
                                      {slot.detail}
                                    </span>
                                  ) : slot.status === 'available' ? (
                                    <span className="mt-1 block text-[10px] text-emerald-200/60">
                                      {locale === 'en' ? `Until ${slot.endTime}` : `Até às ${slot.endTime}`}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-4 text-center text-xs text-zinc-500">
                          {locale === 'en'
                            ? 'No selectable times fit this service on this day.'
                            : 'Não existem horários compatíveis com este serviço neste dia.'}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-full bg-emerald-400" />
                          {locale === 'en' ? 'Available' : 'Livre'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-full bg-amber-400" />
                          {locale === 'en' ? 'Booked' : 'Marcado'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-full bg-rose-400" />
                          {locale === 'en' ? 'Blocked' : 'Bloqueado'}
                        </span>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <label
                  htmlFor="booking-recurrence"
                  className="text-xs font-medium text-zinc-400"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat
                      className="size-3.5 text-emerald-300"
                      aria-hidden="true"
                    />
                    {t('bookingForm.recurrence')}
                  </span>
                </label>
                <Select
                  value={recurrence}
                  onValueChange={(value) =>
                    setRecurrence(value as typeof recurrence)
                  }
                >
                  <SelectTrigger
                    id="booking-recurrence"
                    className="min-h-12 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-zinc-900 px-3 text-sm text-white sm:text-base"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 min-w-0 max-w-[calc(100vw-2rem)] border-white/10 bg-zinc-900 text-white">
                    <SelectGroup>
                      <SelectItem value="none">
                        {t('bookingForm.noRecurrence')}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {t('bookingForm.everyWeek')}
                      </SelectItem>
                      <SelectItem value="biweekly">
                        {t('bookingForm.everyTwoWeeks')}
                      </SelectItem>
                      <SelectItem value="everyThreeWeeks">
                        {t('bookingForm.everyThreeWeeks')}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {t('bookingForm.everyMonth')}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {recurrence !== 'none' ? (
                <div className="grid min-w-0 gap-1.5">
                  <label
                    htmlFor="booking-recurrence-end"
                    className="text-xs font-medium text-zinc-400"
                  >
                    {t('bookingForm.repeatUntil')}
                  </label>
                  <input
                    id="booking-recurrence-end"
                    name="recurrenceEndDate"
                    type="date"
                    required
                    min={selectedDate}
                    value={recurrenceEndDate}
                    onChange={(event) =>
                      setRecurrenceEndDate(event.target.value)
                    }
                    className="color-scheme-dark box-border block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-zinc-900 px-2.5 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-4 focus:ring-emerald-400/[0.08] sm:px-3.5 sm:text-base"
                  />
                  <p className="text-[11px] leading-4 text-zinc-600">
                    {t('bookingForm.recurrenceHint')}
                  </p>
                </div>
              ) : (
                <p className="flex min-w-0 items-center text-xs leading-5 text-zinc-600">
                  {t('bookingForm.recurrenceOffHint')}
                </p>
              )}
            </div>
          </section>
        </div>

        <footer className="relative z-[1] flex shrink-0 flex-col gap-3 border-t border-white/[0.08] bg-zinc-950/95 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div
            className="min-w-0 text-xs leading-5 text-zinc-500"
            aria-live="polite"
          >
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
                {selectedDate && selectedTime
                  ? ` · ${selectedDateLabel} ${selectedTime}`
                  : ''}
              </span>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={
              loading ||
              selectableServices.length === 0 ||
              selectableProfessionals.length === 0 ||
              !selectedSlotIsAvailable ||
              availabilityLoading ||
              availabilityError
            }
            className="silentra-action-primary min-h-12 w-full shrink-0 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-zinc-950 shadow-[0_10px_28px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400 hover:shadow-[0_12px_32px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-48"
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
