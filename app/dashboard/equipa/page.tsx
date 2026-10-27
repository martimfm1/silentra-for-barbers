'use client';

import { useState, useCallback, useEffect } from 'react';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Professional } from '@/types';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import { useProfessionals } from '@/app/state/_hooks/dashboard/useProfessionals';
import { ProfessionalsListCard } from '@/app/dashboard/_components/cards/ProfessionalsListCard';
import { InviteCodeCard } from '@/app/dashboard/_components/team/InviteCodeCard';
import { TeamMembersManager } from '@/app/dashboard/_components/team/TeamMembersManager';
import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { AnimatedTabList } from '@/components/dashboard/animated-tabs';
import { Spinner } from '@/components/ui/spinner';
import { Briefcase, UsersRound, KeyRound, UserPlus } from 'lucide-react';
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
    { value: 'professionals', label: t('teamPage.barbers'), icon: <Briefcase className="size-4" aria-hidden="true" /> },
    { value: 'members', label: t('teamPage.membersPermissions'), icon: <UsersRound className="size-4" aria-hidden="true" /> },
    { value: 'invite', label: t('teamPage.invite'), icon: <KeyRound className="size-4" aria-hidden="true" /> },
  ] satisfies Array<{ value: TeamTab; label: string; icon: React.ReactNode }>;
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const { plan, loading: isLoadingPlan } = useFeatureAccess();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [showAddProfessionalForm, setShowAddProfessionalForm] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [activeTab, setActiveTab] = useState<TeamTab>('professionals');
  const [teamSeats, setTeamSeats] = useState<TeamSeatState>({
    used: 0,
    limit: 1,
    unlimited: false,
  });
  const [teamLoading, setTeamLoading] = useState(true);
  const isFreePlan = plan === 'free';

  const fetchTeamState = useCallback(async () => {
    if (!barbershopId) return;
    setTeamLoading(true);
    try {
      const response = await fetch('/api/team/members', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || t('teamPage.loadStateError'),
        );
      setTeamSeats(data.seats ?? { used: 0, limit: 1, unlimited: false });
    } catch (error) {
      console.error('[TEAM_STATE_LOAD_FAIL]', error);
    } finally {
      setTeamLoading(false);
    }
  }, [barbershopId]);

  const fetchProfessionals = useCallback(async () => {
    if (!barbershopId) return;
    setLoadingInitial(true);
    try {
      const res = await professionalService.getAll(barbershopId);
      if (res.error) throw res.error;
      setProfessionals(
        (res.data ?? []).filter(
          (professional) => professional.active !== false,
        ),
      );
    } catch (error) {
      console.error('[Equipa Sync Error]:', error);
      toast.error(
        t('teamPage.loadProfilesError'),
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [barbershopId]);

  const refreshTeam = useCallback(async () => {
    await Promise.all([fetchProfessionals(), fetchTeamState()]);
  }, [fetchProfessionals, fetchTeamState]);

  useEffect(() => {
    if (!isLoadingBarbershop && barbershopId)
      queueMicrotask(() => void refreshTeam());
  }, [barbershopId, isLoadingBarbershop, refreshTeam]);

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

  const noProfileYet = professionals.length === 0;
  const canCreateProfile =
    teamSeats.unlimited || teamSeats.used < teamSeats.limit || noProfileYet;
  const teamLimitReached =
    !teamSeats.unlimited && teamSeats.used >= teamSeats.limit;

  if (isLoadingPlan) return <main className="min-h-screen bg-zinc-950" />;

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

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {t('teamPage.teamSeats')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {teamLoading
                ? '—'
                : teamSeats.unlimited
                  ? `${teamSeats.used} / ∞`
                  : `${teamSeats.used} / ${teamSeats.limit}`}
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
              {professionals.length}
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
          onValueChange={setActiveTab}
          ariaLabel={t('teamPage.sections')}
          layoutId="team-tab-indicator"
          className="grid grid-cols-3 overflow-visible"
          tabClassName="flex min-w-0 items-center justify-center"
        />

        {activeTab === 'invite' && <InviteCodeCard seats={teamSeats} />}
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
                      Para adicionar mais pessoas ou perfis, aumenta o plano.
                      Uma pessoa convidada conta sempre para o limite, mesmo que
                      não seja barbeiro.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {loadingInitial ? (
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
            ) : (
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
            )}
            <Dialog
              open={!!editingProfessional}
              onOpenChange={(open) => !open && setEditingProfessional(null)}
            >
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t('teamPage.editBarber')}</DialogTitle>
                </DialogHeader>
                {editingProfessional && (
                  <form
                    onSubmit={handleUpdateProfessional}
                    className="grid gap-4 py-4"
                  >
                    <div className="grid gap-2">
                      <label
                        htmlFor="edit-professional-name"
                        className="text-xs text-zinc-400"
                      >
                        Nome
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
                        Comissão (%)
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
