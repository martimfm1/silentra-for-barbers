'use client';

import Link from 'next/link';

import { type ProfessionalsListCardProps } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Users,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/dashboard/EmptyState';

type EquipaCardProps = ProfessionalsListCardProps & {
  isFreePlan: boolean;
  freeLimitReached: boolean;
};

const shell =
  'overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-xl';
const item =
  'rounded-xl border border-white/10 bg-white/[0.025] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.045]';
const iconButton =
  'size-9 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white';

export function ProfessionalsListCard({
  professionalsCount,
  professionals,
  showAddProfessionalForm,
  setShowAddProfessionalForm,
  newProfessionalData,
  setNewProfessionalData,
  handleCreateProfessional,
  setEditingProfessional,
  handleDeleteProfessional,
  loading,
  isFreePlan,
  freeLimitReached,
}: EquipaCardProps) {
  const { t } = useLanguage();
  const canAddProfessional = !freeLimitReached;
  return (
    <Card className={shell}>
      <CardHeader className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold text-zinc-50">
                {t('professionalsListCard.title')}
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {professionalsCount === 0
                  ? t('professionalsListCard.addFirstHint')
                  : `${professionalsCount} ${professionalsCount === 1 ? t('professionalsListCard.barberSingular') : t('professionalsListCard.barberPlural')} ${t('professionalsListCard.teamSuffix')}`}
              </p>
            </div>
          </div>
          <Button
            disabled={!canAddProfessional}
            onClick={() => setShowAddProfessionalForm(!showAddProfessionalForm)}
            className="min-h-11 w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 sm:w-auto"
          >
            {freeLimitReached ? (
              <Lock className="mr-2 size-4" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            {freeLimitReached
              ? t('professionalsListCard.limitReached')
              : showAddProfessionalForm
                ? t('professionalsListCard.close')
                : t('professionalsListCard.addBarber')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        {showAddProfessionalForm && canAddProfessional && (
          <form
            onSubmit={handleCreateProfessional}
            className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/[0.05] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-purple-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {t('professionalsListCard.formIntro')}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {t('professionalsListCard.freePlanHint')} 100%.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
              <div className="grid gap-1.5">
                <label
                  htmlFor="new-professional-name"
                  className="text-xs font-medium text-zinc-400"
                >
                  {t('professionalsListCard.name')}
                </label>
                <input
                  id="new-professional-name"
                  required
                  autoFocus
                  placeholder={t('professionalsListCard.namePlaceholder')}
                  className="min-h-11 rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none focus:border-purple-500/50"
                  value={newProfessionalData.name}
                  onChange={(e) =>
                    setNewProfessionalData({
                      ...newProfessionalData,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <label
                  htmlFor="new-professional-commission"
                  className="text-xs font-medium text-zinc-400"
                >
                  {t('professionalsListCard.commission')}
                </label>
                {isFreePlan ? (
                  <div
                    id="new-professional-commission"
                    className="flex min-h-11 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-purple-300"
                  >
                    100%{' '}
                    <span className="ml-2 text-xs font-normal text-zinc-600">
                      {t('professionalsListCard.fixed')}
                    </span>
                  </div>
                ) : (
                  <input
                    id="new-professional-commission"
                    required
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    className="min-h-11 rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none focus:border-purple-500/50"
                    value={newProfessionalData.commission_percentage}
                    onChange={(e) =>
                      setNewProfessionalData({
                        ...newProfessionalData,
                        commission_percentage: Number(e.target.value),
                      })
                    }
                  />
                )}
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="min-h-11 bg-purple-600 text-white hover:bg-purple-500"
              >
                {loading ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    {t('professionalsListCard.add')} <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
        {freeLimitReached && (
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                {t('professionalsListCard.freeBarberConfigured')}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {t('professionalsListCard.upgradeHint')}
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="shrink-0 border-white/10 rounded-lg"
            >
              <Link href="/plans">{t('professionalsListCard.viewPlans')}</Link>
            </Button>
          </div>
        )}
        {professionals.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            tone="violet"
            title={t('professionalsListCard.emptyTitle')}
            description={t('professionalsListCard.emptyDescription')}
            actionLabel={t('professionalsListCard.addFirst')}
            onAction={() => setShowAddProfessionalForm(true)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.map((professional) => (
              <article
                key={professional.id}
                className={`${item} flex min-h-[150px] flex-col justify-between p-4`}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-purple-500/10 text-sm font-semibold text-purple-300">
                      {professional.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-zinc-100">
                        {professional.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">{t('professionalsListCard.barber')}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-600">
                      {t('professionalsListCard.commission')}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-purple-300">
                      {professional.commission_percentage ?? 100}%
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-1 border-t border-white/5 pt-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingProfessional(professional)}
                    className={iconButton}
                    aria-label={t('professionalsListCard.edit', { name: professional.name })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`${iconButton} text-zinc-500 hover:bg-red-500/10 hover:text-red-400`}
                        aria-label={t('professionalsListCard.delete', { name: professional.name })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-zinc-950">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('professionalsListCard.deleteTitle')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('professionalsListCard.deleteDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 bg-transparent text-white">
                          {t('professionalsListCard.keep')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 text-white"
                          onClick={() =>
                            handleDeleteProfessional(professional.id)
                          }
                        >
                          {t('professionalsListCard.deleteAction')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
