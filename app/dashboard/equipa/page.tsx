'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { Professional } from '@/types';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import { useProfessionals } from '@/app/state/_hooks/dashboard/useProfessionals';
import { ProfessionalsListCard } from '@/app/dashboard/_components/cards/ProfessionalsListCard';
import { InviteCodeCard } from '@/app/dashboard/_components/team/InviteCodeCard';
import { TeamMembersManager } from '@/app/dashboard/_components/team/TeamMembersManager';
import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { AnimatedTabList } from '@/components/dashboard/animated-tabs';
import { Spinner } from '@/components/ui/spinner';
import { AlertTriangle, Briefcase, KeyRound, RefreshCw, UserPlus, UsersRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type TeamSeatState = { used: number; limit: number; unlimited: boolean };
type TeamTab = 'professionals' | 'members' | 'invite';

export default function EquipaPage() {
  const { t } = useLanguage();
  const teamTabs = [
    {
      value: 'professionals',
      label: t('teamPage.barbers'),
      icon: <Briefcase className="size-4" aria-hidden="true" />,
    },
    {
      value: 'members',
      label: t('teamPage.membersPermissions'),
      icon: <UsersRound className="size-4" aria-hidden="true" />,
    },
    {
      value: 'invite',
      label: t('teamPage.invite'),
      icon: <KeyRound className="size-4" aria-hidden="true" />,
    },
  ] satisfies Array<{ value: TeamTab; label: string; icon: React.ReactNode }>;
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const { plan, loading: isLoadingPlan } = useFeatureAccess();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalsBarbershopId, setProfessionalsBarbershopId] = useState<string | null>(null);
  const [professionalsLoadError, setProfessionalsLoadError] = useState<string | null>(null);
  const [professionalsErrorBarbershopId, setProfessionalsErrorBarbershopId] = useState<string | null>(null);
  const [showAddProfessionalForm, setShowAddProfessionalForm] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const professionalsRequestIdRef = useRef(0);
  const loadedProfessionalsBarbershopIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<TeamTab>('professionals');

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (
      requestedTab === 'professionals' ||
      requestedTab === 'members' ||
      requestedTab === 'invite'
    ) {
      setActiveTab(requestedTab);
    }
  }, []);

  const selectTab = useCallback((nextTab: TeamTab) => {
    setActiveTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === 'professionals') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', nextTab);
    }
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  const [teamSeats, setTeamSeats] = useState<TeamSeatState | null>(null);
  const [teamSeatsBarbershopId, setTeamSeatsBarbershopId] = useState<string | null>(null);
  const [teamSeatsLoadError, setTeamSeatsLoadError] = useState<string | null>(null);
  const [teamSeatsErrorBarbershopId, setTeamSeatsErrorBarbershopId] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const teamSeatsRequestRef = useRef<AbortController | null>(null);
  const lastTeamBarbershopIdRef = useRef<string | null>(null);
  const isFreePlan = plan === 'free';

  const fetchTeamState = useCallback(async () => {
    if (!barbershopId) return;
    teamSeatsRequestRef.current?.abort();
    const controller = new AbortController();
    teamSeatsRequestRef.current = controller;
    setTeamLoading(true);
    setTeamSeatsLoadError(null);
    setTeamSeatsErrorBarbershopId(null);

    try {
      const response = await fetch('/api/team/members', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      const seats = data?.seats as Partial<TeamSeatState> | undefined;
      const used = seats?.used;
      const limit = seats?.limit;
      const unlimited = seats?.unlimited;

      if (
        !response.ok ||
        typeof used !== 'number' ||
        !Number.isSafeInteger(used) ||
        used < 0 ||
        typeof limit !== 'number' ||
        !Number.isSafeInteger(limit) ||
        limit < 0 ||
        typeof unlimited !== 'boolean'
      ) {
        throw new Error(data?.error || t('teamPage.loadStateError'));
      }
      if (controller.signal.aborted) return;

      setTeamSeats({ used, limit, unlimited });
      setTeamSeatsBarbershopId(barbershopId);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[TEAM_STATE_LOAD_FAIL]', error);
      setTeamSeatsLoadError(t('teamPage.loadStateError'));
      setTeamSeatsErrorBarbershopId(barbershopId);
    } finally {
      if (!controller.signal.aborted) setTeamLoading(false);
    }
  }, [barbershopId, t]);

  const fetchProfessionals = useCallback(async () => {
    if (!barbershopId) return;
    const requestId = ++professionalsRequestIdRef.current;
    const isInitialLoad =
      loadedProfessionalsBarbershopIdRef.current !== barbershopId;
    if (isInitialLoad) setLoadingInitial(true);
    setProfessionalsLoadError(null);
    setProfessionalsErrorBarbershopId(null);

    try {
      const res = await professionalService.getAll(barbershopId);
      if (requestId !== professionalsRequestIdRef.current) return;
      if (res.error || !Array.isArray(res.data)) {
        throw res.error ?? new Error(t('teamPage.loadProfilesError'));
      }

      setProfessionals(
        res.data.filter(
          (professional) => professional.active !== false,
        ),
      );
      loadedProfessionalsBarbershopIdRef.current = barbershopId;
      setProfessionalsBarbershopId(barbershopId);
    } catch (error) {
      if (requestId !== professionalsRequestIdRef.current) return;
      console.error('[Equipa Sync Error]:', error);
      setProfessionalsLoadError(t('teamPage.loadProfilesError'));
      setProfessionalsErrorBarbershopId(barbershopId);
    } finally {
      if (
        requestId === professionalsRequestIdRef.current &&
        isInitialLoad
      ) {
        setLoadingInitial(false);
      }
    }
  }, [barbershopId, t]);

  const refreshTeam = useCallback(async () => {
    await Promise.all([fetchProfessionals(), fetchTeamState()]);
  }, [fetchProfessionals, fetchTeamState]);

  const {
    loadingProfessionals,
    newProfessionalName,
    setNewProfessionalName,
    newProfessionalCommission,
    setNewProfessionalCommission,
    editingProfessional,
    setEditingProfessional,
    handleCreateProfessional,
    handleUpdateProfessional,
    handleDeleteProfessional,
  } = useProfessionals(barbershopId, refreshTeam, isFreePlan);

  useEffect(() => {
    if (isLoadingBarbershop) {
      teamSeatsRequestRef.current?.abort();
      professionalsRequestIdRef.current += 1;
      loadedProfessionalsBarbershopIdRef.current = null;
      lastTeamBarbershopIdRef.current = null;
      return;
    }

    if (!barbershopId) {
      teamSeatsRequestRef.current?.abort();
      professionalsRequestIdRef.current += 1;
      loadedProfessionalsBarbershopIdRef.current = null;
      lastTeamBarbershopIdRef.current = null;
      queueMicrotask(() => {
        if (lastTeamBarbershopIdRef.current !== null) return;
        setTeamSeats(null);
        setTeamSeatsBarbershopId(null);
        setTeamSeatsLoadError(null);
        setTeamSeatsErrorBarbershopId(null);
        setTeamLoading(false);
        setProfessionals([]);
        setProfessionalsBarbershopId(null);
        setProfessionalsLoadError(null);
        setProfessionalsErrorBarbershopId(null);
        setLoadingInitial(false);
        setShowAddProfessionalForm(false);
        setEditingProfessional(null);
      });
      return;
    }

    if (lastTeamBarbershopIdRef.current !== barbershopId) {
      lastTeamBarbershopIdRef.current = barbershopId;
      teamSeatsRequestRef.current?.abort();
      professionalsRequestIdRef.current += 1;
      loadedProfessionalsBarbershopIdRef.current = null;
      queueMicrotask(() => {
        if (lastTeamBarbershopIdRef.current !== barbershopId) return;
        setTeamSeats(null);
        setTeamSeatsBarbershopId(null);
        setTeamSeatsLoadError(null);
        setTeamSeatsErrorBarbershopId(null);
        setTeamLoading(true);
        setProfessionals([]);
        setProfessionalsBarbershopId(null);
        setProfessionalsLoadError(null);
        setProfessionalsErrorBarbershopId(null);
        setLoadingInitial(true);
        setShowAddProfessionalForm(false);
        setEditingProfessional(null);
      });
    }

    const timer = window.setTimeout(() => void refreshTeam(), 0);
    return () => {
      window.clearTimeout(timer);
      teamSeatsRequestRef.current?.abort();
      professionalsRequestIdRef.current += 1;
    };
  }, [
    barbershopId,
    isLoadingBarbershop,
    refreshTeam,
    setEditingProfessional,
  ]);

  const currentTeamSeats =
    Boolean(barbershopId) &&
    !isLoadingBarbershop &&
    teamSeatsBarbershopId === barbershopId
      ? teamSeats
      : null;
  const currentTeamSeatsError =
    !isLoadingBarbershop && teamSeatsErrorBarbershopId === barbershopId
      ? teamSeatsLoadError
      : null;
  const hasCurrentProfessionals =
    Boolean(barbershopId) &&
    !isLoadingBarbershop &&
    professionalsBarbershopId === barbershopId;
  const currentProfessionalsError =
    Boolean(barbershopId) &&
    !isLoadingBarbershop &&
    professionalsErrorBarbershopId === barbershopId
      ? professionalsLoadError
      : null;
  const noProfileYet =
    hasCurrentProfessionals && professionals.length === 0;
  const canCreateProfile = Boolean(
    currentTeamSeats &&
      hasCurrentProfessionals &&
      (currentTeamSeats.unlimited ||
        currentTeamSeats.used < currentTeamSeats.limit ||
        noProfileYet),
  );
  const teamLimitReached = Boolean(
    currentTeamSeats &&
      !currentTeamSeats.unlimited &&
      currentTeamSeats.used >= currentTeamSeats.limit,
  );

  if (isLoadingPlan || isLoadingBarbershop) return <main className="min-h-screen bg-zinc-950" aria-busy="true" />;

  return (
    <main className="min-h-screen bg-zinc-950 p-4 pt-16 text-zinc-100 sm:p-6 sm:pt-16 lg:p-8 lg:pt-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          icon={Briefcase}
          eyebrow={t('teamPage.eyebrow')}
          title={t('teamPage.title')}
          description={t('teamPage.teamDescription')}
          accentClassName="border-purple-500/20 bg-purple-500/10 text-purple-400"
          actions={
            teamLimitReached ? (
              <Button asChild className="min-h-11">
                <Link href="/plans">{t('teamPage.upgradeTeam')}</Link>
              </Button>
            ) : undefined
          }
        />

        {currentTeamSeatsError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">{currentTeamSeatsError}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {currentTeamSeats
                  ? t('teamPage.previousSeatsHint')
                  : t('teamPage.seatsUnavailableHint')}
              </p>
            </div>
            <Button variant="outline" onClick={() => void fetchTeamState()} disabled={teamLoading} className="shrink-0">
              <RefreshCw className={`mr-2 size-4 ${teamLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        )}

        {currentProfessionalsError && hasCurrentProfessionals && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100">{currentProfessionalsError}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('teamPage.previousProfilesHint')}
              </p>
            </div>
            <Button variant="outline" onClick={() => void fetchProfessionals()} className="shrink-0">
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t('teamPage.teamSeats')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {currentTeamSeats
                ? currentTeamSeats.unlimited
                  ? `${currentTeamSeats.used} / ∞`
                  : `${currentTeamSeats.used} / ${currentTeamSeats.limit}`
                : '—'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t('teamPage.seatDescription')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t('teamPage.barberProfiles')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {hasCurrentProfessionals ? professionals.length : '—'}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t('teamPage.activeProfilesHint')}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t('teamPage.plan')}
            </p>
            <p className="mt-2 text-2xl font-semibold capitalize text-white">
              {plan}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Define o limite de lugares de equipa e perfis de barbeiro.
            </p>
          </div>
        </section>

        <AnimatedTabList
          tabs={teamTabs}
          value={activeTab}
          onValueChange={selectTab}
          ariaLabel={t('teamPage.sections')}
          layoutId="team-tab-indicator"
          className="grid grid-cols-3 overflow-visible"
          tabClassName="flex min-w-0 items-center justify-center"
        />

        {activeTab === 'invite' && currentTeamSeats && (
          <InviteCodeCard seats={currentTeamSeats} />
        )}
        {activeTab === 'invite' && !currentTeamSeats && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] px-5 py-10 text-center">
            {teamLoading ? (
              <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                {t('teamPage.loadingSeats')}
              </div>
            ) : (
              <div role="alert" className="flex flex-col items-center gap-2">
                <AlertTriangle className="size-6 text-amber-200" aria-hidden="true" />
                <p className="max-w-lg text-sm text-muted-foreground">
                  {currentTeamSeatsError || t('teamPage.seatsUnavailableHint')}
                </p>
              </div>
            )}
            <Button variant="outline" onClick={() => void fetchTeamState()} disabled={teamLoading}>
              <RefreshCw className={`mr-2 size-4 ${teamLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('common.retry')}
            </Button>
          </div>
        )}
        {activeTab === 'members' && (
          <TeamMembersManager onMembershipChanged={refreshTeam} />
        )}

        {activeTab === 'professionals' && (
          <>
            {teamLimitReached && !noProfileYet && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <UserPlus className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {t('teamPage.teamLimitReached')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {t('teamPage.limitReachedDescription')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {loadingInitial || (!hasCurrentProfessionals && !currentProfessionalsError) ? (
              <div
                role="status"
                aria-label={t('teamPage.loadingProfiles')}
                className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
              >
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : !hasCurrentProfessionals && currentProfessionalsError ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] px-5 py-12 text-center">
                <div role="alert" className="flex flex-col items-center gap-2">
                  <AlertTriangle className="size-7 text-amber-200" aria-hidden="true" />
                  <p className="max-w-lg text-sm text-muted-foreground">{currentProfessionalsError}</p>
                </div>
                <Button variant="outline" onClick={() => void fetchProfessionals()}>
                  <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                  {t('common.retry')}
                </Button>
              </div>
            ) : hasCurrentProfessionals ? (
              <ProfessionalsListCard
                professionalsCount={professionals.length}
                professionals={professionals}
                showAddProfessionalForm={showAddProfessionalForm}
                setShowAddProfessionalForm={setShowAddProfessionalForm}
                newProfessionalData={{
                  name: newProfessionalName,
                  commission_percentage: isFreePlan
                    ? 100
                    : newProfessionalCommission,
                }}
                setNewProfessionalData={(value) => {
                  const nextValue =
                    typeof value === 'function'
                      ? value({
                          name: newProfessionalName,
                          commission_percentage: newProfessionalCommission,
                        })
                      : value;
                  setNewProfessionalName(nextValue.name);
                  setNewProfessionalCommission(
                    isFreePlan ? 100 : (nextValue.commission_percentage ?? 0),
                  );
                }}
                handleCreateProfessional={handleCreateProfessional}
                setEditingProfessional={setEditingProfessional}
                handleDeleteProfessional={handleDeleteProfessional}
                loading={loadingProfessionals}
                isFreePlan={isFreePlan}
                freeLimitReached={!canCreateProfile}
              />
            ) : null}
            <Dialog
              open={!!editingProfessional && hasCurrentProfessionals}
              onOpenChange={(open) => !open && setEditingProfessional(null)}
            >
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t('teamPage.editBarber')}</DialogTitle>
                </DialogHeader>
                {editingProfessional && hasCurrentProfessionals && (
                  <form
                    onSubmit={handleUpdateProfessional}
                    className="grid gap-4 py-4"
                  >
                    <div className="grid gap-2">
                      <label
                        htmlFor="edit-professional-name"
                        className="text-xs text-zinc-400"
                      >
                        {t('teamPage.name')}
                      </label>
                      <input
                        id="edit-professional-name"
                        required
                        className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-purple-500/50"
                        value={editingProfessional.name}
                        onChange={(e) =>
                          setEditingProfessional({
                            ...editingProfessional,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <label
                        htmlFor="edit-professional-commission"
                        className="text-xs text-zinc-400"
                      >
                        {t('teamPage.commission')}
                      </label>
                      <input
                        id="edit-professional-commission"
                        required
                        type="number"
                        min="0"
                        max="100"
                        readOnly={isFreePlan}
                        className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-purple-500/50 disabled:opacity-60"
                        value={
                          isFreePlan
                            ? 100
                            : (editingProfessional.commission_percentage ?? 0)
                        }
                        onChange={(e) =>
                          !isFreePlan &&
                          setEditingProfessional({
                            ...editingProfessional,
                            commission_percentage: Number(e.target.value),
                          })
                        }
                      />
                      {isFreePlan && (
                        <p className="text-xs text-zinc-500">
                          {t('teamPage.freeCommissionHint')}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        aria-label={
                          loadingProfessionals
                            ? 'A guardar profissional'
                            : 'Guardar profissional'
                        }
                        type="submit"
                        disabled={loadingProfessionals}
                        className="min-h-11 w-full bg-purple-600 text-white hover:bg-purple-500"
                      >
                        {loadingProfessionals ? (
                          <Spinner className="size-4" />
                        ) : (
                          t('teamPage.saveChanges')
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </main>
  );
}
