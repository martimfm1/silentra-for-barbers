'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Euro,
  Hash,
  Loader2,
  MapPin,
  PlusCircle,
  Sparkles,
  Tag,
  UserPlus,
  Users,
} from 'lucide-react';
import { StarfieldBackground } from '@/components/ui/starfield';
import { Button } from '@/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { captureProductEvent } from '@/lib/observability/posthog';
import { toast } from 'sonner';
import {
  WEEKDAY_KEYS,
  createDefaultWeeklySchedule,
  validateWeeklySchedule,
  type WeeklySchedule,
  type WeekdayKey,
} from '@/lib/scheduling/weekly-schedule';

type Step = 'selection' | 'create' | 'join';
type OnboardingCreateStep = 1 | 2 | 3 | 4 | 5;
const ONBOARDING_CREATE_STEP_COUNT = 5;
type DraftSaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

type OnboardingDraft = {
  createStep: OnboardingCreateStep;
  businessMode: 'solo' | 'team';
  shopName: string;
  address: string;
  doorNumber: string;
  postalCode: string;
  city: string;
  weeklySchedule: WeeklySchedule;
  price: number | '';
  firstServiceName: string;
  firstServiceDuration: string;
  tagsInput: string;
  lat: number | null;
  lng: number | null;
};

interface AddressSuggestion {
  id: string;
  streetWithNumber: string;
  fullAddress: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Ocorreu um erro inesperado.';
}

function normalizeInviteCode(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('SIL')) {
    const token = cleaned.slice(3);
    return token.length ? `SIL-${token.slice(0, 32)}` : 'SIL-';
  }

  if (cleaned.startsWith('BARB')) {
    const body = cleaned.slice(4, 16);
    const groups = body.match(/.{1,4}/g) ?? [];
    return groups.length ? `BARB-${groups.join('-')}` : 'BARB-';
  }

  if (/^[0-9A-F]{10}$/.test(cleaned)) return cleaned;
  if (/^[0-9A-Z]{1,12}$/.test(cleaned)) {
    const groups = cleaned.match(/.{1,4}/g) ?? [];
    return `BARB-${groups.join('-')}`;
  }

  return cleaned.slice(0, 46);
}

const inputClass =
  'min-h-11 rounded-xl border-white/10 bg-white/[0.04] text-sm text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50';

export default function OnboardingPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<Step>('selection');
  const [createStep, setCreateStep] = useState<OnboardingCreateStep>(1);
  const [businessMode, setBusinessMode] = useState<'solo' | 'team'>('solo');
  const [loading, setLoading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>('loading');
  const [draftWasRestored, setDraftWasRestored] = useState(false);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() =>
    createDefaultWeeklySchedule(),
  );
  const [price, setPrice] = useState<number | ''>(15);
  const [firstServiceName, setFirstServiceName] = useState('Corte de cabelo');
  const [firstServiceDuration, setFirstServiceDuration] = useState('30');
  const [tagsInput, setTagsInput] = useState('Corte, Barba');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const draftSaveTimerRef = useRef<number | null>(null);
  const draftSequenceRef = useRef(0);
  const draftCompletedRef = useRef(false);
  const weekdayLabels: Record<WeekdayKey, string> =
    locale === 'pt'
      ? {
          monday: 'Segunda-feira',
          tuesday: 'Terça-feira',
          wednesday: 'Quarta-feira',
          thursday: 'Quinta-feira',
          friday: 'Sexta-feira',
          saturday: 'Sábado',
          sunday: 'Domingo',
        }
      : {
          monday: 'Monday',
          tuesday: 'Tuesday',
          wednesday: 'Wednesday',
          thursday: 'Thursday',
          friday: 'Friday',
          saturday: 'Saturday',
          sunday: 'Sunday',
        };

  const updateWorkingTime = (
    dayKey: WeekdayKey,
    field: 'start' | 'end',
    value: string,
  ) => {
    setWeeklySchedule((current) => {
      const interval = current[dayKey].work_intervals[0] ?? {
        start: '09:00',
        end: '19:00',
      };
      return {
        ...current,
        [dayKey]: {
          ...current[dayKey],
          work_intervals: [{ ...interval, [field]: value }],
        },
      };
    });
  };

  const updateDayOff = (dayKey: WeekdayKey, dayOff: boolean) => {
    setWeeklySchedule((current) => ({
      ...current,
      [dayKey]: {
        ...current[dayKey],
        day_off: dayOff,
        work_intervals: dayOff
          ? current[dayKey].work_intervals
          : current[dayKey].work_intervals.length
            ? current[dayKey].work_intervals
            : [{ start: '09:00', end: '19:00' }],
      },
    }));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (!invite) return;

    const normalized = normalizeInviteCode(invite);
    if (!normalized) return;
    setInviteCode(normalized);
    setStep('join');
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has('invite')) {
      setDraftStatus('idle');
      setDraftReady(true);
      return () => {
        active = false;
      };
    }

    const restoreDraft = async () => {
      try {
        const response = await fetch('/api/onboarding/draft', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.success !== true) {
          throw new Error('DRAFT_RESTORE_FAILED');
        }

        const draft = payload.draft as OnboardingDraft | null;
        if (!active) return;
        if (draft) {
          setCreateStep(draft.createStep ?? 1);
          setBusinessMode(draft.businessMode);
          setShopName(draft.shopName);
          setAddress(draft.address);
          setDoorNumber(draft.doorNumber);
          setPostalCode(draft.postalCode);
          setCity(draft.city);
          setWeeklySchedule(draft.weeklySchedule);
          setPrice(draft.price);
          setFirstServiceName(draft.firstServiceName);
          setFirstServiceDuration(draft.firstServiceDuration);
          setTagsInput(draft.tagsInput);
          setLat(draft.lat);
          setLng(draft.lng);
          setIsAddressSelected(draft.lat !== null && draft.lng !== null);
          setStep('create');
          setDraftWasRestored(true);
          setDraftStatus('saved');
        } else {
          setDraftStatus('idle');
        }
      } catch {
        if (active) setDraftStatus('error');
      } finally {
        if (active) setDraftReady(true);
      }
    };

    void restoreDraft();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!address || address.length < 3 || isAddressSelected) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const response = await fetch(
          `/api/address/search?q=${encodeURIComponent(address)}`,
          {
            cache: 'no-store',
          },
        );
        const data = await response.json();
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch (error) {
        console.error('Address search error', error);
      } finally {
        setSearchingAddress(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [address, isAddressSelected]);

  useEffect(() => {
    if (isAddressSelected || !postalCode || postalCode.length < 4) return;

    const timer = window.setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const params = new URLSearchParams({
          postalCode,
          houseNumber: doorNumber,
          city,
        });
        const response = await fetch(
          `/api/address/search?${params.toString()}`,
          {
            cache: 'no-store',
          },
        );
        const data = await response.json();
        const results = Array.isArray(data.suggestions) ? data.suggestions : [];
        const best = results[0] as AddressSuggestion | undefined;
        if (best) {
          if (!address) setAddress(best.streetWithNumber || best.fullAddress);
          if (best.city) setCity(best.city);
          if (best.lat != null) setLat(best.lat);
          if (best.lng != null) setLng(best.lng);
          setIsAddressSelected(true);
        }
      } catch (error) {
        console.error('Postal search error', error);
      } finally {
        setSearchingAddress(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [postalCode, doorNumber, city, isAddressSelected, address]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const onboardingDraft = useMemo<OnboardingDraft>(
    () => ({
      createStep,
      businessMode,
      shopName,
      address,
      doorNumber,
      postalCode,
      city,
      weeklySchedule,
      price,
      firstServiceName,
      firstServiceDuration,
      tagsInput,
      lat,
      lng,
    }),
    [
      createStep,
      businessMode,
      shopName,
      address,
      doorNumber,
      postalCode,
      city,
      weeklySchedule,
      price,
      firstServiceName,
      firstServiceDuration,
      tagsInput,
      lat,
      lng,
    ],
  );

  const enqueueDraftSave = useCallback(
    (snapshot: OnboardingDraft, sequence: number): Promise<boolean> => {
      let saved = false;
      const queued = draftSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await fetch('/api/onboarding/draft', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ draft: snapshot }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || payload?.success !== true) {
              throw new Error('DRAFT_SAVE_FAILED');
            }
            saved = true;
            if (sequence === draftSequenceRef.current) {
              setDraftStatus('saved');
            }
          } catch {
            if (sequence === draftSequenceRef.current) {
              setDraftStatus('error');
            }
          }
        });

      draftSaveQueueRef.current = queued;
      return queued.then(() => saved);
    },
    [],
  );

  useEffect(() => {
    if (
      !draftReady ||
      step !== 'create' ||
      loading ||
      draftCompletedRef.current
    ) {
      return;
    }

    const snapshot = onboardingDraft;
    const sequence = ++draftSequenceRef.current;
    const timeoutId = window.setTimeout(() => {
      if (draftSaveTimerRef.current === timeoutId) {
        draftSaveTimerRef.current = null;
      }
      if (sequence === draftSequenceRef.current) {
        setDraftStatus('saving');
      }
      void enqueueDraftSave(snapshot, sequence);
    }, 750);
    draftSaveTimerRef.current = timeoutId;

    return () => {
      window.clearTimeout(timeoutId);
      if (draftSaveTimerRef.current === timeoutId) {
        draftSaveTimerRef.current = null;
      }
    };
  }, [draftReady, step, loading, onboardingDraft, enqueueDraftSave]);

  const progress =
    step === 'join'
      ? (inviteCode.trim() ? 100 : 0)
      : step === 'create'
        ? Math.round((createStep / ONBOARDING_CREATE_STEP_COUNT) * 100)
        : 0;

  const progressDescription =
    step === 'join'
      ? inviteCode.trim()
        ? (locale === 'pt' ? 'Convite introduzido' : 'Invite entered')
        : (locale === 'pt' ? 'Código de convite' : 'Invite code')
      : locale === 'pt'
        ? `Passo ${createStep} de ${ONBOARDING_CREATE_STEP_COUNT}`
        : `Step ${createStep} of ${ONBOARDING_CREATE_STEP_COUNT}`;

  const createStepTitle = {
    1: t('onboarding.createStepIdentity'),
    2: t('onboarding.createStepLocation'),
    3: t('onboarding.createStepService'),
    4: t('onboarding.createStepHours'),
    5: t('onboarding.createStepPresence'),
  }[createStep];

  const createStepDescription = {
    1: t('onboarding.createStepIdentityDescription'),
    2: t('onboarding.createStepLocationDescription'),
    3: t('onboarding.createStepServiceDescription'),
    4: t('onboarding.createStepHoursDescription'),
    5: t('onboarding.createStepPresenceDescription'),
  }[createStep];

  const selectStep = (next: Exclude<Step, 'selection'>) => {
    setStep(next);
    window.requestAnimationFrame(() =>
      document
        .getElementById(next === 'create' ? 'shop-name' : 'invite-code')
        ?.focus(),
    );
  };

  const handleSelectAddress = (item: AddressSuggestion) => {
    setAddress(item.streetWithNumber || item.fullAddress);
    if (item.city) setCity(item.city);
    if (item.postalCode) setPostalCode(item.postalCode);
    setLat(item.lat);
    setLng(item.lng);
    setIsAddressSelected(true);
    setSuggestions([]);
  };

  async function handleCreateShop(event: React.FormEvent) {
    event.preventDefault();
    const serviceDuration = Number(firstServiceDuration);
    const servicePrice = price === '' ? 15 : Number(price);
    if (!shopName.trim() || !address.trim() || !city.trim()) {
      toast.error(
        'Indique o nome e a localização da sua barbearia para continuar.',
      );
      return;
    }
    if (!firstServiceName.trim() || firstServiceName.trim().length > 100) {
      toast.error(
        locale === 'pt'
          ? 'Indica o nome do primeiro serviço (até 100 caracteres).'
          : 'Enter the first service name (up to 100 characters).',
      );
      return;
    }
    if (
      !Number.isFinite(servicePrice) ||
      servicePrice < 0 ||
      servicePrice > 10000 ||
      !Number.isInteger(serviceDuration) ||
      serviceDuration < 1 ||
      serviceDuration > 1440
    ) {
      toast.error(
        locale === 'pt'
          ? 'Confirma o preço e uma duração entre 1 e 1440 minutos.'
          : 'Check the price and a duration between 1 and 1440 minutes.',
      );
      return;
    }
    const scheduleError = validateWeeklySchedule(
      weeklySchedule,
      locale === 'pt' ? 'pt' : 'en',
    );
    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }
    if (!WEEKDAY_KEYS.some((dayKey) => !weeklySchedule[dayKey].day_off)) {
      toast.error(
        locale === 'pt'
          ? 'Define pelo menos um dia de funcionamento.'
          : 'Set at least one working day.',
      );
      return;
    }

    setLoading(true);
    try {
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      const finalDraftSequence = ++draftSequenceRef.current;
      const draftSaved = await enqueueDraftSave(
        onboardingDraft,
        finalDraftSequence,
      );
      if (!draftSaved) setDraftStatus('error');

      const formattedTags = parsedTags.slice(0, 8);
      const fullAddress = `${address.trim()}${doorNumber.trim() ? ` ${doorNumber.trim()}` : ''}${postalCode.trim() ? `, ${postalCode.trim()}` : ''}`;
      const response = await fetch('/api/onboarding/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shopName.trim(),
          address: fullAddress,
          city: city.trim(),
          weeklySchedule,
          price: servicePrice,
          serviceName: firstServiceName.trim(),
          serviceDuration,
          tags: formattedTags,
          lat,
          lng,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : t('onboarding.unexpectedError'),
        );
      }

      draftCompletedRef.current = true;
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      await fetch('/api/onboarding/draft', { method: 'DELETE' }).catch(() => undefined);

      captureProductEvent('onboarding_shop_created', {
        business_mode: businessMode,
      });
      toast.success('Barbearia criada. Vamos abrir o seu painel.');
      router.push(businessMode === 'team' ? '/dashboard/equipa?tab=invite' : '/dashboard');
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function changeCreateStep(nextStep: OnboardingCreateStep) {
    setCreateStep(nextStep);
    if (draftReady && step === 'create' && !draftCompletedRef.current) {
      const sequence = ++draftSequenceRef.current;
      void enqueueDraftSave(
        { ...onboardingDraft, createStep: nextStep },
        sequence,
      );
    }
    const focusIds: Record<OnboardingCreateStep, string> = {
      1: 'shop-name',
      2: 'address',
      3: 'first-service-name',
      4: 'onboarding-monday-start',
      5: 'tags',
    };
    window.requestAnimationFrame(() => {
      document.getElementById(focusIds[nextStep])?.focus();
    });
  }

  function handleCreateBack() {
    if (createStep > 1) {
      changeCreateStep((createStep - 1) as OnboardingCreateStep);
      return;
    }
    goBack();
  }

  function validateCreateStep(targetStep: OnboardingCreateStep): boolean {
    if (targetStep === 1 && !shopName.trim()) {
      toast.error(t('onboarding.validationShopName'));
      return false;
    }
    if (targetStep === 2 && (!address.trim() || !city.trim())) {
      toast.error(t('onboarding.validationLocation'));
      return false;
    }
    if (targetStep === 3) {
      const serviceDuration = Number(firstServiceDuration);
      const servicePrice = price === '' ? 15 : Number(price);
      if (!firstServiceName.trim() || firstServiceName.trim().length > 100) {
        toast.error(t('onboarding.validationServiceName'));
        return false;
      }
      if (
        !Number.isFinite(servicePrice) ||
        servicePrice < 0 ||
        servicePrice > 10000 ||
        !Number.isInteger(serviceDuration) ||
        serviceDuration < 1 ||
        serviceDuration > 1440
      ) {
        toast.error(t('onboarding.validationPriceDuration'));
        return false;
      }
    }
    if (targetStep === 4) {
      const scheduleError = validateWeeklySchedule(
        weeklySchedule,
        locale === 'pt' ? 'pt' : 'en',
      );
      if (scheduleError) {
        toast.error(scheduleError);
        return false;
      }
      if (!WEEKDAY_KEYS.some((dayKey) => !weeklySchedule[dayKey].day_off)) {
        toast.error(t('onboarding.validationWorkingDay'));
        return false;
      }
    }
    return true;
  }

  function handleCreateWizardSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateCreateStep(createStep)) return;
    if (createStep < ONBOARDING_CREATE_STEP_COUNT) {
      changeCreateStep((createStep + 1) as OnboardingCreateStep);
      return;
    }
    void handleCreateShop(event);
  }

  async function handleJoinShop(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteCode.trim()) {
      toast.error(t('onboarding.inviteRequired'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/onboarding/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: normalizeInviteCode(inviteCode) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : t('onboarding.unexpectedError'),
        );
      }

      captureProductEvent('onboarding_team_joined');
      toast.success(t('onboarding.inviteSuccess'));
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const goBack = () => setStep('selection');

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <StarfieldBackground>
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-6 sm:px-6 sm:py-10">
          <div className="w-full">
            <div className="mb-4 flex items-center justify-between gap-4 px-1 text-xs">
              <div>
                <p className="font-semibold text-zinc-200">
                  {t('onboarding.prepareSpace')}
                </p>
                <p className="mt-0.5 text-zinc-500">
                  {t('onboarding.editLater')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <LanguageSwitcher />
                {step !== 'selection' && (
                  <span className="max-w-40 text-right font-medium text-zinc-400">
                    {progressDescription}
                  </span>
                )}
              </div>
            </div>
            {step === 'create' && draftReady && (
              <p
                className="mb-3 flex items-center gap-2 px-1 text-xs text-zinc-500"
                role="status"
                aria-live="polite"
              >
                {draftStatus === 'saving' ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {locale === 'pt' ? 'A guardar o rascunho…' : 'Saving draft…'}
                  </>
                ) : draftStatus === 'saved' ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                    {locale === 'pt' ? 'Rascunho guardado automaticamente' : 'Draft saved automatically'}
                  </>
                ) : draftStatus === 'error' ? (
                  <>
                    <AlertCircle className="size-3.5 text-amber-400" aria-hidden="true" />
                    {locale === 'pt' ? 'Não foi possível guardar. Vamos tentar novamente ao editar.' : 'Could not save. We will retry when you edit.'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 text-zinc-500" aria-hidden="true" />
                    {locale === 'pt' ? 'Podes continuar mais tarde' : 'You can continue later'}
                  </>
                )}
              </p>
            )}
            {step !== 'selection' && (
              <div
                className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10"
                aria-label={`Progresso: ${progressDescription}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <motion.div
                  className="h-full rounded-full bg-emerald-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            )}

            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/5 backdrop-blur-xl p-5 shadow-2xl shadow-black/30 sm:p-7"
            >
              <AnimatePresence mode="wait">
                {step === 'selection' && (
                  <motion.div
                    key="selection"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-7"
                  >
                    <CardHeader className="p-0">
                      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <Sparkles className="size-6" aria-hidden="true" />
                      </div>
                      <CardTitle className="font-heading text-2xl tracking-tight text-zinc-50 sm:text-3xl">
                        {t('onboarding.startToday')}
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                        Em poucos passos terá um espaço pronto para receber
                        marcações e gerir a sua barbearia.
                      </CardDescription>
                    </CardHeader>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={!draftReady}
                        onClick={() => selectStep('create')}
                        className="group min-h-40 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-50 text-zinc-950">
                            <PlusCircle className="size-5" aria-hidden="true" />
                          </span>
                          <ArrowRight
                            className="size-5 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-200"
                            aria-hidden="true"
                          />
                        </div>
                        <h2 className="mt-5 font-semibold text-zinc-50">
                          {t('onboarding.createMyShop')}
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-zinc-400">
                          {t('onboarding.createMyShopDescription')}
                        </p>
                        <span className="mt-4 inline-flex text-xs font-medium text-emerald-400">
                          {t('onboarding.estimatedTime')}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!draftReady}
                        onClick={() => selectStep('join')}
                        className="group min-h-40 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-300">
                            <UserPlus className="size-5" aria-hidden="true" />
                          </span>
                          <ArrowRight
                            className="size-5 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-200"
                            aria-hidden="true"
                          />
                        </div>
                        <h2 className="mt-5 font-semibold text-zinc-50">
                          {t('onboarding.joinShop')}
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-zinc-400">
                          {t('onboarding.joinShopDescription')}
                        </p>
                        <span className="mt-4 inline-flex text-xs font-medium text-zinc-500">
                          {t('onboarding.quickAccess')}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2
                          className="size-3.5 text-emerald-400"
                          aria-hidden="true"
                        />
                        {t('onboarding.canAdjustLater')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles
                          className="size-3.5 text-zinc-400"
                          aria-hidden="true"
                        />
                        {t('onboarding.presetValues')}
                      </span>
                    </div>
                  </motion.div>
                )}

                {step === 'create' && (
                  <motion.form
                    key="create"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    onSubmit={handleCreateWizardSubmit}
                    className="space-y-6"
                  >
                    <button
                      type="button"
                      onClick={handleCreateBack}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      Voltar
                    </button>
                    <CardHeader className="p-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                        {createStepTitle}
                      </p>
                      <CardTitle className="mt-2 font-heading text-2xl tracking-tight text-zinc-50">
                        {t('onboarding.prepareYourShop')}
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                        {createStepDescription}
                      </CardDescription>
                    </CardHeader>
                    {draftWasRestored && (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2.5 text-xs leading-5 text-zinc-300">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span>
                          {locale === 'pt'
                            ? 'Recuperámos o teu rascunho. Podes continuar exatamente de onde ficaste.'
                            : 'We restored your draft. You can continue exactly where you left off.'}
                        </span>
                      </div>
                    )}


                    {createStep === 1 && (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.035] p-4 sm:p-5">
                          <div className="mb-3">
                            <h2 className="font-semibold text-zinc-100">
                              {t('onboarding.workModeTitle')}
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">
                              {t('onboarding.workModeDescription')}
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              aria-pressed={businessMode === 'solo'}
                              onClick={() => setBusinessMode('solo')}
                              className={'min-h-24 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' + (businessMode === 'solo' ? 'border-emerald-400/40 bg-emerald-400/[.08]' : 'border-white/10 bg-white/[.02] hover:bg-white/[.04]')}
                            >
                              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                                <UserPlus className="size-4 text-emerald-300" aria-hidden="true" />
                                {t('onboarding.soloMode')}
                              </span>
                              <span className="mt-2 block text-xs leading-5 text-zinc-500">
                                {t('onboarding.soloModeDescription')}
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-pressed={businessMode === 'team'}
                              onClick={() => setBusinessMode('team')}
                              className={'min-h-24 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' + (businessMode === 'team' ? 'border-emerald-400/40 bg-emerald-400/[.08]' : 'border-white/10 bg-white/[.02] hover:bg-white/[.04]')}
                            >
                              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                                <Users className="size-4 text-emerald-300" aria-hidden="true" />
                                {t('onboarding.teamMode')}
                              </span>
                              <span className="mt-2 block text-xs leading-5 text-zinc-500">
                                {t('onboarding.teamModeDescription')}
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                          <div className="mb-4 flex items-start gap-3">
                            <Building2 className="mt-0.5 size-5 text-emerald-400" aria-hidden="true" />
                            <div>
                              <h2 className="font-semibold text-zinc-100">
                                {t('onboarding.identity')}
                              </h2>
                              <p className="text-xs text-zinc-500">
                                {t('onboarding.identityDescription')}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="shop-name">{t('onboarding.barbershopName')}</Label>
                            <Input
                              id="shop-name"
                              required
                              maxLength={120}
                              value={shopName}
                              onChange={(event) => setShopName(event.target.value)}
                              placeholder={t('onboarding.shopNamePlaceholder')}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {createStep === 2 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <MapPin className="mt-0.5 size-5 text-emerald-400" aria-hidden="true" />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              {t('onboarding.stepLocationTitle')}
                            </h2>
                            <p className="text-xs text-zinc-500">
                              {t('onboarding.createStepLocationDescription')}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div ref={dropdownRef} className="relative grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor="address">{t('onboarding.shopAddress')}</Label>
                              {isAddressSelected && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                  {t('onboarding.addressConfirmed')}
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                              <Input
                                id="address"
                                required
                                value={address}
                                onChange={(event) => {
                                  setAddress(event.target.value);
                                  setIsAddressSelected(false);
                                  setLat(null);
                                  setLng(null);
                                }}
                                placeholder={t('onboarding.addressPlaceholder')}
                                className={inputClass + ' pl-10 pr-10'}
                              />
                              {searchingAddress && (
                                <Loader2
                                  className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-500"
                                  aria-label={t('onboarding.searchingAddress')}
                                />
                              )}
                            </div>
                            {suggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 p-1 shadow-2xl">
                                <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                  {t('onboarding.chooseAddress')}
                                </div>
                                {suggestions.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectAddress(item)}
                                    className="flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                  >
                                    <span className="w-full truncate text-sm font-medium text-zinc-100">
                                      {item.streetWithNumber || item.fullAddress}
                                    </span>
                                    <span className="w-full truncate text-xs text-zinc-500">
                                      {item.fullAddress}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                            <div className="grid gap-2">
                              <Label htmlFor="city">{t('onboarding.cityTown')}</Label>
                              <Input
                                id="city"
                                required
                                value={city}
                                onChange={(event) => setCity(event.target.value)}
                                placeholder={t('onboarding.cityPlaceholder')}
                                className={inputClass}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="door-number">
                                {t('onboarding.doorNumber')}{' '}
                                <span className="font-normal text-zinc-600">
                                  ({t('onboarding.optional')})
                                </span>
                              </Label>
                              <div className="relative">
                                <Hash className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                                <Input
                                  id="door-number"
                                  value={doorNumber}
                                  onChange={(event) => {
                                    setDoorNumber(event.target.value);
                                    setIsAddressSelected(false);
                                  }}
                                  placeholder="12"
                                  className={inputClass + ' pl-10'}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {createStep === 3 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <PlusCircle className="mt-0.5 size-5 text-emerald-400" aria-hidden="true" />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              {t('onboarding.initialSetup')}
                            </h2>
                            <p className="text-xs text-zinc-500">
                              {t('onboarding.createStepServiceDescription')}
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="first-service-name">
                              {t('onboarding.firstServiceName')}
                            </Label>
                            <Input
                              id="first-service-name"
                              required
                              maxLength={100}
                              value={firstServiceName}
                              onChange={(event) => setFirstServiceName(event.target.value)}
                              placeholder={locale === 'pt' ? 'Ex.: Corte de cabelo' : 'e.g. Haircut'}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label htmlFor="price">{t('onboarding.firstServicePrice')}</Label>
                              <div className="relative">
                                <Euro className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                                <Input
                                  id="price"
                                  type="number"
                                  min="0"
                                  max="10000"
                                  step="0.5"
                                  value={price}
                                  onChange={(event) =>
                                    setPrice(event.target.value === '' ? '' : Number(event.target.value))
                                  }
                                  className={inputClass + ' pl-10'}
                                />
                              </div>
                              <p className="text-[11px] text-zinc-600">
                                {t('onboarding.priceHint')}
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="first-service-duration">
                                {t('onboarding.firstServiceDuration')}
                              </Label>
                              <Input
                                id="first-service-duration"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                max="1440"
                                step="5"
                                required
                                value={firstServiceDuration}
                                onChange={(event) => setFirstServiceDuration(event.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-zinc-500">
                          {locale === 'pt'
                            ? 'Este primeiro serviço fica guardado no catálogo e disponível para receber marcações. Podes acrescentar os restantes depois.'
                            : 'This first service is saved to your catalogue and made available for bookings. You can add the rest later.'}
                        </p>
                      </div>
                    )}

                    {createStep === 4 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <Clock3 className="mt-0.5 size-5 text-blue-400" aria-hidden="true" />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              {t('onboarding.stepHoursTitle')}
                            </h2>
                            <p className="text-xs text-zinc-500">
                              {t('onboarding.createStepHoursDescription')}
                            </p>
                          </div>
                        </div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-500">
                            {locale === 'pt' ? 'Hora local da barbearia' : 'Barbershop local time'}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {locale === 'pt' ? 'Podes alterar mais tarde' : 'You can change this later'}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {WEEKDAY_KEYS.map((dayKey) => {
                            const day = weeklySchedule[dayKey];
                            const interval = day.work_intervals[0] ?? {
                              start: '09:00',
                              end: '19:00',
                            };
                            return (
                              <div
                                key={dayKey}
                                className="grid gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)] sm:items-center"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium text-zinc-200">
                                    {weekdayLabels[dayKey]}
                                  </span>
                                  <label
                                    htmlFor={'onboarding-' + dayKey + '-day-off'}
                                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-zinc-400 hover:bg-white/[0.04]"
                                  >
                                    <input
                                      id={'onboarding-' + dayKey + '-day-off'}
                                      type="checkbox"
                                      checked={day.day_off}
                                      onChange={(event) => updateDayOff(dayKey, event.target.checked)}
                                      className="size-4 rounded border-white/20 bg-zinc-900 accent-emerald-400"
                                    />
                                    {locale === 'pt' ? 'Folga' : 'Closed'}
                                  </label>
                                </div>
                                {day.day_off ? (
                                  <p className="text-xs text-zinc-600 sm:text-right">
                                    {locale === 'pt' ? 'Sem atendimento' : 'Closed all day'}
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                      <Label htmlFor={'onboarding-' + dayKey + '-start'} className="text-[11px] text-zinc-500">
                                        {locale === 'pt' ? 'Abre' : 'Opens'}
                                      </Label>
                                      <Input
                                        id={'onboarding-' + dayKey + '-start'}
                                        type="time"
                                        value={interval.start}
                                        onChange={(event) => updateWorkingTime(dayKey, 'start', event.target.value)}
                                        className={inputClass + ' min-h-10'}
                                      />
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label htmlFor={'onboarding-' + dayKey + '-end'} className="text-[11px] text-zinc-500">
                                        {locale === 'pt' ? 'Fecha' : 'Closes'}
                                      </Label>
                                      <Input
                                        id={'onboarding-' + dayKey + '-end'}
                                        type="time"
                                        value={interval.end}
                                        onChange={(event) => updateWorkingTime(dayKey, 'end', event.target.value)}
                                        className={inputClass + ' min-h-10'}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {createStep === 5 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <Tag className="mt-0.5 size-5 text-amber-400" aria-hidden="true" />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              {t('onboarding.visibility')}
                            </h2>
                            <p className="text-xs text-zinc-500">
                              {t('onboarding.tagsHint')}
                            </p>
                          </div>
                        </div>
                        <Label htmlFor="tags">{t('onboarding.publicTagsLabel')}</Label>
                        <Input
                          id="tags"
                          value={tagsInput}
                          onChange={(event) => setTagsInput(event.target.value)}
                          placeholder={t('onboarding.publicTagsPlaceholder')}
                          className={inputClass + ' mt-2'}
                        />
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {parsedTags.slice(0, 8).map((tag, index) => (
                            <span
                              key={tag + '-' + index}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs leading-5 text-zinc-500">
                          {t('onboarding.publicTagsOptionalHint')}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-zinc-500">
                        {t('onboarding.stepSaveHint')}
                      </p>
                      <Button
                        aria-label={createStep === ONBOARDING_CREATE_STEP_COUNT ? t('onboarding.createMyShop') : t('onboarding.continue')}
                        type="submit"
                        disabled={loading}
                        className="min-h-12 w-full rounded-xl bg-zinc-50 font-semibold text-zinc-950 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400 sm:w-auto sm:min-w-48"
                      >
                        {loading ? (
                          <Spinner className="size-4" />
                        ) : createStep === ONBOARDING_CREATE_STEP_COUNT ? (
                          <>
                            <Sparkles className="mr-2 size-4" aria-hidden="true" />
                            {t('onboarding.createMyShop')}
                          </>
                        ) : (
                          <>
                            {t('onboarding.continue')}
                            <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                          </>
                        )}
                      </Button>
                    </div>

                  </motion.form>
                )}

                {step === 'join' && (
                  <motion.form
                    key="join"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    onSubmit={handleJoinShop}
                    className="space-y-6"
                  >
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      Voltar
                    </button>
                    <CardHeader className="p-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                        {t('onboarding.teamAccess')}
                      </p>
                      <CardTitle className="mt-2 font-heading text-2xl tracking-tight text-zinc-50">
                        {t('onboarding.haveInvite')}
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6 text-zinc-400">
                        {t('onboarding.enterInvite')}
                      </CardDescription>
                    </CardHeader>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <Label htmlFor="invite-code">
                        {t('onboarding.inviteCode')}
                      </Label>
                      <Input
                        id="invite-code"
                        required
                        value={inviteCode}
                        onChange={(event) =>
                          setInviteCode(normalizeInviteCode(event.target.value))
                        }
                        placeholder="BARB-ABCD-EFGH-JKLM"
                        maxLength={46}
                        inputMode="text"
                        autoComplete="one-time-code"
                        className="mt-2 min-h-12 text-center font-mono text-lg tracking-[0.25em]"
                      />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-zinc-500">
                      <span className="font-medium text-zinc-300">
                        {t('onboarding.noInvite')}
                      </span>{' '}
                      {t('onboarding.askOwner')}
                      para gerar um novo convite.
                    </div>
                    <Button
                      aria-label={
                        loading ? 'A validar convite' : 'Continuar com convite'
                      }
                      type="submit"
                      disabled={loading || !inviteCode.trim()}
                      className="min-h-12 w-full rounded-xl bg-zinc-50 font-semibold text-zinc-950 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {loading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <>
                          <UserPlus
                            className="mr-2 size-4"
                            aria-hidden="true"
                          />
                          {t('onboarding.joinTeam')}
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>
      </StarfieldBackground>
    </main>
  );
}
