'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Phone,
  Scissors,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  BookingDayOption,
  BookingDrawerProps,
  MarketplaceBookingResponse,
  MarketplaceProfessional,
} from '@/types/marketplace/booking';
import type { MarketplaceService } from '@/types/marketplace/shops';

type Step = 1 | 2 | 3 | 4;
type CustomerState = 'idle' | 'checking' | 'matched' | 'new' | 'error';

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  terça: 2,
  terca: 2,
  'terça-feira': 2,
  'terca-feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sábado: 6,
  sabado: 6,
  'sábado-feira': 6,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildDays(locale: 'pt' | 'en', count = 14): BookingDayOption[] {
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'en-GB';
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dateStr = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map((part, partIndex) =>
        partIndex === 0 ? String(part) : String(part).padStart(2, '0'),
      )
      .join('-');
    const full = date.toLocaleDateString(dateLocale, {
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
      fullDateFormatted: full.charAt(0).toUpperCase() + full.slice(1),
      isToday: index === 0,
    };
  });
}

function parseClosedDays(value: MarketplaceShopValue) {
  const values =
    typeof value === 'string'
      ? value.split(',')
      : Array.isArray(value)
        ? value
        : [];
  return new Set(
    values.flatMap((entry) => {
      if (typeof entry === 'number' && entry >= 0 && entry <= 6) return [entry];
      const key = String(entry).trim().toLowerCase();
      if (/^[0-6]$/.test(key)) return [Number(key)];
      return DAY_INDEX[key] === undefined ? [] : [DAY_INDEX[key]];
    }),
  );
}

type MarketplaceShopValue =
  MarketplaceDrawerShopValue | string | number[] | null | undefined;
type MarketplaceDrawerShopValue = string;

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthDateToIso(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4));
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    year < 1900 ||
    date > new Date()
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function BookingDrawerCanonical({
  shop,
  isOpen,
  onClose,
  onSuccess,
  selectedServiceId = null,
  appearance = 'default',
}: BookingDrawerProps) {
  const { t, locale } = useLanguage();
  const days = useMemo(() => buildDays(locale), [locale]);
  const [step, setStep] = useState<Step>(1);
  const [dayIndex, setDayIndex] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(selectedServiceId);
  const [professional, setProfessional] =
    useState<MarketplaceProfessional | null>(null);
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [professionals, setProfessionals] = useState<MarketplaceProfessional[]>(
    [],
  );
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [customerState, setCustomerState] = useState<CustomerState>('idle');
  const controllerRef = useRef<AbortController | null>(null);
  const customerControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(
    new Map<string, { data: MarketplaceBookingResponse; timestamp: number }>(),
  );
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Each step starts at the top so mobile users never land below the heading.
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [isOpen, step]);

  const service = services.find((item) => item.id === serviceId) ?? null;
  const closedDays = useMemo(
    () =>
      parseClosedDays(shop?.closed_days ?? shop?.closedDays ?? shop?.off_days),
    [shop],
  );
  const availableDays = useMemo(
    () => days.filter((day) => !closedDays.has(new Date(`${day.dateStr}T12:00:00`).getDay())),
    [days, closedDays],
  );
  const currentDay = availableDays[dayIndex] ?? availableDays[0] ?? null;
  const currentDayClosed = !currentDay;

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDayIndex(0);
    setServiceId(selectedServiceId);
    setProfessional(null);
    setServices([]);
    setProfessionals([]);
    setSlots([]);
    setSelectedSlot(null);
    setLoadingAvailability(false);
    setSubmitting(false);
    setError('');
    setRetryKey(0);
    setName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setCustomerState('idle');
    controllerRef.current?.abort();
    customerControllerRef.current?.abort();
    cacheRef.current.clear();
  }, [isOpen, selectedServiceId]);

  useEffect(() => {
    if (!isOpen || !shop || !currentDay) return;
    const controller = new AbortController();
    void fetch(
      `/api/shops/${shop.id}/booking-data?date=${encodeURIComponent(currentDay.dateStr)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload?.error || t('bookingDrawer.loadBarbersError'),
          );
        return payload as MarketplaceBookingResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setProfessionals(payload.professionals ?? []);
        setServices(payload.services ?? []);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError')
          setError(
            reason instanceof Error
              ? reason.message
              : t('bookingDrawer.loadBarbersError'),
          );
      });
    return () => controller.abort();
  }, [currentDay?.dateStr, isOpen, retryKey, shop]);

  useEffect(() => {
    if (!isOpen || step !== 2 || !shop || !currentDay || !professional || !service) {
      setSlots([]);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const key = `${shop.id}|${professional.id}|${service.id}|${currentDay.dateStr}`;
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < 8000) {
      setSlots(cached.data.availableSlots ?? []);
      setLoadingAvailability(false);
      return () => controller.abort();
    }
    setLoadingAvailability(true);
    setError('');
    void fetch(
      `/api/shops/${shop.id}/booking-data?date=${encodeURIComponent(currentDay.dateStr)}&professionalId=${encodeURIComponent(professional.id)}&serviceId=${encodeURIComponent(service.id)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            payload?.error || t('bookingDrawer.loadTimesError'),
          );
        return payload as MarketplaceBookingResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(key, { data: payload, timestamp: Date.now() });
        setSlots(payload.availableSlots ?? []);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError')
          setError(
            reason instanceof Error
              ? reason.message
              : t('bookingDrawer.loadTimesError'),
          );
      })
      .finally(
        () => !controller.signal.aborted && setLoadingAvailability(false),
      );
    return () => controller.abort();
  }, [currentDay?.dateStr, isOpen, professional, retryKey, service, shop, step]);

  useEffect(() => {
    if (!isOpen || step !== 3 || !shop) return;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedPhone.length < 7) {
      customerControllerRef.current?.abort();
      setCustomerState('idle');
      return;
    }
    const timeout = window.setTimeout(() => {
      customerControllerRef.current?.abort();
      const controller = new AbortController();
      customerControllerRef.current = controller;
      setCustomerState('checking');
      void fetch('/api/bookings/customer-profile', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          email: normalizedEmail,
          phone: phone.trim(),
        }),
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.success)
            throw new Error(
              payload?.error || t('bookingDrawer.verifyCustomerError'),
            );
          return payload as { matched?: boolean; hasBirthDate?: boolean };
        })
        .then((payload) => {
          if (controller.signal.aborted) return;
          setCustomerState(
            payload.matched ? 'matched' : 'new',
          );
        })
        .catch((reason) => {
          if (reason?.name !== 'AbortError') setCustomerState('error');
        });
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      customerControllerRef.current?.abort();
    };
  }, [email, isOpen, phone, shop, step]);

  const canContinueOne = Boolean(currentDay && professional && service && !currentDayClosed);
  const canContinueTwo = Boolean(selectedSlot);

  function continueOne() {
    if (!professional) return toast.error(t('bookingDrawer.chooseBarber'));
    if (currentDayClosed)
      return toast.error(t('bookingDrawer.chooseOpenDay'));
    if (!service) return toast.error(t('bookingDrawer.chooseService'));
    setStep(2);
  }

  function continueTwo() {
    if (!selectedSlot) return toast.error(t('bookingDrawer.chooseAvailableTime'));
    setStep(3);
  }

  async function submit() {
    if (!shop || !professional || !service || !selectedSlot) return;
    if (!name.trim() || !phone.trim() || !email.trim())
      return toast.error(t('bookingDrawer.requiredFields'));
    const birthDateIso = birthDateToIso(birthDate);
    if (!birthDateIso)
      return toast.error(
        t('bookingDrawer.validBirthDate'),
      );
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          service: service.id,
          date: currentDay.dateStr,
          slot: selectedSlot,
          professionalId: professional.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          customerBirthDate: birthDateIso,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success)
        throw new Error(
          payload?.error || t('bookingDrawer.bookingError'),
        );
      cacheRef.current.clear();
      setStep(4);
      toast.success(t('bookingDrawer.bookingSuccess'));
      onSuccess?.({
        shopName: shop.name,
        serviceName: service.name,
        date: currentDay.dateStr,
        time: selectedSlot,
        customerEmail: email.trim(),
      });
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : t('bookingDrawer.bookingError');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!shop) return null;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        data-booking-theme={appearance}
        className={`mx-auto flex h-[min(90dvh,48rem)] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:h-auto sm:max-h-[92dvh] sm:rounded-t-3xl ${appearance === 'agenda' ? 'border-[#e8e7e2] bg-white text-[#171717]' : 'border-white/10 bg-zinc-950 text-zinc-100'}`}
      >
        {appearance === 'agenda' && (
          <style>{`
            [data-booking-theme="agenda"] { background: #fff !important; color: #171717 !important; border-color: #e8e7e2 !important; box-shadow: 0 -18px 60px rgba(0,0,0,.10) !important; }
            [data-booking-theme="agenda"] .text-zinc-100 { color: #171717 !important; }
            [data-booking-theme="agenda"] .text-zinc-200 { color: #292929 !important; }
            [data-booking-theme="agenda"] .text-zinc-400,
            [data-booking-theme="agenda"] .text-zinc-500 { color: #777770 !important; }
            [data-booking-theme="agenda"] .text-zinc-600 { color: #92928a !important; }
            [data-booking-theme="agenda"] .text-emerald-300,
            [data-booking-theme="agenda"] .text-emerald-100 { color: #33332f !important; }
            [data-booking-theme="agenda"] [class~="bg-zinc-950"] { background-color: #fff !important; }
            [data-booking-theme="agenda"] [class~="bg-white/[0.025]"],
            [data-booking-theme="agenda"] [class~="bg-white/[0.02]"],
            [data-booking-theme="agenda"] [class~="bg-white/[0.03]"] { background-color: #f8f8f6 !important; }
            [data-booking-theme="agenda"] [class~="border-white/10"],
            [data-booking-theme="agenda"] [class~="border-white/20"] { border-color: #e8e7e2 !important; }
            [data-booking-theme="agenda"] [class~="border-emerald-400/40"] { border-color: #b8b8b0 !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-400/[0.08]"] { background-color: #f1f1ed !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-300"] { background-color: #171717 !important; color: #fff !important; }
            [data-booking-theme="agenda"] [class~="text-zinc-950"] { color: #fff !important; }
            [data-booking-theme="agenda"] [class~="focus-visible:ring-emerald-400"]:focus-visible { --tw-ring-color: #777 !important; }
            [data-booking-theme="agenda"] [class~="border-amber-400/20"] { border-color: #eadcc7 !important; }
            [data-booking-theme="agenda"] [class~="bg-amber-400/[0.05]"] { background-color: #faf7f1 !important; }
            [data-booking-theme="agenda"] .text-amber-100 { color: #76572d !important; }
          `}</style>
        )}
        <header className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                {t('bookingDrawer.bookingTitle')}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold">
                {step === 4 ? t('bookingDrawer.bookingConfirmed') : shop.name}
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {step === 1
                  ? t('bookingDrawer.chooseBarberDayService')
                  : step === 2
                    ? t('bookingDrawer.nextChooseTime')
                    : step === 3
                      ? t('bookingDrawer.confirmYourDetails')
                      : t('bookingDrawer.slotReserved')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('bookingDrawer.closeBooking')}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {step < 4 && (
            <div
              className="mt-4 grid grid-cols-3 gap-1.5"
              aria-label={`Passo ${step} de 3`}
            >
              {[1, 2, 3].map((item) => (
                <span
                  key={item}
                  className={`h-1 rounded-full ${step >= item ? 'bg-emerald-300' : 'bg-white/10'}`}
                />
              ))}
            </div>
          )}
        </header>

        <div ref={scrollAreaRef} data-booking-scroll-area className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 [-webkit-overflow-scrolling:touch] sm:px-5 sm:pb-5">
          {error ? (
            <div
              className="flex min-h-56 flex-col items-center justify-center gap-4 text-center"
              role="alert"
            >
              <div className="flex size-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                <XCircle className="size-7" aria-hidden="true" />
              </div>
              <p className="max-w-sm text-sm text-zinc-400">{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError('');
                  if (step < 3) setRetryKey((value) => value + 1);
                }}
              >
                {step < 3 ? t('bookingDrawer.retry') : t('bookingDrawer.backToDetails')}
              </Button>
            </div>
          ) : step === 1 ? (
            <section className="space-y-6" aria-labelledby="booking-step-one">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound
                    className="size-4 text-emerald-300"
                    aria-hidden="true"
                  />
                  <h3 id="booking-step-one" className="text-sm font-semibold">
                    {t('bookingDrawer.stepOneBarber')}
                  </h3>
                </div>
                <div className="grid gap-2">
                  {professionals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={professional?.id === item.id}
                      onClick={() => setProfessional(item)}
                      className={`flex min-h-16 items-center justify-between rounded-2xl border p-4 text-left transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${professional?.id === item.id ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {item.role || t('bookingDrawer.professionalDefault')}
                        </span>
                      </span>
                      {professional?.id === item.id && (
                        <Check
                          className="size-5 text-emerald-300"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ))}
                </div>
                {!professionals.length && (
                  <p className="rounded-2xl border border-white/10 p-4 text-sm text-zinc-500">
                    {t('bookingDrawer.noBarbers')}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays
                    className="size-4 text-emerald-300"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">{t('bookingDrawer.stepTwoDay')}</h3>
                </div>
                {availableDays.length ? (
                  <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {availableDays.map((day, index) => (
                      <button
                        key={day.dateStr}
                        type="button"
                        aria-pressed={dayIndex === index}
                        onClick={() => {
                          setDayIndex(index);
                          setSelectedSlot(null);
                        }}
                        className={`min-w-[70px] shrink-0 snap-start rounded-2xl border px-2.5 py-3 text-center transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${dayIndex === index ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                      >
                        <span className="block text-[10px] font-semibold text-zinc-500">
                          {day.isToday ? t('bookingDrawer.today').toLocaleUpperCase(locale === 'pt' ? 'pt-PT' : 'en-GB') : day.weekdayShort}
                        </span>
                        <span className="mt-1 block text-xl font-black">
                          {day.dayNumeric}
                        </span>
                        <span className="mt-1 block text-[10px] text-zinc-500">
                          {day.fullDateFormatted.split(' ')[2] ?? ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-500">
                    {t('bookingDrawer.noOpenDays')}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Scissors
                    className="size-4 text-zinc-400"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">{t('bookingDrawer.stepThreeService')}</h3>
                </div>
                <select
                  value={serviceId ?? ''}
                  onChange={(event) => setServiceId(event.target.value || null)}
                  aria-label={t('bookingDrawer.chooseServiceAria')}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <option value="">{t('bookingDrawer.selectService')}</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.durationMinutes} min · €
                      {Number(item.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                disabled={!canContinueOne}
                onClick={continueOne}
                className="w-full"
              >
                {t('bookingDrawer.continue')}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </section>
          ) : step === 2 ? (
            <section aria-labelledby="booking-step-two">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3
                      className="size-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    <h3 id="booking-step-two" className="text-sm font-semibold">
                      {t('bookingDrawer.chooseTimeStep')}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {professional?.name} · {currentDay.fullDateFormatted}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
                  {t('bookingDrawer.back')}
                </Button>
              </div>
              {loadingAvailability ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t('bookingDrawer.loadingTimes')}
                </div>
              ) : slots.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={selectedSlot === slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`min-h-12 rounded-xl border text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedSlot === slot ? 'border-emerald-300 bg-emerald-300 text-zinc-950' : 'border-white/10 bg-white/[0.025] text-zinc-200 hover:border-white/20 hover:bg-white/[0.05]'}`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
                  <p className="text-sm font-medium">
                    {t('bookingDrawer.noSlots')}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t('bookingDrawer.tryOtherDayBarber')}
                  </p>
                </div>
              )}
              <Button
                type="button"
                disabled={!canContinueTwo}
                onClick={continueTwo}
                className="mt-6 w-full"
              >
                Continuar
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </section>
          ) : step === 3 ? (
            <section aria-labelledby="booking-step-three">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 id="booking-step-three" className="text-sm font-semibold">
                    {t('bookingDrawer.stepThreeDetails')}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {service?.name} · {currentDay.fullDateFormatted} ·{' '}
                    {selectedSlot}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
                  Voltar
                </Button>
              </div>
              <div className="space-y-4">
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  <span>{t('bookingDrawer.name')} *</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    placeholder={t('bookingDrawer.yourName')}
                  />
                </label>
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  <span>{t('bookingDrawer.phone')} *</span>
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                      aria-hidden="true"
                    />
                    <Input
                      className="pl-10"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="912 345 678"
                    />
                  </div>
                </label>
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  <span>{t('bookingDrawer.email')} *</span>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600"
                      aria-hidden="true"
                    />
                    <Input
                      className="pl-10"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="nome@email.com"
                    />
                  </div>
                </label>
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  <span>{t('bookingDrawer.birthDate')} *</span>
                  <Input
                    value={birthDate}
                    onChange={(event) =>
                      setBirthDate(formatBirthDate(event.target.value))
                    }
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="DD/MM/AAAA"
                    autoComplete="bday"
                  />
                </label>

                <div
                  className="min-h-12 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                  aria-live="polite"
                >
                  {customerState === 'checking' && (
                    <p className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      {t('bookingDrawer.checkingDetails')}
                    </p>
                  )}
                  {customerState === 'matched' && (
                    <p className="flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      {t('bookingDrawer.profileFound')}
                    </p>
                  )}
                  {customerState === 'new' && (
                    <p className="text-xs text-zinc-500">
                      {t('bookingDrawer.profileNew')}
                    </p>
                  )}
                  {customerState === 'error' && (
                    <p className="text-xs text-amber-300">
                      {t('bookingDrawer.profileError')}
                    </p>
                  )}
                  {customerState === 'idle' && (
                    <p className="text-xs text-zinc-600">
                      {t('bookingDrawer.profileIdle')}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit()}
                  className="w-full"
                >
                  {submitting ? (
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {submitting ? t('bookingDrawer.reserving') : t('bookingDrawer.confirmBooking')}
                </Button>
              </div>
            </section>
          ) : (
            <section
              className="flex min-h-80 flex-col items-center justify-center text-center"
              aria-labelledby="booking-success-title"
            >
              <div className="flex size-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
                <CheckCircle2
                  className="size-8 text-emerald-300"
                  aria-hidden="true"
                />
              </div>
              <h3
                id="booking-success-title"
                className="mt-5 text-xl font-semibold"
              >
                {t('bookingDrawer.bookingConfirmed')}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                {service?.name} {t('bookingDrawer.with')} {professional?.name},{' '}
                {currentDay.fullDateFormatted}, {t('bookingDrawer.at')} {selectedSlot}.
              </p>
              <Button type="button" className="mt-6 w-full" onClick={onClose}>
                {t('bookingDrawer.finish')}
              </Button>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
