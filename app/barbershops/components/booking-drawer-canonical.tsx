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
  MessageCircle,
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
import {
  trackBookingCompleted,
  trackWaitlistJoined,
} from '@/lib/observability/booking-events';
import { getDailySchedule } from '@/lib/scheduling/weekly-schedule';
import type {
  BookingDayOption,
  BookingDrawerProps,
  MarketplaceBookingResponse,
  MarketplaceProfessional,
} from '@/types/marketplace/booking';
import type { MarketplaceService } from '@/types/marketplace/shops';

type Step = 1 | 2 | 3 | 4;
type CustomerState = 'idle' | 'checking' | 'suggestion' | 'matched' | 'new' | 'error';
type CustomerLookupField = 'email' | 'phone';
type CustomerSuggestion = {
  lookupToken: string;
  matchedBy: CustomerLookupField;
  customerName: string | null;
};
type ManualPrepaymentInstructions = {
  bookingId: string;
  amount: number;
  mbwayPhone: string;
  whatsappPhone: string;
  expiresAt: string;
};
type BookingReceipt = {
  id: string | null;
  status: 'pending' | 'scheduled';
};
function normalizeWhatsAppNumber(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9) digits = `351${digits}`;
  return digits;
}

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

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthDateToDisplay(value: string) {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
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
  selectedDate = null,
  selectedTime = null,
  selectedProfessionalId = null,
  appearance = 'default',
  requireBirthDate = true,
  cancellationWindowHours = 24,
  minimumBookingNoticeMinutes = 0,
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
  const [shopPlan, setShopPlan] = useState<
    'free' | 'pro' | 'enterprise' | null
  >(shop?.plan ?? null);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingBookingData, setLoadingBookingData] = useState(false);
  const [selectedDayClosed, setSelectedDayClosed] = useState(false);
  const [dayAvailability, setDayAvailability] = useState<
    Record<string, { available: boolean; closedDay: boolean }>
  >({});
  const [loadingDayAvailability, setLoadingDayAvailability] = useState(false);
  const [dayAvailabilityReady, setDayAvailabilityReady] = useState(false);
  const [dayAvailabilityError, setDayAvailabilityError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [customerState, setCustomerState] = useState<CustomerState>('idle');
  const [customerLookupField, setCustomerLookupField] = useState<CustomerLookupField | null>(null);
  const [customerSuggestion, setCustomerSuggestion] = useState<CustomerSuggestion | null>(null);
  const [manualPrepayment, setManualPrepayment] = useState<
    MarketplaceBookingResponse['manualPrepayment'] | null
  >(null);
  const [prepaymentSelected, setPrepaymentSelected] = useState(false);
  const [waitlistOnly, setWaitlistOnly] = useState(false);
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [paymentInstructions, setPaymentInstructions] =
    useState<ManualPrepaymentInstructions | null>(null);
  const [bookingReceipt, setBookingReceipt] =
    useState<BookingReceipt | null>(null);
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
  const safeCancellationWindowHours = Math.max(
    0,
    Math.min(720, Math.round(Number(cancellationWindowHours) || 0)),
  );
  const safeMinimumBookingNoticeMinutes = Math.max(
    0,
    Math.min(43200, Math.round(Number(minimumBookingNoticeMinutes) || 0)),
  );
  const minimumNoticeLabel = (() => {
    const hours = Math.floor(safeMinimumBookingNoticeMinutes / 60);
    const minutes = safeMinimumBookingNoticeMinutes % 60;
    if (hours && minutes) return locale === 'en' ? `${hours} h ${minutes} min` : `${hours} h ${minutes} min`;
    if (hours) return `${hours} h`;
    return `${minutes} min`;
  })();
  // Day-off state is derived from the selected barber's effective weekly
  // schedule. Before a barber is selected, a date is closed only if every
  // available barber is off that weekday.
  const isDayOffForBookingDay = (day: BookingDayOption) => {
    const weekday = new Date(`${day.dateStr}T12:00:00`).getDay();
    const scheduleOwners = professional ? [professional] : professionals;
    return (
      scheduleOwners.length > 0 &&
      scheduleOwners.every(
        (item) =>
          item.weekly_schedule
            ? getDailySchedule(item.weekly_schedule, weekday).day_off
            : false,
      )
    );
  };
  const availableDays = days;
  const firstOpenDayIndex = 0;
  const currentDay = availableDays[dayIndex] ?? null;
  const currentDayClosed = currentDay
    ? isDayOffForBookingDay(currentDay) ||
      dayAvailability[currentDay.dateStr]?.closedDay === true
    : false;
  const getDayStatus = (day: BookingDayOption) => {
    const availability = dayAvailability[day.dateStr];
    const dayOff =
      isDayOffForBookingDay(day) || availability?.closedDay === true;
    const noSlots = availability?.available === false && !dayOff;
    const needsService = !serviceId;
    const checking = Boolean(serviceId && loadingDayAvailability);
    const unverified = Boolean(
      serviceId &&
        !dayAvailabilityReady &&
        !loadingDayAvailability &&
        !dayAvailabilityError,
    );
    const verificationFailed = Boolean(serviceId && dayAvailabilityError);
    return {
      dayOff,
      noSlots,
      needsService,
      checking,
      unverified,
      verificationFailed,
      unavailable: dayOff || noSlots,
      disabled:
        dayOff ||
        noSlots ||
        needsService ||
        checking ||
        unverified ||
        verificationFailed,
    };
  };
  const currentDayStatus = currentDay ? getDayStatus(currentDay) : null;
  const currentDayUnavailable = currentDayStatus?.disabled ?? true;

  useEffect(() => {
    if (!isOpen || professionals.length === 0) return;
    const selectedDay = days[dayIndex];
    if (!selectedDay || !isDayOffForBookingDay(selectedDay)) return;

    const nextOpenIndex = days.findIndex(
      (day, index) =>
        index >= dayIndex && !isDayOffForBookingDay(day),
    );
    const firstOpenIndex = days.findIndex(
      (day) => !isDayOffForBookingDay(day),
    );
    const targetIndex =
      nextOpenIndex >= 0 ? nextOpenIndex : firstOpenIndex;
    if (targetIndex >= 0) {
      setDayIndex(targetIndex);
      setSelectedSlot(null);
    }
  }, [dayIndex, days, isOpen, professional, professionals]);

  useEffect(() => {
    if (
      !isOpen ||
      step !== 1 ||
      loadingDayAvailability ||
      !currentDay ||
      !Object.keys(dayAvailability).length
    )
      return;
    if (dayAvailability[currentDay.dateStr]?.available !== false) return;

    const nextAvailableIndex = days.findIndex(
      (day) =>
        dayAvailability[day.dateStr]?.available === true &&
        !isDayOffForBookingDay(day),
    );
    if (nextAvailableIndex >= 0 && nextAvailableIndex !== dayIndex) {
      setDayIndex(nextAvailableIndex);
      setSelectedSlot(null);
    }
  }, [
    currentDay?.dateStr,
    dayAvailability,
    dayIndex,
    days,
    isOpen,
    loadingDayAvailability,
    step,
    professional,
    professionals,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const requestedDayIndex = selectedDate
      ? availableDays.findIndex((day) => day.dateStr === selectedDate)
      : -1;
    const hasCompleteOffer = Boolean(
      selectedServiceId && selectedDate && selectedTime,
    );
    setStep(hasCompleteOffer && selectedProfessionalId ? 2 : 1);
    setDayIndex(
      requestedDayIndex >= 0
        ? requestedDayIndex
        : firstOpenDayIndex >= 0
          ? firstOpenDayIndex
          : 0,
    );
    setServiceId(selectedServiceId);
    setProfessional(null);
    setServices([]);
    setProfessionals([]);
    setShopPlan(shop?.plan ?? null);
    setSlots([]);
    setSelectedSlot(null);
    setSelectedDayClosed(false);
    setLoadingAvailability(false);
    setLoadingBookingData(false);
    setSubmitting(false);
    setError('');
    setRetryKey(0);
    setName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setCustomerState('idle');
    setCustomerLookupField(null);
    setCustomerSuggestion(null);
    setManualPrepayment(null);
    setPrepaymentSelected(false);
    setPaymentInstructions(null);
    setBookingReceipt(null);
    setWaitlistOnly(false);
    setWaitlistConsent(false);
    controllerRef.current?.abort();
    customerControllerRef.current?.abort();
    cacheRef.current.clear();
  }, [
    availableDays,
    firstOpenDayIndex,
    isOpen,
    shop?.id,
    shop?.plan,
    selectedDate,
    selectedProfessionalId,
    selectedServiceId,
    selectedTime,
  ]);

  useEffect(() => {
    if (!isOpen || !shop || !days[0]) return;
    const controller = new AbortController();
    setLoadingBookingData(true);
    setError('');
    void fetch(
      `/api/shops/${shop.id}/booking-data?date=${encodeURIComponent(days[0].dateStr)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            responseData?.error || t('bookingDrawer.loadBarbersError'),
          );
        return responseData as MarketplaceBookingResponse;
      })
      .then((responseData) => {
        if (controller.signal.aborted) return;
        const loadedProfessionals = responseData.professionals ?? [];
        setShopPlan(responseData.plan ?? shop?.plan ?? 'free');
        setProfessionals(loadedProfessionals);
        const requestedProfessional = selectedProfessionalId
          ? loadedProfessionals.find(
              (item) => item.id === selectedProfessionalId,
            )
          : null;
        if (requestedProfessional) {
          setProfessional(requestedProfessional);
        } else if (loadedProfessionals.length === 1) {
          // A single-professional shop has no meaningful choice to present.
          // Assign that professional automatically in every public booking flow.
          setProfessional(loadedProfessionals[0]);
        } else if (selectedProfessionalId) {
          setStep(1);
        }
        setServices(responseData.services ?? []);
        setManualPrepayment(
          responseData.manualPrepayment?.enabled ? responseData.manualPrepayment : null,
        );
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError')
          setError(
            reason instanceof Error
              ? reason.message
              : t('bookingDrawer.loadBarbersError'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBookingData(false);
      });
    return () => controller.abort();
  }, [
    appearance,
    days,
    isOpen,
    retryKey,
    selectedProfessionalId,
    shop,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      step !== 1 ||
      !shop ||
      !serviceId ||
      professionals.length === 0
    ) {
      setDayAvailability({});
      setLoadingDayAvailability(false);
      setDayAvailabilityReady(false);
      setDayAvailabilityError(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      date: days[0].dateStr,
      serviceId,
      availabilityOverview: '1',
    });
    if (professional?.id) query.set('professionalId', professional.id);

    setDayAvailability({});
    setDayAvailabilityReady(false);
    setDayAvailabilityError(false);
    setLoadingDayAvailability(true);
    void fetch(
      `/api/shops/${shop.id}/booking-data?${query.toString()}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            responseData?.error || t('bookingDrawer.loadTimesError'),
          );
        return responseData as MarketplaceBookingResponse & {
          dayAvailability?: Record<
            string,
            { available: boolean; closedDay: boolean }
          >;
        };
      })
      .then((responseData) => {
        if (controller.signal.aborted) return;
        const overview = responseData.dayAvailability;
        const hasCompleteOverview = Boolean(
          overview &&
            days.every((day) => {
              const status = overview[day.dateStr];
              return (
                status &&
                typeof status.available === 'boolean' &&
                typeof status.closedDay === 'boolean'
              );
            }),
        );
        if (!hasCompleteOverview)
          throw new Error(
            locale === 'pt'
              ? 'Não foi possível confirmar a disponibilidade para todos os dias.'
              : 'Could not verify availability for every day.',
          );
        setDayAvailability(overview!);
        setDayAvailabilityReady(true);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') {
          setDayAvailability({});
          setDayAvailabilityError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDayAvailability(false);
      });

    return () => controller.abort();
  }, [
    days,
    isOpen,
    locale,
    professional?.id,
    professionals.length,
    retryKey,
    serviceId,
    shop?.id,
    step,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      step !== 2 ||
      !shop ||
      !currentDay ||
      !professional ||
      !service
    ) {
      setSlots([]);
      setSelectedDayClosed(false);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const key = `${shop.id}|${professional.id}|${service.id}|${currentDay.dateStr}`;
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < 8000) {
      const cachedSlots = cached.data.availableSlots ?? [];
      setSlots(cachedSlots);
      setSelectedDayClosed(cached.data.closedDay === true);
      setSelectedSlot(
        selectedDate === currentDay.dateStr &&
          selectedTime &&
          cachedSlots.includes(selectedTime)
          ? selectedTime
          : null,
      );
      setLoadingAvailability(false);
      return () => controller.abort();
    }
    setLoadingAvailability(true);
    setSelectedDayClosed(false);
    setError('');
    void fetch(
      `/api/shops/${shop.id}/booking-data?date=${encodeURIComponent(currentDay.dateStr)}&professionalId=${encodeURIComponent(professional.id)}&serviceId=${encodeURIComponent(service.id)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then(async (response) => {
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(responseData?.error || t('bookingDrawer.loadTimesError'));
        return responseData as MarketplaceBookingResponse;
      })
      .then((responseData) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(key, { data: responseData, timestamp: Date.now() });
        const availableSlots = responseData.availableSlots ?? [];
        setSlots(availableSlots);
        setSelectedDayClosed(responseData.closedDay === true);
        setSelectedSlot(
          selectedDate === currentDay.dateStr &&
            selectedTime &&
            availableSlots.includes(selectedTime)
            ? selectedTime
            : null,
        );
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
  }, [
    currentDay?.dateStr,
    isOpen,
    professional,
    retryKey,
    selectedDate,
    selectedTime,
    service,
    shop,
    step,
  ]);

  const customerLookupValue =
    customerLookupField === 'email'
      ? email.trim().toLowerCase()
      : customerLookupField === 'phone'
        ? phone.trim()
        : '';

  useEffect(() => {
    if (!isOpen || step !== 3 || !shop) return;
    const lookupField = customerLookupField;
    const normalizedEmail = lookupField === 'email' ? customerLookupValue : '';
    const normalizedPhone = lookupField === 'phone' ? customerLookupValue : '';
    const validLookup =
      lookupField === 'email'
        ? EMAIL_PATTERN.test(normalizedEmail)
        : lookupField === 'phone' &&
          normalizedPhone.replace(/\D/g, '').length >= 7;

    if (!validLookup) {
      customerControllerRef.current?.abort();
      setCustomerSuggestion(null);
      setCustomerState('idle');
      return;
    }

    const timeout = window.setTimeout(() => {
      customerControllerRef.current?.abort();
      const controller = new AbortController();
      customerControllerRef.current = controller;
      setCustomerSuggestion(null);
      setCustomerState('checking');
      void fetch('/api/bookings/customer-profile', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          shopId: shop.id,
          lookupBy: lookupField,
          value: customerLookupValue,
        }),
      })
        .then(async (response) => {
          const responseData = await response.json().catch(() => ({}));
          if (!response.ok || !responseData.success)
            throw new Error(
              responseData?.error || t('bookingDrawer.verifyCustomerError'),
            );
          return responseData as {
            matched?: boolean;
            matchedBy?: CustomerLookupField;
            lookupToken?: string;
            customerName?: string | null;
          };
        })
        .then((responseData) => {
          if (controller.signal.aborted) return;
          if (responseData.matched && responseData.lookupToken && responseData.matchedBy) {
            setCustomerSuggestion({
              lookupToken: responseData.lookupToken,
              matchedBy: responseData.matchedBy,
              customerName: responseData.customerName ?? null,
            });
            setCustomerState('suggestion');
          } else {
            setCustomerSuggestion(null);
            setCustomerState('new');
          }
        })
        .catch((reason) => {
          if (reason?.name !== 'AbortError') {
            setCustomerSuggestion(null);
            setCustomerState('error');
          }
        });
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      customerControllerRef.current?.abort();
    };
  }, [
    customerLookupField,
    customerLookupValue,
    isOpen,
    shop?.id,
    step,
  ]);

  async function confirmCustomerProfile() {
    if (!shop || !customerSuggestion) return;
    customerControllerRef.current?.abort();
    const controller = new AbortController();
    customerControllerRef.current = controller;
    setCustomerState('checking');

    try {
      const response = await fetch('/api/bookings/customer-profile', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          shopId: shop.id,
          lookupToken: customerSuggestion.lookupToken,
        }),
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !responseData.success || !responseData.profile) {
        const message =
          responseData?.error || t('bookingDrawer.verifyCustomerError');
        if (response.status === 410 || response.status === 404) {
          setCustomerSuggestion(null);
          setCustomerState('new');
          toast.error(message);
          return;
        }
        throw new Error(message);
      }

      const profile = responseData.profile as {
        name?: string;
        email?: string;
        phone?: string;
        birthDate?: string;
      };
      setName((current) => current.trim() || profile.name?.trim() || '');
      setEmail((current) => current.trim() || profile.email?.trim() || '');
      setPhone((current) => current.trim() || profile.phone?.trim() || '');
      setBirthDate(
        (current) =>
          current.trim() ||
          (profile.birthDate ? birthDateToDisplay(profile.birthDate) : ''),
      );
      setCustomerSuggestion(null);
      setCustomerState('matched');
      toast.success(t('bookingDrawer.profileAutofilled'));
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') return;
      setCustomerState('suggestion');
      toast.error(
        reason instanceof Error
          ? reason.message
          : t('bookingDrawer.verifyCustomerError'),
      );
    }
  }

  function declineCustomerProfile() {
    setCustomerSuggestion(null);
    setCustomerState('new');
  }

  const canContinueOne = Boolean(
    currentDay &&
      professional &&
      service &&
      !currentDayUnavailable &&
      !loadingBookingData &&
      !loadingDayAvailability &&
      dayAvailabilityReady &&
      !dayAvailabilityError,
  );
  const canContinueTwo = Boolean(selectedSlot);

  function continueOne() {
    if (!professional) return toast.error(t('bookingDrawer.chooseBarber'));
    if (!service) return toast.error(t('bookingDrawer.chooseService'));
    if (
      loadingDayAvailability ||
      !dayAvailabilityReady ||
      dayAvailabilityError
    )
      return toast.error(
        locale === 'pt'
          ? 'Ainda não foi possível confirmar as vagas. Tenta novamente.'
          : 'Availability has not been verified yet. Please retry.',
      );
    if (currentDayUnavailable)
      return toast.error(
        currentDayClosed
          ? locale === 'pt'
            ? 'O barbeiro está de folga neste dia. Escolhe outra data.'
            : 'This barber is off on this day. Choose another date.'
          : locale === 'pt'
            ? 'Este dia já não tem horários disponíveis. Escolhe outra data.'
            : 'There are no available times on this day. Choose another date.',
      );
    setStep(2);
  }

  function continueTwo() {
    if (!selectedSlot)
      return toast.error(t('bookingDrawer.chooseAvailableTime'));
    setStep(3);
  }

  async function submit() {
    if (
      !shop ||
      !professional ||
      !service ||
      !currentDay ||
      (!waitlistOnly && !selectedSlot)
    )
      return;
    if (!name.trim() || !phone.trim() || !email.trim())
      return toast.error(t('bookingDrawer.requiredFields'));
    if (waitlistOnly && !waitlistConsent)
      return toast.error(
        locale === 'en'
          ? 'Please accept the waitlist contact notice.'
          : 'Aceita o aviso de contacto para entrares na lista de espera.',
      );
    const birthDateIso = birthDateToIso(birthDate);
    if (!waitlistOnly && requireBirthDate && !birthDateIso)
      return toast.error(t('bookingDrawer.validBirthDate'));
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(
        waitlistOnly ? `/api/shops/${shop.id}/waitlist` : '/api/bookings',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            waitlistOnly
              ? {
                  serviceId: service.id,
                  professionalId: professional.id,
                  date: currentDay.dateStr,
                  customerName: name.trim(),
                  customerPhone: phone.trim(),
                  customerEmail: email.trim(),
                  consent: true,
                }
              : {
                  shopId: shop.id,
                  service: service.id,
                  date: currentDay.dateStr,
                  slot: selectedSlot,
                  professionalId: professional.id,
                  customerName: name.trim(),
                  customerPhone: phone.trim(),
                  customerEmail: email.trim(),
                  ...(birthDateIso ? { customerBirthDate: birthDateIso } : {}),
                  prepayment: prepaymentSelected,
                },
          ),
        },
      );
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok || !responseData.success)
        throw new Error(responseData?.error || t('bookingDrawer.bookingError'));
      cacheRef.current.clear();
      if (waitlistOnly) {
        trackWaitlistJoined(appearance);
        setPaymentInstructions(null);
        setBookingReceipt(null);
        toast.success(
          locale === 'en'
            ? 'You are on the waitlist.'
            : 'Ficaste na lista de espera.',
        );
        setStep(4);
        return;
      }
      const bookingData =
        responseData.booking && typeof responseData.booking === 'object'
          ? responseData.booking
          : null;
      setBookingReceipt({
        id: typeof bookingData?.id === 'string' ? bookingData.id : null,
        status: bookingData?.status === 'scheduled' ? 'scheduled' : 'pending',
      });
      const paymentMethod = responseData.payment?.method ?? null;
      trackBookingCompleted(appearance, prepaymentSelected, paymentMethod);
      if (paymentMethod === 'mbway') {
        setPaymentInstructions({
          bookingId: String(responseData.booking?.id ?? ''),
          amount: Number(responseData.payment.amount),
          mbwayPhone: String(responseData.payment.mbwayPhone),
          whatsappPhone: String(responseData.payment.whatsappPhone),
          expiresAt: String(responseData.payment.expiresAt),
        });
        toast.success(t('bookingDrawer.prepaymentSubmitted'));
      } else {
        setPaymentInstructions(null);
        if (bookingData?.status === 'scheduled') {
          toast.success(t('bookingDrawer.bookingSuccess'));
        } else {
          toast.success(
            locale === 'en'
              ? 'Booking request received. Waiting for the barbershop to confirm.'
              : 'Pedido de marcação recebido. Aguarda a confirmação da barbearia.',
          );
        }
      }
      setStep(4);
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
  const whatsappDigits = paymentInstructions
    ? normalizeWhatsAppNumber(paymentInstructions.whatsappPhone)
    : '';
  const whatsappMessage = paymentInstructions
    ? [
        t('bookingDrawer.whatsappProofMessage'),
        `${shop.name} — ${service?.name || 'Serviço'}`,
        `${currentDay?.dateStr || ''} ${selectedSlot || ''}`,
        `MB WAY: ${paymentInstructions.amount.toFixed(2)} €`,
        `Cliente: ${name.trim()}`,
        `Email: ${email.trim()}`,
        `Ref.: ${paymentInstructions.bookingId}`,
      ].join('\n')
    : '';
  const whatsappProofUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappMessage)}`
    : '';
  const bookingConfirmed =
    !waitlistOnly &&
    !paymentInstructions &&
    bookingReceipt?.status === 'scheduled';

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        data-booking-theme={appearance}
        className={`mx-auto flex h-[min(90svh,48rem)] max-h-[90svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:h-auto sm:max-h-[92dvh] sm:rounded-t-3xl ${appearance === 'agenda' ? 'border-[#e8e7e2] bg-white text-[#171717]' : 'border-white/10 bg-zinc-950 text-zinc-100'}`}
      >
        {appearance === 'agenda' && (
          <style>{`
            [data-booking-theme="agenda"] { background: #fff !important; color: #171717 !important; border-color: #e8e7e2 !important; border-radius: 1rem 1rem 0 0 !important; box-shadow: 0 -18px 60px rgba(0,0,0,.10) !important; }
            [data-booking-theme="agenda"] [data-slot="button"][data-variant="default"] { background: #171717 !important; color: #fff !important; box-shadow: none !important; }
            [data-booking-theme="agenda"] [data-slot="button"][data-variant="default"]:hover { background: #3b3b38 !important; }
            [data-booking-theme="agenda"] [data-slot="button"][data-variant="outline"] { background: #fff !important; color: #171717 !important; border-color: #e8e7e2 !important; }
            [data-booking-theme="agenda"] [data-slot="button"][data-variant="ghost"] { color: #55554f !important; }
            [data-booking-theme="agenda"] .text-zinc-100 { color: #171717 !important; }
            [data-booking-theme="agenda"] .text-zinc-200 { color: #292929 !important; }
            [data-booking-theme="agenda"] .text-zinc-400,
            [data-booking-theme="agenda"] .text-zinc-500 { color: #777770 !important; }
            [data-booking-theme="agenda"] .text-zinc-600 { color: #92928a !important; }
            [data-booking-theme="agenda"] [data-slot="input"] { background: #fff !important; color: #171717 !important; border-color: #e8e7e2 !important; }
            [data-booking-theme="agenda"] [data-slot="input"]::placeholder { color: #92928a !important; }
            [data-booking-theme="agenda"] [data-slot="input"]:focus-visible { border-color: #999 !important; --tw-ring-color: rgba(23,23,23,.12) !important; }
            [data-booking-theme="agenda"] [class~="bg-white/10"] { background-color: #e8e7e2 !important; }
            [data-booking-theme="agenda"] [class~="bg-white/[0.035]"],
            [data-booking-theme="agenda"] [class~="bg-white/[0.055]"] { background-color: #f8f8f6 !important; }
            [data-booking-theme="agenda"] .text-emerald-300,
            [data-booking-theme="agenda"] .text-emerald-100 { color: #33332f !important; }
            [data-booking-theme="agenda"] [class~="bg-zinc-950"] { background-color: #fff !important; }
            [data-booking-theme="agenda"] [class~="bg-white/[0.025]"],
            [data-booking-theme="agenda"] [class~="bg-white/[0.02]"],
            [data-booking-theme="agenda"] [class~="bg-white/[0.03]"] { background-color: #f8f8f6 !important; }
            [data-booking-theme="agenda"] [class~="border-white/10"],
            [data-booking-theme="agenda"] [class~="border-white/20"] { border-color: #e8e7e2 !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-400/[.035]"] { background-color: #f8f8f6 !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-400/[.08]"] { background-color: #f1f1ed !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-400"] { background-color: #171717 !important; color: #fff !important; }
            [data-booking-theme="agenda"] [class~="border-emerald-400/20"],
            [data-booking-theme="agenda"] [class~="border-emerald-400/15"] { border-color: #d8e3da !important; }
            [data-booking-theme="agenda"] .text-emerald-200 { color: #315a44 !important; }
            [data-booking-theme="agenda"] .text-amber-200,
            [data-booking-theme="agenda"] .text-amber-300 { color: #76572d !important; }
            [data-booking-theme="agenda"] [class~="border-emerald-400/40"] { border-color: #b8b8b0 !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-400/[0.08]"] { background-color: #f1f1ed !important; }
            [data-booking-theme="agenda"] [class~="bg-emerald-300"] { background-color: #171717 !important; color: #fff !important; }
            [data-booking-theme="agenda"] [class~="text-zinc-950"] { color: #fff !important; }
            [data-booking-theme="agenda"] [class~="focus-visible:ring-emerald-400"]:focus-visible { --tw-ring-color: #777 !important; }
            [data-booking-theme="agenda"] [class~="border-amber-400/20"] { border-color: #eadcc7 !important; }
            [data-booking-theme="agenda"] [class~="bg-amber-400/[0.05]"] { background-color: #faf7f1 !important; }
            [data-booking-theme="agenda"] .text-amber-100 { color: #76572d !important; }
            [data-booking-theme="agenda"] [class~="border-rose-400/35"] { border-color: #efcaca !important; }
            [data-booking-theme="agenda"] [class~="bg-rose-400/[0.08]"] { background-color: #fff1f1 !important; }
            [data-booking-theme="agenda"] .text-rose-200,
            [data-booking-theme="agenda"] .text-rose-300 { color: #963c3c !important; }
          `}</style>
        )}
        <header className="shrink-0 border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                {t('bookingDrawer.bookingTitle')}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold">
                {step === 4
                  ? paymentInstructions
                    ? t('bookingDrawer.prepaymentPendingTitle')
                    : waitlistOnly
                      ? locale === 'en'
                        ? 'You are on the waitlist'
                        : 'Estás na lista de espera'
                      : bookingConfirmed
                        ? t('bookingDrawer.bookingConfirmed')
                        : locale === 'en'
                          ? 'Request received — awaiting confirmation'
                          : 'Pedido recebido — aguarda confirmação'
                  : shop.name}
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                {step === 1
                  ? appearance === 'agenda'
                    ? locale === 'pt'
                      ? 'Escolhe o dia e o serviço'
                      : 'Choose a day and service'
                    : t('bookingDrawer.chooseBarberDayService')
                  : step === 2
                    ? t('bookingDrawer.nextChooseTime')
                    : step === 3
                      ? waitlistOnly
                        ? locale === 'en'
                          ? 'Leave your contact details to be notified about an opening.'
                          : 'Deixa os teus contactos para receberes um aviso quando surgir uma vaga.'
                        : t('bookingDrawer.confirmYourDetails')
                      : paymentInstructions
                        ? t('bookingDrawer.prepaymentPendingDescription')
                        : waitlistOnly
                          ? locale === 'en'
                            ? 'The barbershop may contact you if a suitable opening becomes available.'
                            : 'A barbearia poderá contactar-te se surgir uma vaga adequada.'
                          : bookingConfirmed
                            ? locale === 'en'
                              ? 'The barbershop has confirmed your appointment.'
                              : 'A barbearia confirmou a tua marcação.'
                            : locale === 'en'
                              ? 'Your request was received. The appointment is not confirmed yet.'
                              : 'Recebemos o teu pedido. A marcação ainda não está confirmada.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('bookingDrawer.closeBooking')}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X className="size-5" aria-hidden="true" />
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

        <div
          ref={scrollAreaRef}
          data-booking-scroll-area
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 [-webkit-overflow-scrolling:touch] sm:px-5 sm:pb-5"
        >
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
                {step < 3
                  ? t('bookingDrawer.retry')
                  : t('bookingDrawer.backToDetails')}
              </Button>
            </div>
          ) : step === 1 ? (
            <section className="space-y-6" aria-labelledby="booking-step-one">
              {loadingBookingData ? (
                <div
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 text-xs text-zinc-400"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  {locale === 'pt'
                    ? 'A carregar barbeiros e serviços…'
                    : 'Loading barbers and services…'}
                </div>
              ) : null}
              {(appearance !== 'agenda' || professionals.length !== 1) &&
                (professionals.length === 1 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <UserRound
                        className="size-4 text-emerald-300"
                        aria-hidden="true"
                      />
                      <h3
                        id="booking-step-one"
                        className="text-sm font-semibold"
                      >
                        {t('bookingDrawer.stepOneBarber')}
                      </h3>
                    </div>
                    <p className="text-sm font-semibold">
                      {professionals[0].name}
                    </p>
                    {professionals[0].role ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {professionals[0].role}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <UserRound
                        className={`size-4 ${appearance === 'agenda' ? 'text-emerald-700' : 'text-emerald-300'}`}
                        aria-hidden="true"
                      />
                      <h3
                        id="booking-step-one"
                        className="text-sm font-semibold"
                      >
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
                          className={`flex min-h-16 items-center justify-between rounded-2xl border p-4 text-left transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${professional?.id === item.id ? (appearance === 'agenda' ? 'border-emerald-500/35 bg-emerald-50 text-[#173d30]' : 'border-emerald-400/40 bg-emerald-400/[0.08]') : appearance === 'agenda' ? 'border-[#e8e7e2] bg-white text-[#292929] hover:border-[#c5c5bb]' : 'border-white/10 bg-white/[0.025] text-zinc-200 hover:border-white/20'}`}
                        >
                          <span>
                            <span className="block text-sm font-semibold">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {item.role ||
                                t('bookingDrawer.professionalDefault')}
                            </span>
                          </span>
                          {professional?.id === item.id && (
                            <Check
                              className={`size-5 ${appearance === 'agenda' ? 'text-emerald-700' : 'text-emerald-300'}`}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    {!loadingBookingData && !professionals.length && (
                      <p
                        className={`rounded-2xl border p-4 text-sm ${appearance === 'agenda' ? 'border-[#e8e7e2] text-[#73736c]' : 'border-white/10 text-zinc-500'}`}
                      >
                        {t('bookingDrawer.noBarbers')}
                      </p>
                    )}
                  </div>
                ))}

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Scissors
                    className="size-4 text-zinc-400"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">
                    {t('bookingDrawer.stepThreeService')}
                  </h3>
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
                      {item.name} · {item.durationMinutes} min{Number(item.bufferMinutes ?? 0) > 0
                        ? ` + ${Number(item.bufferMinutes)} min ${locale === 'pt' ? 'preparação' : 'buffer'}`
                        : ''} · €
                      {Number(item.price).toFixed(2)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-500">
                  {locale === 'pt'
                    ? 'Seleciona o serviço para verificarmos em que dias ainda existem vagas.'
                    : 'Select a service so we can check which days still have openings.'}
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays
                    className="size-4 text-emerald-300"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold">
                    {t('bookingDrawer.stepTwoDay')}
                  </h3>
                </div>
                {availableDays.length ? (
                  <>
                    <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {availableDays.map((day, index) => {
                        const dayStatus = getDayStatus(day);
                        const isUnavailable = dayStatus.unavailable;
                        return (
                          <button
                            key={day.dateStr}
                            type="button"
                            aria-pressed={dayIndex === index}
                            aria-label={
                              day.fullDateFormatted +
                              (dayStatus.dayOff
                                ? locale === 'pt'
                                  ? ', folga'
                                  : ', day off'
                                : dayStatus.noSlots
                                  ? locale === 'pt'
                                    ? ', sem horários disponíveis'
                                    : ', no available times'
                                  : dayStatus.needsService
                                    ? locale === 'pt'
                                      ? ', escolhe primeiro um serviço'
                                      : ', choose a service first'
                                    : dayStatus.disabled
                                      ? locale === 'pt'
                                        ? ', disponibilidade por confirmar'
                                        : ', availability not yet verified'
                                      : '')
                            }
                            onClick={() => {
                              if (dayStatus.disabled) return;
                              setDayIndex(index);
                              setSelectedSlot(null);
                            }}
                            disabled={dayStatus.disabled}
                            className={`min-w-[70px] shrink-0 snap-start rounded-2xl border px-2.5 py-3 text-center transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${isUnavailable ? 'cursor-not-allowed border-rose-400/35 bg-rose-400/[0.08] text-rose-200 opacity-70' : dayStatus.disabled ? 'cursor-not-allowed border-amber-400/20 bg-amber-400/[0.035] text-zinc-500 opacity-70' : dayIndex === index ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
                          >
                            <span className="block text-[10px] font-semibold text-zinc-500">
                              {day.isToday
                                ? t('bookingDrawer.today').toLocaleUpperCase(
                                    locale === 'pt' ? 'pt-PT' : 'en-GB',
                                  )
                                : day.weekdayShort}
                            </span>
                            <span className="mt-1 block text-xl font-black">
                              {day.dayNumeric}
                            </span>
                            <span
                              className={`mt-1 block text-[10px] ${isUnavailable ? 'font-semibold text-rose-300' : 'text-zinc-500'}`}
                            >
                              {dayStatus.dayOff
                                ? locale === 'pt'
                                  ? 'Folga'
                                  : 'Day off'
                                : dayStatus.noSlots
                                  ? locale === 'pt'
                                    ? 'Sem vagas'
                                    : 'Fully booked'
                                  : dayStatus.needsService
                                    ? locale === 'pt'
                                      ? 'Escolhe serviço'
                                      : 'Choose service'
                                    : dayStatus.checking || dayStatus.unverified
                                      ? locale === 'pt'
                                        ? 'A verificar'
                                        : 'Checking'
                                      : dayStatus.verificationFailed
                                        ? locale === 'pt'
                                          ? 'Por confirmar'
                                          : 'Unverified'
                                        : (day.fullDateFormatted.split(' ')[2] ?? '')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!serviceId ? (
                      <p className="mt-2 text-[11px] text-zinc-500" role="note">
                        {locale === 'pt'
                          ? 'Escolhe primeiro um serviço para desbloquear a consulta das vagas.'
                          : 'Choose a service first to check which days have openings.'}
                      </p>
                    ) : null}
                    {loadingDayAvailability ? (
                      <p
                        className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        {locale === 'pt'
                          ? 'A verificar horários disponíveis…'
                          : 'Checking available times…'}
                      </p>
                    ) : null}
                    {availableDays.some((day) => getDayStatus(day).unavailable) ? (
                      <p className="mt-2 flex items-center gap-2 text-[11px] text-rose-300" role="note">
                        <span className="size-2 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
                        {locale === 'pt'
                          ? 'A vermelho: dia de folga ou sem horários disponíveis'
                          : 'In red: day off or no available times'}
                      </p>
                    ) : null}
                    {dayAvailabilityError ? (
                      <div
                        className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-300"
                        role="status"
                      >
                        <p>
                          {locale === 'pt'
                            ? 'Não foi possível confirmar todas as vagas. As datas ficam bloqueadas por segurança.'
                            : 'Could not verify all openings. Dates stay disabled until availability is confirmed.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRetryKey((value) => value + 1)}
                          className="rounded-lg px-2 py-1 font-semibold text-amber-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          {locale === 'pt' ? 'Tentar novamente' : 'Retry'}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-500">
                    {t('bookingDrawer.noOpenDays')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                disabled={!canContinueOne || loadingBookingData}
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
                    {professional?.name} · {currentDay?.fullDateFormatted}
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
              {service ? (
                <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {service.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {professional?.name}
                      {' · '}
                      {service.durationMinutes} {locale === 'pt' ? 'minutos' : 'minutes'}
                      {Number(service.bufferMinutes ?? 0) > 0 ? (
                        <span className="ml-1 text-amber-300">
                          · + {Number(service.bufferMinutes)} {locale === 'pt' ? 'min de preparação' : 'min buffer'}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <p className="shrink-0 text-base font-semibold tabular-nums text-emerald-200">
                    {new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(service.price)}
                  </p>
                </div>
              ) : null}
              {loadingAvailability ? (
                <div className="min-h-48 space-y-3" role="status" aria-live="polite">
                  <p className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {locale === 'pt'
                      ? 'A consultar horários para este serviço…'
                      : 'Checking times for this service…'}
                  </p>
                  <div
                    className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 8 }, (_, index) => (
                      <div
                        key={index}
                        className="h-12 animate-pulse rounded-xl border border-white/10 bg-white/[0.035]"
                      />
                    ))}
                  </div>
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
                    {selectedDayClosed
                      ? locale === 'pt'
                        ? 'O barbeiro está de folga neste dia.'
                        : 'This barber is off on this day.'
                      : t('bookingDrawer.noSlots')}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {selectedDayClosed
                      ? locale === 'pt'
                        ? 'Escolhe outro dia para veres os horários disponíveis.'
                        : 'Choose another day to see available times.'
                      : t('bookingDrawer.tryOtherDayBarber')}
                  </p>
                  {shopPlan === 'enterprise' ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 min-h-11 w-full border-emerald-400/20 text-emerald-200 hover:bg-emerald-400/[0.06]"
                      onClick={() => {
                        setWaitlistOnly(true);
                        setWaitlistConsent(false);
                        setStep(3);
                      }}
                    >
                      <Clock3 className="mr-2 size-4" aria-hidden="true" />
                      {locale === 'en'
                        ? 'Join the waitlist'
                        : 'Entrar na lista de espera'}
                    </Button>
                  ) : null}
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
                    {waitlistOnly
                      ? locale === 'en'
                        ? 'Join the waitlist'
                        : 'Entrar na lista de espera'
                      : t('bookingDrawer.stepThreeDetails')}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {service?.name} · {currentDay?.fullDateFormatted} ·{' '}
                    {waitlistOnly
                      ? locale === 'en'
                        ? 'Any time'
                        : 'Qualquer horário'
                      : selectedSlot}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWaitlistOnly(false);
                    setWaitlistConsent(false);
                    setStep(2);
                  }}
                >
                  <ArrowLeft className="mr-1 size-4" aria-hidden="true" />
                  Voltar
                </Button>
              </div>
              {!waitlistOnly && service ? (
                <div
                  className="mb-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-4"
                  role="note"
                  aria-label={
                    locale === 'en'
                      ? 'Booking summary and cancellation policy'
                      : 'Resumo da marcação e política de cancelamento'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        {locale === 'en' ? 'Booking summary' : 'Resumo da marcação'}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">
                        {service.name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {professional?.name ? `${professional.name} · ` : ''}
                        {service.durationMinutes} {locale === 'en' ? 'min' : 'min'}
                        {Number(service.bufferMinutes ?? 0) > 0 ? (
                          <span className="ml-1 text-amber-300">
                            · + {Number(service.bufferMinutes)} {locale === 'en' ? 'min buffer' : 'min de preparação'}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-200">
                      {new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'pt-PT', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(service.price)}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2 border-t border-white/[0.08] pt-3 text-xs leading-5 text-zinc-300">
                    <p>
                      <span className="font-semibold text-zinc-100">
                        {locale === 'en' ? 'Cancellation:' : 'Cancelamento:'}
                      </span>{' '}
                      {safeCancellationWindowHours === 0
                        ? locale === 'en'
                          ? 'You can cancel online until the appointment starts.'
                          : 'Podes cancelar online até à hora de início da marcação.'
                        : locale === 'en'
                          ? `You can cancel online up to ${safeCancellationWindowHours} h before. After that, contact the barbershop directly.`
                          : `Podes cancelar online até ${safeCancellationWindowHours} h antes. Depois, contacta diretamente a barbearia.`}
                    </p>
                    {safeMinimumBookingNoticeMinutes > 0 ? (
                      <p>
                        <span className="font-semibold text-zinc-100">
                          {locale === 'en' ? 'Minimum notice:' : 'Antecedência mínima:'}
                        </span>{' '}
                        {locale === 'en'
                          ? `At least ${minimumNoticeLabel} is required for new bookings. Times that do not meet this rule are hidden.`
                          : `São necessárias pelo menos ${minimumNoticeLabel} de antecedência para novas marcações. Os horários que não cumprem esta regra não são apresentados.`}
                      </p>
                    ) : null}
                    {requireBirthDate ? (
                      <p>
                        {locale === 'en'
                          ? 'A date of birth is required to complete this booking.'
                          : 'É necessária uma data de nascimento para concluir a marcação.'}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setCustomerLookupField('phone');
                        setCustomerSuggestion(null);
                        setCustomerState('idle');
                      }}
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
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setCustomerLookupField('email');
                        setCustomerSuggestion(null);
                        setCustomerState('idle');
                      }}
                      autoComplete="email"
                      placeholder="nome@email.com"
                    />
                  </div>
                </label>
                {!waitlistOnly && requireBirthDate && (
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
                )}

                {waitlistOnly && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.035] p-3 text-xs leading-5 text-zinc-300">
                    <input
                      type="checkbox"
                      checked={waitlistConsent}
                      onChange={(event) =>
                        setWaitlistConsent(event.target.checked)
                      }
                      className="mt-0.5 size-4 shrink-0 accent-emerald-400"
                    />
                    <span>
                      {locale === 'en'
                        ? 'I agree to be contacted by this barbershop about an available time for this request. This is not marketing consent.'
                        : 'Aceito que esta barbearia me contacte caso surja uma vaga para este pedido. Este consentimento não inclui mensagens de marketing.'}
                    </span>
                  </label>
                )}

                {!waitlistOnly && manualPrepayment?.enabled && (
                  <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-400/[.035]">
                    <button
                      type="button"
                      aria-pressed={prepaymentSelected}
                      onClick={() => setPrepaymentSelected((value) => !value)}
                      className={`flex min-h-14 w-full items-start gap-3 p-4 text-left transition-colors ${prepaymentSelected ? 'bg-emerald-400/[.08]' : 'hover:bg-white/[.025]'}`}
                    >
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${prepaymentSelected ? 'border-emerald-300 bg-emerald-300 text-zinc-950' : 'border-white/20 bg-white/[.03]'}`}
                      >
                        {prepaymentSelected && (
                          <Check className="size-3.5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-zinc-100">
                          {t('bookingDrawer.prepaymentOption')}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-400">
                          {t('bookingDrawer.prepaymentOptionDescription')}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-200">
                        {Number(service?.price ?? 0).toFixed(2)} €
                      </span>
                    </button>
                    {prepaymentSelected && (
                      <div className="grid gap-2 border-t border-emerald-400/15 px-4 py-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">
                            {t('bookingDrawer.prepaymentAmount')}
                          </span>
                          <strong className="text-zinc-100">
                            {Number(service?.price ?? 0).toFixed(2)} €
                          </strong>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500">
                            {t('bookingDrawer.prepaymentNumber')}
                          </span>
                          <strong className="text-zinc-100">
                            {manualPrepayment.mbwayPhone}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
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
                  {customerState === 'suggestion' && customerSuggestion && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          {t('bookingDrawer.profileSuggestionCustomer')}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-zinc-100">
                          {customerSuggestion.customerName ||
                            t('bookingDrawer.profileSuggestionNameUnavailable')}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-zinc-100">
                        {customerSuggestion.matchedBy === 'email'
                          ? t('bookingDrawer.profileSuggestionEmail')
                          : t('bookingDrawer.profileSuggestionPhone')}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={submitting}
                          onClick={() => void confirmCustomerProfile()}
                          className="w-full"
                        >
                          {t('bookingDrawer.profileConfirm')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={declineCustomerProfile}
                          className="w-full"
                        >
                          {t('bookingDrawer.profileReject')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {customerState === 'matched' && (
                    <p className="flex items-center gap-2 text-xs text-emerald-300">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      {t('bookingDrawer.profileAutofilled')}
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
                  {submitting
                    ? t('bookingDrawer.reserving')
                    : waitlistOnly
                      ? locale === 'en'
                        ? 'Join waitlist'
                        : 'Entrar na lista de espera'
                      : prepaymentSelected
                        ? t('bookingDrawer.requestPrepayment')
                        : t('bookingDrawer.confirmBooking')}
                </Button>
              </div>
            </section>
          ) : (
            <section
              className="flex min-h-80 flex-col items-center justify-center text-center"
              aria-labelledby="booking-success-title"
            >
              <div
                className={`flex size-16 items-center justify-center rounded-full border ${bookingConfirmed || waitlistOnly ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-amber-400/25 bg-amber-400/10'}`}
              >
                {bookingConfirmed || waitlistOnly ? (
                  <CheckCircle2
                    className="size-8 text-emerald-300"
                    aria-hidden="true"
                  />
                ) : (
                  <Clock3
                    className="size-8 text-amber-300"
                    aria-hidden="true"
                  />
                )}
              </div>
              <h3
                id="booking-success-title"
                className="mt-5 text-xl font-semibold"
              >
                {paymentInstructions
                  ? t('bookingDrawer.prepaymentPendingTitle')
                  : waitlistOnly
                    ? locale === 'en'
                      ? 'You are on the waitlist'
                      : 'Estás na lista de espera'
                    : bookingConfirmed
                      ? t('bookingDrawer.bookingConfirmed')
                      : locale === 'en'
                        ? 'Request received — awaiting confirmation'
                        : 'Pedido recebido — aguarda confirmação'}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                {waitlistOnly ? (
                  locale === 'en' ? (
                    `Your request for ${service?.name} on ${currentDay?.fullDateFormatted} has been saved. The barbershop may contact you if a suitable opening becomes available.`
                  ) : (
                    `O teu pedido para ${service?.name} em ${currentDay?.fullDateFormatted} ficou registado. A barbearia poderá contactar-te se surgir uma vaga adequada.`
                  )
                ) : (
                  <>
                    {service?.name} {t('bookingDrawer.with')}{' '}
                    {professional?.name}, {currentDay?.fullDateFormatted},{' '}
                    {t('bookingDrawer.at')} {selectedSlot}.
                  </>
                )}
              </p>
              {!waitlistOnly ? (
                <>
                  <div
                    className={`mt-5 w-full rounded-2xl border p-4 text-left ${bookingConfirmed ? 'border-emerald-400/20 bg-emerald-400/[.035]' : 'border-amber-400/20 bg-amber-400/[.045]'}`}
                    role="status"
                    aria-live="polite"
                  >
                    <p className={`text-sm font-semibold ${bookingConfirmed ? 'text-emerald-200' : 'text-amber-100'}`}>
                      {paymentInstructions
                        ? locale === 'en'
                          ? 'Payment proof pending review'
                          : 'Comprovativo pendente de validação'
                        : bookingConfirmed
                          ? locale === 'en'
                            ? 'Your appointment is confirmed'
                            : 'A tua marcação está confirmada'
                          : locale === 'en'
                            ? 'Waiting for the barbershop to confirm'
                            : 'À espera da confirmação da barbearia'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      {paymentInstructions
                        ? locale === 'en'
                          ? 'Send the MB WAY proof using the WhatsApp button below. The booking remains pending until the barbershop validates the payment.'
                          : 'Envia o comprovativo MB WAY pelo botão do WhatsApp. A marcação permanece pendente até a barbearia validar o pagamento.'
                        : bookingConfirmed
                          ? locale === 'en'
                            ? 'The selected time is reserved for you.'
                            : 'O horário escolhido está reservado para ti.'
                          : locale === 'en'
                            ? 'Your request has been recorded, but the selected time is not confirmed yet. You can follow its status in your customer area.'
                            : 'Recebemos o teu pedido. A marcação ainda não está confirmada. Podes acompanhar o estado na tua área de cliente.'}
                    </p>
                    {bookingReceipt?.id ? (
                      <p className="mt-3 break-all border-t border-white/10 pt-3 text-[11px] text-zinc-500">
                        {locale === 'en' ? 'Booking reference' : 'Referência da marcação'}:{' '}
                        <span className="font-mono text-zinc-300">{bookingReceipt.id}</span>
                      </p>
                    ) : null}
                  </div>

                  <div
                    className="mt-3 grid w-full grid-cols-2 gap-2 text-left"
                    aria-label={locale === 'pt' ? 'Resumo do serviço e da marcação' : 'Service summary and booking details'}
                  >
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <p className="text-[11px] text-zinc-500">{locale === 'en' ? 'Date' : 'Data'}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{currentDay?.fullDateFormatted}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <p className="text-[11px] text-zinc-500">{locale === 'en' ? 'Time' : 'Hora'}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{selectedSlot}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <p className="text-[11px] text-zinc-500">{locale === 'en' ? 'Duration' : 'Duração'}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{service?.durationMinutes ?? 0} min</p>
                      {Number(service?.bufferMinutes ?? 0) > 0 ? (
                        <p className="mt-1 text-[11px] text-amber-300">
                          + {Number(service?.bufferMinutes)} min {locale === 'pt' ? 'de preparação' : 'buffer'}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <p className="text-[11px] text-zinc-500">{locale === 'en' ? 'Service price' : 'Preço do serviço'}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{service ? Number(service.price).toFixed(2) : '—'} €</p>
                    </div>
                  </div>

                  {bookingReceipt?.id ? (
                    <a
                      href={`/my-bookings?email=${encodeURIComponent(email.trim())}`}
                      className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
                    >
                      {locale === 'en' ? 'Open customer area' : 'Abrir área de cliente'}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </a>
                  ) : null}
                  <p className="mt-2 text-center text-[11px] leading-5 text-zinc-500">
                    {locale === 'en'
                      ? 'Use the same email to access your bookings. We will send a one-time code to verify it.'
                      : 'Usa o mesmo email para consultar as tuas marcações. Enviaremos um código de utilização única para o confirmar.'}
                  </p>
                </>
              ) : null}
              {paymentInstructions && (
                <div className="mt-5 w-full space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.035] p-4 text-left">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">
                      {t('bookingDrawer.prepaymentAmount')}
                    </span>
                    <strong className="text-lg tabular-nums text-zinc-100">
                      {paymentInstructions.amount.toFixed(2)} €
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">
                      {t('bookingDrawer.prepaymentNumber')}
                    </span>
                    <strong className="text-zinc-100">
                      {paymentInstructions.mbwayPhone}
                    </strong>
                  </div>
                  <p className="text-xs leading-5 text-zinc-400">
                    {t('bookingDrawer.prepaymentExpiry', {
                      time: new Date(
                        paymentInstructions.expiresAt,
                      ).toLocaleTimeString(
                        locale === 'pt' ? 'pt-PT' : 'en-GB',
                        {
                          timeZone: 'Europe/Lisbon',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      ),
                    })}
                  </p>
                  {whatsappProofUrl ? (
                    <a
                      href={whatsappProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      {t('bookingDrawer.sendProofWhatsApp')}
                    </a>
                  ) : null}
                  <p className="text-xs leading-5 text-zinc-400">
                    {t('bookingDrawer.prepaymentEmailNotice')}
                  </p>
                </div>
              )}
              <Button
                type="button"
                className="mt-6 w-full"
                onClick={() => {
                  if (!waitlistOnly) {
                    onSuccess?.({
                      shopName: shop.name,
                      serviceName: service?.name || 'Serviço',
                      date: currentDay?.dateStr || '',
                      time: selectedSlot || '',
                      customerEmail: email.trim(),
                    });
                  }
                  onClose();
                }}
              >
                {t('bookingDrawer.finish')}
              </Button>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
