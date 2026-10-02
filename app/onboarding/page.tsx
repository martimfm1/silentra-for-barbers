'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
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
} from 'lucide-react';
import { StarfieldBackground } from '@/components/ui/starfield';
import { Button } from '@/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

type Step = 'selection' | 'create' | 'join';

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
  if (cleaned.startsWith('BARB')) {
    const body = cleaned.slice(4, 12);
    return body.length
      ? `BARB-${body.slice(0, 4)}${body.length > 4 ? `-${body.slice(4)}` : ''}`
      : 'BARB-';
  }
  if (/^[A-Z0-9]{1,8}$/.test(cleaned)) {
    return cleaned.length > 4
      ? `BARB-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`
      : cleaned;
  }
  return cleaned.slice(0, 14);
}

const inputClass =
  'min-h-11 rounded-xl border-white/10 bg-white/[0.04] text-sm text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('selection');
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [price, setPrice] = useState<number | ''>(15);
  const [tagsInput, setTagsInput] = useState('Corte, Barba');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const createProgress = useMemo(() => {
    const requiredFields = [
      shopName.trim(),
      address.trim(),
      city.trim(),
      price === '' ? '' : String(price),
    ];
    const completed = requiredFields.filter(Boolean).length;
    return 35 + Math.round((completed / requiredFields.length) * 55);
  }, [shopName, address, city, price]);

  const progress =
    step === 'selection'
      ? 20
      : step === 'join'
        ? inviteCode
          ? 90
          : 45
        : createProgress;

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
    if (!shopName.trim() || !address.trim() || !city.trim() || price === '') {
      toast.error('Preencha os dados essenciais para criar a sua barbearia.');
      return;
    }

    setLoading(true);
    try {
      const formattedTags = parsedTags.slice(0, 8);
      const fullAddress = `${address.trim()}${doorNumber.trim() ? ` ${doorNumber.trim()}` : ''}${postalCode.trim() ? `, ${postalCode.trim()}` : ''}`;
      const response = await fetch('/api/onboarding/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: shopName.trim(),
          address: fullAddress,
          city: city.trim(),
          hours: `${openTime} - ${closeTime}`,
          price: Number(price) || 0,
          tags: formattedTags,
          lat: lat ?? 0,
          lng: lng ?? 0,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível criar a barbearia.');

      toast.success('Barbearia criada. Vamos abrir o seu painel.');
      router.push('/dashboard');
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinShop(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteCode.trim()) {
      toast.error('Introduza o código de convite.');
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
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível validar o convite.');

      toast.success('Convite aceite. Bem-vindo à equipa.');
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
                  Vamos preparar o seu espaço
                </p>
                <p className="mt-0.5 text-zinc-500">
                  Pode alterar estes dados mais tarde nas Definições.
                </p>
              </div>
              <span className="shrink-0 font-medium tabular-nums text-zinc-400">
                {progress}%
              </span>
            </div>
            <div
              className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10"
              aria-label={`Progresso do onboarding: ${progress}%`}
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
                        Comece pelo que precisa hoje.
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                        Em poucos passos terá um espaço pronto para receber
                        marcações e gerir a sua barbearia.
                      </CardDescription>
                    </CardHeader>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
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
                          Criar a minha barbearia
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-zinc-400">
                          Recomendado se vai gerir o espaço e definir os
                          primeiros serviços.
                        </p>
                        <span className="mt-4 inline-flex text-xs font-medium text-emerald-400">
                          Cerca de 2 minutos
                        </span>
                      </button>

                      <button
                        type="button"
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
                          Entrar numa barbearia
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-zinc-400">
                          Use o código de convite que recebeu do proprietário ou
                          administrador.
                        </p>
                        <span className="mt-4 inline-flex text-xs font-medium text-zinc-500">
                          Acesso rápido
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2
                          className="size-3.5 text-emerald-400"
                          aria-hidden="true"
                        />
                        Pode ajustar tudo depois
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles
                          className="size-3.5 text-zinc-400"
                          aria-hidden="true"
                        />
                        Começa com valores predefinidos
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
                    onSubmit={handleCreateShop}
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
                        Passo 2 de 2
                      </p>
                      <CardTitle className="mt-2 font-heading text-2xl tracking-tight text-zinc-50">
                        Vamos preparar a sua barbearia
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                        Preencha apenas o essencial. Os restantes detalhes podem
                        ser ajustados no painel depois.
                      </CardDescription>
                    </CardHeader>

                    <div className="space-y-5">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <Building2
                            className="mt-0.5 size-5 text-emerald-400"
                            aria-hidden="true"
                          />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              Identidade
                            </h2>
                            <p className="text-xs text-zinc-500">
                              Como a sua barbearia será apresentada.
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="shop-name">Nome da barbearia</Label>
                            <Input
                              id="shop-name"
                              required
                              value={shopName}
                              onChange={(event) =>
                                setShopName(event.target.value)
                              }
                              placeholder="Ex.: Barbearia Central"
                              className={inputClass}
                            />
                          </div>
                          <div
                            ref={dropdownRef}
                            className="relative grid gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor="address">Morada</Label>
                              {isAddressSelected && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                  <CheckCircle2
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Confirmada
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <MapPin
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                                aria-hidden="true"
                              />
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
                                placeholder="Ex.: Rua Garrett"
                                className={`${inputClass} pl-10 pr-10`}
                              />
                              {searchingAddress && (
                                <Loader2
                                  className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-500"
                                  aria-label="A pesquisar morada"
                                />
                              )}
                            </div>
                            {suggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 p-1 shadow-2xl">
                                <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                                  Escolha uma morada
                                </div>
                                {suggestions.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectAddress(item)}
                                    className="flex min-h-11 w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                  >
                                    <span className="w-full truncate text-sm font-medium text-zinc-100">
                                      {item.streetWithNumber ||
                                        item.fullAddress}
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
                              <Label htmlFor="city">Cidade / vila</Label>
                              <Input
                                id="city"
                                required
                                value={city}
                                onChange={(event) =>
                                  setCity(event.target.value)
                                }
                                placeholder="Ex.: Lisboa"
                                className={inputClass}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="door-number">
                                N.º da porta{' '}
                                <span className="font-normal text-zinc-600">
                                  (opcional)
                                </span>
                              </Label>
                              <div className="relative">
                                <Hash
                                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                                  aria-hidden="true"
                                />
                                <Input
                                  id="door-number"
                                  value={doorNumber}
                                  onChange={(event) => {
                                    setDoorNumber(event.target.value);
                                    setIsAddressSelected(false);
                                  }}
                                  placeholder="12"
                                  className={`${inputClass} pl-10`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-6 flex items-start gap-3">
                          <Clock3
                            className="mt-0.5 size-5 text-blue-400"
                            aria-hidden="true"
                          />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              Configuração inicial
                            </h2>
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="grid gap-2">
                            <Label htmlFor="price">Preço de referência</Label>
                            <div className="relative">
                              <Euro
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                                aria-hidden="true"
                              />
                              <Input
                                id="price"
                                type="number"
                                min="0"
                                step="0.5"
                                required
                                value={price}
                                onChange={(event) =>
                                  setPrice(
                                    event.target.value === ''
                                      ? ''
                                      : Number(event.target.value),
                                  )
                                }
                                className={`${inputClass} pl-10`}
                              />
                            </div>
                            <p className="text-[11px] text-zinc-600">
                              Este valor é apenas uma referência para os
                              clientes.
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="open-time">Abertura</Label>
                            <div className="relative">
                              <Clock3
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                                aria-hidden="true"
                              />
                              <Input
                                id="open-time"
                                type="time"
                                required
                                value={openTime}
                                onChange={(event) =>
                                  setOpenTime(event.target.value)
                                }
                                className={`${inputClass} pl-10`}
                              />
                            </div>
                            <p className="text-[11px] text-zinc-600">
                              Este é o horário de abertura da sua barbearia.
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="close-time">Fecho</Label>
                            <div className="relative">
                              <Clock3
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                                aria-hidden="true"
                              />
                              <Input
                                id="close-time"
                                type="time"
                                required
                                value={closeTime}
                                onChange={(event) =>
                                  setCloseTime(event.target.value)
                                }
                                className={`${inputClass} pl-10`}
                              />
                            </div>
                            <p className="text-[11px] text-zinc-600">
                              Este é o horário de fecho da sua barbearia.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                        <div className="mb-4 flex items-start gap-3">
                          <Tag
                            className="mt-0.5 size-5 text-amber-400"
                            aria-hidden="true"
                          />
                          <div>
                            <h2 className="font-semibold text-zinc-100">
                              Visibilidade
                            </h2>
                            <p className="text-xs text-zinc-500">
                              Escolha alguns termos para ajudar a apresentar a
                              sua barbearia.
                            </p>
                          </div>
                        </div>
                        <Label htmlFor="tags">Serviços / características</Label>
                        <Input
                          id="tags"
                          required
                          value={tagsInput}
                          onChange={(event) => setTagsInput(event.target.value)}
                          placeholder="Corte, Barba, Toalha quente"
                          className={`${inputClass} mt-2`}
                        />
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {parsedTags.slice(0, 8).map((tag, index) => (
                            <span
                              key={`${tag}-${index}`}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 text-sm text-zinc-300">
                      <p className="font-medium text-zinc-100">Quase pronto.</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Depois de criar a barbearia, pode adicionar serviços,
                        equipa, horários e outras definições no painel.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading || createProgress < 90}
                      className="min-h-12 w-full rounded-xl bg-zinc-50 font-semibold text-zinc-950 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {loading ? (
                        <Spinner className="size-4" />
                      ) : (
                        <>
                          <Sparkles
                            className="mr-2 size-4"
                            aria-hidden="true"
                          />
                          Criar a minha barbearia
                        </>
                      )}
                    </Button>
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
                        Acesso à equipa
                      </p>
                      <CardTitle className="mt-2 font-heading text-2xl tracking-tight text-zinc-50">
                        Já tem um convite?
                      </CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6 text-zinc-400">
                        Introduza o código de convite que recebeu
                      </CardDescription>
                    </CardHeader>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <Label htmlFor="invite-code">Código de convite</Label>
                      <Input
                        id="invite-code"
                        required
                        value={inviteCode}
                        onChange={(event) =>
                          setInviteCode(normalizeInviteCode(event.target.value))
                        }
                        placeholder="BARB-7K4P-9X2M"
                        maxLength={14}
                        inputMode="text"
                        autoComplete="one-time-code"
                        className="mt-2 min-h-12 text-center font-mono text-lg tracking-[0.25em]"
                      />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-zinc-500">
                      <span className="font-medium text-zinc-300">
                        Não tem um código?
                      </span>{' '}
                      Peça ao proprietário ou administrador da sua barbearia
                      para gerar um novo convite.
                    </div>
                    <Button
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
                          Entrar na equipa
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
