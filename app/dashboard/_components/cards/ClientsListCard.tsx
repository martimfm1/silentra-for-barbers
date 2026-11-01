'use client';

import { Client, ClientsListCardProps } from '@/types';
import { useLanguage } from '@/context/LanguageContext';
import type { FormEvent } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Sparkles,
  X,
  ArrowRight,
  Cake,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
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

export function ClientsListCard({
  clientsCount,
  filteredClients,
  searchClientQuery,
  setSearchClientQuery,
  showAddClientForm,
  setShowAddClientForm,
  newClientData,
  setNewClientData,
  handleCreateClient,
  setEditingClient,
  handleDeleteClient,
  onViewClient,
  currentPage,
  totalPages,
  onPageChange,
  loading,
}: ClientsListCardProps) {
  const { t } = useLanguage();
  const hasSearch = searchClientQuery.trim().length > 0;

  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-zinc-900/0 shadow-xl backdrop-blur-xl">
      <CardHeader className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Header Info */}
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <Users className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold text-zinc-50">
                {t('clientsListCard.title')}
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {clientsCount === 0
                  ? t('clientsListCard.emptyDescription')
                  : `${clientsCount} ${clientsCount === 1 ? t('clientsListCard.countSingular') : t('clientsListCard.countPlural')} ${t('clientsListCard.countSuffix')}`}
              </p>
            </div>
          </div>

          {/* Controls: Search + Add Button */}
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={searchClientQuery}
                onChange={(e) => setSearchClientQuery(e.target.value)}
                placeholder={t('clientsListCard.searchPlaceholder')}
                aria-label={t('clientsListCard.searchLabel')}
                className="min-h-11 rounded-lg bg-zinc-950/70 pl-9 pr-10"
              />
              {hasSearch && (
                <button
                  type="button"
                  onClick={() => setSearchClientQuery('')}
                  aria-label={t('clientsListCard.clearSearch')}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <Button
              onClick={() => setShowAddClientForm(true)}
              className="min-h-11 rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white"
            >
              <UserPlus className="mr-2 size-4" />
              {t('clientsListCard.addClient')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <Dialog open={showAddClientForm} onOpenChange={setShowAddClientForm}>
          <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('clientsListCard.addDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('clientsListCard.formIntro')}
              </DialogDescription>
            </DialogHeader>
            <AddClientForm
              newClientData={newClientData}
              setNewClientData={setNewClientData}
              handleCreateClient={handleCreateClient}
              setShowAddClientForm={setShowAddClientForm}
              loading={loading}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddClientForm(false)}
                className="border-white/10 bg-transparent"
              >
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lista de Clientes / Empty States */}
        {filteredClients.length === 0 ? (
          <EmptyClientsState
            hasSearch={hasSearch}
            setSearchClientQuery={setSearchClientQuery}
            setShowAddClientForm={setShowAddClientForm}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <ClientItemCard
                key={client.id}
                client={client}
                setEditingClient={setEditingClient}
                handleDeleteClient={handleDeleteClient}
                onViewClient={onViewClient}
              />
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500 tabular-nums">
              {currentPage} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="min-h-10 flex-1 border-white/10 bg-white/[0.03] sm:flex-none"
              >
                {t('common.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="min-h-10 flex-1 border-white/10 bg-white/[0.03] sm:flex-none"
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- SUB-COMPONENTES PARA ORGANIZAÇÃO DA ESTRUTURA ---

interface AddClientFormProps {
  newClientData: ClientsListCardProps['newClientData'];
  setNewClientData: ClientsListCardProps['setNewClientData'];
  handleCreateClient: ClientsListCardProps['handleCreateClient'];
  setShowAddClientForm: ClientsListCardProps['setShowAddClientForm'];
  loading: boolean;
}

function AddClientForm({
  newClientData,
  setNewClientData,
  handleCreateClient,
  setShowAddClientForm,
  loading,
}: AddClientFormProps) {
  const { t } = useLanguage();
  async function submit(event: FormEvent) {
    const created = await handleCreateClient(event);
    if (created) setShowAddClientForm(false);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 py-2">
      <div className="mb-4 flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-400" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {t('clientsListCard.addDialogDescription')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label
            htmlFor="new-client-name"
            className="text-xs font-medium text-zinc-400"
          >
            {t('clientsListCard.fullName')}
          </label>
          <input
            id="new-client-name"
            required
            disabled={loading}
            autoFocus
            placeholder={t('clientsListCard.namePlaceholder')}
            className="min-h-11 rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none focus:border-blue-500/50"
            value={newClientData.name_complete}
            onChange={(e) =>
              setNewClientData({
                ...newClientData,
                name_complete: e.target.value,
              })
            }
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="new-client-phone"
            className="text-xs font-medium text-zinc-400"
          >
            {t('clientsListCard.mobile')}
          </label>
          <input
            id="new-client-phone"
            required
            disabled={loading}
            type="tel"
            inputMode="tel"
            placeholder="912 345 678"
            className="min-h-11 rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none focus:border-blue-500/50"
            value={newClientData.num_phone}
            onChange={(e) =>
              setNewClientData({
                ...newClientData,
                num_phone: e.target.value,
              })
            }
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="new-client-email"
            className="text-xs font-medium text-zinc-400"
          >
            {t('auth.email')}
          </label>
          <input
            id="new-client-email"
            disabled={loading}
            type="email"
            placeholder={t('clientsListCard.emailPlaceholder')}
            className="min-h-11 rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none focus:border-blue-500/50"
            value={newClientData.email}
            onChange={(e) =>
              setNewClientData({
                ...newClientData,
                email: e.target.value,
              })
            }
          />
        </div>

        <Button
          aria-label={loading ? 'A guardar cliente' : 'Guardar cliente'}
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
        >
          {loading ? (
            <Spinner className="size-4" />
          ) : (
            <>
              {t('clientsListCard.submit')}{' '}
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

interface EmptyClientsStateProps {
  hasSearch: boolean;
  setSearchClientQuery: (query: string) => void;
  setShowAddClientForm: (show: boolean) => void;
}

function EmptyClientsState({
  hasSearch,
  setSearchClientQuery,
  setShowAddClientForm,
}: EmptyClientsStateProps) {
  const { t } = useLanguage();
  if (hasSearch) {
    return (
      <EmptyState
        icon={Users}
        title={t('clientsListCard.notFound')}
        description={t('clientsListCard.tryAnotherSearch')}
        actionLabel={t('clientsListCard.clearSearch')}
        onAction={() => setSearchClientQuery('')}
        tone="blue"
      />
    );
  }

  return (
    <EmptyState
      icon={Users}
      title={t('clientsListCard.emptyTitle')}
      description={t('clientsListCard.emptyDescriptionLong')}
      actionLabel={t('clientsListCard.addFirst')}
      onAction={() => setShowAddClientForm(true)}
      tone="blue"
    />
  );
}

interface ClientItemCardProps {
  client: Client;
  setEditingClient: (client: Client) => void;
  handleDeleteClient: (id: string) => void;
  onViewClient: (client: Client) => void;
}

function ClientItemCard({
  client,
  setEditingClient,
  handleDeleteClient,
  onViewClient,
}: ClientItemCardProps) {
  const { t, locale } = useLanguage();
  return (
    <article className="group flex min-h-[190px] flex-col justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-blue-500/30 hover:bg-white/[0.045]">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-semibold text-blue-300">
            {client.name_complete.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {client.name_complete}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {t('clientsListCard.client')}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {client.num_phone && (
            <p className="flex items-center gap-2 text-xs text-zinc-400">
              <Phone className="size-3.5 text-zinc-600" />
              {client.num_phone}
            </p>
          )}
          {client.email && (
            <p className="flex items-center gap-2 truncate text-xs text-zinc-500">
              <Mail className="size-3.5 text-zinc-600" />
              {client.email}
            </p>
          )}
          {client.birth_date && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Cake className="size-3.5 text-zinc-600" />
              {new Date(`${client.birth_date}T12:00:00`).toLocaleDateString(
                locale === 'pt' ? 'pt-PT' : 'en-GB',
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewClient(client)}
          className="min-h-11 flex-1 rounded-xl border-blue-500/20 bg-blue-500/[0.06] px-3 text-blue-200 hover:bg-blue-500/10 hover:text-white"
        >
          <Eye className="mr-1.5 size-5 shrink-0" aria-hidden="true" />
          <span>{t('clientsListCard.viewProfile')}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditingClient(client)}
          className="min-h-11 rounded-xl border-white/10 bg-white/[0.03] px-3 text-zinc-200 hover:bg-white/[0.08] hover:text-white"
          aria-label={t('clientsListCard.edit', { name: client.name_complete })}
        >
          <Pencil className="mr-1.5 size-5 shrink-0" aria-hidden="true" />
          <span>{t('common.edit')}</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 rounded-xl border-red-500/20 bg-red-500/[0.04] px-3 text-red-300 hover:bg-red-500/10 hover:text-red-200"
              aria-label={t('clientsListCard.delete', {
                name: client.name_complete,
              })}
            >
              <Trash2 className="mr-1.5 size-5 shrink-0" aria-hidden="true" />
              <span>{t('common.delete')}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('clientsListCard.deleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('clientsListCard.deleteDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white">
                {t('clientsListCard.keep')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white"
                onClick={() => handleDeleteClient(client.id)}
              >
                {t('clientsListCard.deleteAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </article>
  );
}
