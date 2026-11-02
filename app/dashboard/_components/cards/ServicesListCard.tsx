'use client';

import { useMemo, useState } from 'react';
import { Service, ServicesListCardProps } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import {
  Scissors,
  Plus,
  Clock3,
  Pencil,
  Trash2,
  Euro,
  Sparkles,
  ArrowRight,
  Search,
  Copy,
  Power,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/dashboard/EmptyState';
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

export function ServicesListCard({
  servicesCount,
  services,
  showAddServiceForm,
  setShowAddServiceForm,
  newServiceData,
  setNewServiceData,
  handleCreateService,
  setEditingService,
  handleDeleteService,
  handleToggleServiceActive,
  loading,
}: ServicesListCardProps) {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'duration'>('name');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale === 'pt' ? 'pt-PT' : 'en-GB');
    return [...services]
      .filter((service) => service.name.toLocaleLowerCase(locale === 'pt' ? 'pt-PT' : 'en-GB').includes(query))
      .filter((service) => statusFilter === 'all' || (statusFilter === 'active' ? service.is_active !== false : service.is_active === false))
      .sort((a, b) => sortBy === 'name'
        ? a.name.localeCompare(b.name, locale === 'pt' ? 'pt-PT' : 'en-GB')
        : sortBy === 'price'
          ? Number(a.price) - Number(b.price)
          : Number(a.duration ?? (a as any).min_duration ?? 0) - Number(b.duration ?? (b as any).min_duration ?? 0));
  }, [services, search, sortBy, locale, statusFilter]);
  const activeServices = services.filter((service) => service.is_active !== false);
  const averagePrice = activeServices.length
    ? activeServices.reduce((total, service) => total + Number(service.price || 0), 0) / activeServices.length
    : null;
  const averageDuration = activeServices.length
    ? Math.round(activeServices.reduce((total, service) => total + Number(service.duration ?? service.min_duration ?? 0), 0) / activeServices.length)
    : null;
  const duplicateService = (service: Service) => {
    setStatusFilter('all');
    setNewServiceData({
      name: `${service.name} (${locale === 'pt' ? 'cópia' : 'copy'})`,
      price: Number(service.price),
      duration: Number(service.duration ?? (service as any).min_duration ?? 30),
    });
    setShowAddServiceForm(true);
  };
  return (
    <Card className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-xl">
      <CardHeader className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Scissors className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold text-zinc-50">
                {t('servicesListCard.title')}
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {servicesCount === 0
                  ? t('servicesListCard.emptyDescription')
                  : `${servicesCount} ${servicesCount === 1 ? t('servicesListCard.configuredSingular') : t('servicesListCard.configuredPlural')}.`}
              </p>              {servicesCount > 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {activeServices.length} {locale === 'pt' ? 'ativos' : 'active'} · {locale === 'pt' ? 'média' : 'avg.'} {averagePrice === null ? '—' : new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(averagePrice)} · {averageDuration === null ? '—' : `${averageDuration} min`}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            onClick={() => setShowAddServiceForm(true)}
            className="min-h-11 w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 sm:w-auto"
          >
            <Plus className="mr-2 size-4" />
            {t('servicesListCard.addService')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <Dialog open={showAddServiceForm} onOpenChange={setShowAddServiceForm}>
          <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('servicesListCard.addDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('servicesListCard.addDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <AddServiceForm
              newServiceData={newServiceData}
              setNewServiceData={setNewServiceData}
              handleCreateService={handleCreateService}
              setShowAddServiceForm={setShowAddServiceForm}
              loading={loading}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddServiceForm(false)}
                className="border-white/10 bg-transparent"
              >
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title={t('servicesListCard.noServicesTitle')}
            description={t('servicesListCard.noServicesDescription')}
            actionLabel={t('servicesListCard.addFirst')}
            onAction={() => setShowAddServiceForm(true)}
            tone="amber"
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === 'pt' ? 'Pesquisar serviços…' : 'Search services…'} aria-label={locale === 'pt' ? 'Pesquisar serviços' : 'Search services'} className="min-h-11 bg-zinc-950/70 pl-9" />
              </div>
              <select aria-label={locale === 'pt' ? 'Filtrar estado dos serviços' : 'Filter service status'} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-11 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200">
                <option value="all">{locale === 'pt' ? 'Todos os estados' : 'All statuses'}</option>
                <option value="active">{locale === 'pt' ? 'Ativos' : 'Active'}</option>
                <option value="inactive">{locale === 'pt' ? 'Inativos' : 'Inactive'}</option>
              </select>
              <select aria-label={locale === 'pt' ? 'Ordenar serviços' : 'Sort services'} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="min-h-11 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-200">
                <option value="name">{locale === 'pt' ? 'Nome' : 'Name'}</option>
                <option value="price">{locale === 'pt' ? 'Preço' : 'Price'}</option>
                <option value="duration">{locale === 'pt' ? 'Duração' : 'Duration'}</option>
              </select>
            </div>
            {filteredServices.length === 0 ? (
              <p className="rounded-xl border border-white/10 p-6 text-center text-sm text-zinc-500">{locale === 'pt' ? 'Não foram encontrados serviços.' : 'No services found.'}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
              <ServiceItemCard
                key={service.id}
                service={service}
                setEditingService={setEditingService}
                handleDeleteService={handleDeleteService}
                handleToggleServiceActive={handleToggleServiceActive}
                loading={loading}
                onDuplicate={duplicateService}
              />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- SUB-COMPONENTES PARA ORGANIZAÇÃO DA ESTRUTURA ---

interface AddServiceFormProps {
  newServiceData: ServicesListCardProps['newServiceData'];
  setNewServiceData: ServicesListCardProps['setNewServiceData'];
  handleCreateService: ServicesListCardProps['handleCreateService'];
  setShowAddServiceForm: ServicesListCardProps['setShowAddServiceForm'];
  loading: boolean;
}

function AddServiceForm({
  newServiceData,
  setNewServiceData,
  handleCreateService,
  setShowAddServiceForm,
  loading,
}: AddServiceFormProps) {
  const { t } = useLanguage();
  async function submit(event: React.FormEvent) {
    const created = await handleCreateService(event);
    if (created) setShowAddServiceForm(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 py-2">
      <div className="mb-4 flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {t('servicesListCard.formIntro')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label
            htmlFor="new-service-name"
            className="text-xs font-medium text-zinc-400"
          >
            Nome
          </label>
          <Input
            id="new-service-name"
            required
            disabled={loading}
            autoFocus
            placeholder={t('servicesListCard.namePlaceholder')}
            className="min-h-11 bg-zinc-950/70"
            value={newServiceData.name}
            onChange={(e) =>
              setNewServiceData({
                ...newServiceData,
                name: e.target.value,
              })
            }
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="new-service-price"
            className="text-xs font-medium text-zinc-400"
          >
            {t('servicesListCard.price')}
          </label>
          <div className="relative">
            <Euro className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            <Input
              id="new-service-price"
              required
              disabled={loading}
              type="number"
              min="0"
              step="0.01"
              placeholder="15,00"
              className="min-h-11 bg-zinc-950/70 pl-9"
              value={newServiceData.price || ''}
              onChange={(e) =>
                setNewServiceData({
                  ...newServiceData,
                  price: parseFloat(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="new-service-duration"
            className="text-xs font-medium text-zinc-400"
          >
            {t('servicesListCard.duration')}
          </label>
          <div className="relative">
            <Clock3 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            <Input
              id="new-service-duration"
              required
              disabled={loading}
              type="number"
              min="1"
              placeholder="30"
              className="min-h-11 bg-zinc-950/70 pl-9 pr-12"
              value={newServiceData.duration || ''}
              onChange={(e) =>
                setNewServiceData({
                  ...newServiceData,
                  duration: parseInt(e.target.value, 10),
                })
              }
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
              min
            </span>
          </div>
        </div>

        <Button
          aria-label={loading ? 'A guardar serviço' : 'Guardar serviço'}
          type="submit"
          disabled={loading}
          className="min-h-11 bg-amber-600 text-white hover:bg-amber-500"
        >
          {loading ? (
            <Spinner className="size-4" />
          ) : (
            <>
              {t('servicesListCard.submit')}{' '}
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface ServiceItemCardProps {
  service: Service;
  setEditingService: (service: Service) => void;
  handleDeleteService: (id: string) => void;
  handleToggleServiceActive: (service: Service) => void;
  loading: boolean;
  onDuplicate: (service: Service) => void;
}

function ServiceItemCard({
  service,
  setEditingService,
  handleDeleteService,
  handleToggleServiceActive,
  loading,
  onDuplicate,
}: ServiceItemCardProps) {
  const { t, locale } = useLanguage();
  return (
    <article className="group flex min-h-[150px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-amber-500/30 hover:bg-white/[0.045]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-100">
            {service.name}
          </h3>
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
            {Number(service.price).toFixed(2).replace('.', ',')} €
          </span>
        </div>
        <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${service.is_active === false ? 'bg-zinc-700/50 text-zinc-400' : 'bg-emerald-500/10 text-emerald-300'}`}>
          {service.is_active === false ? (locale === 'pt' ? 'Inativo' : 'Inactive') : (locale === 'pt' ? 'Ativo' : 'Active')}
        </span>
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <Clock3 className="size-3.5" />
          {service.duration ?? (service as any).min_duration ?? '—'} min
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-start gap-1 border-t border-white/5 pt-3">
        <Button
          variant="ghost"
          onClick={() => setEditingService(service)}
          className="min-h-11 rounded-lg px-3 text-zinc-200 hover:bg-white/10 hover:text-white"
          aria-label={t('servicesListCard.edit', { name: service.name })}
        >
          <Pencil className="mr-2 size-4" />
          {t('common.edit')}
        </Button>
        <Button disabled={loading} variant="ghost" onClick={() => handleToggleServiceActive(service)} className="min-h-11 rounded-lg px-3 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label={service.is_active === false ? (locale === 'pt' ? `Ativar ${service.name}` : `Activate ${service.name}`) : (locale === 'pt' ? `Desativar ${service.name}` : `Deactivate ${service.name}`)}>
          <Power className="mr-2 size-4" />
          {service.is_active === false ? (locale === 'pt' ? 'Ativar' : 'Activate') : (locale === 'pt' ? 'Desativar' : 'Deactivate')}
        </Button>
        <Button variant="ghost" onClick={() => onDuplicate(service)} className="min-h-11 rounded-lg px-3 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label={locale === 'pt' ? `Duplicar ${service.name}` : `Duplicate ${service.name}`}>
          <Copy className="mr-2 size-4" />
          {locale === 'pt' ? 'Duplicar' : 'Duplicate'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-11 rounded-lg px-3 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              aria-label={t('servicesListCard.delete', { name: service.name })}
            >
              <Trash2 className="mr-2 size-4" />
              {t('common.delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('servicesListCard.deleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('servicesListCard.deleteDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white">
                {t('servicesListCard.keep')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white"
                onClick={() => handleDeleteService(service.id)}
              >
                {t('servicesListCard.deleteAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </article>
  );
}
