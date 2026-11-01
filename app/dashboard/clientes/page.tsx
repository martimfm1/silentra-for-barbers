'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';

import { Client } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { useClients } from '@/app/state/_hooks/dashboard/useClients';

import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { ClientsListCard } from '@/app/dashboard/_components/cards/ClientsListCard';
import { ClientDetailsDialog } from '@/components/dashboard/client-details-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const CLIENTS_PAGE_SIZE = 50;

export default function ClientesPage() {
  const { t } = useLanguage();
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const [clients, setClients] = useState<Client[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const requestController = useRef<AbortController | null>(null);
  const hasLoadedClients = useRef(false);

  const fetchClients = useCallback(async () => {
    if (!barbershopId) {
      setClients([]);
      setTotalClients(0);
      hasLoadedClients.current = true;
      setLoadingInitial(false);
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoadingInitial(!hasLoadedClients.current);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t('crm.sessionExpired'));
      }

      const params = new URLSearchParams({
        limit: String(CLIENTS_PAGE_SIZE),
        offset: String(offset),
      });
      const search = searchClientQuery.trim();
      if (search) params.set('search', search);

      const response = await fetch(`/api/crm/clients?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload.clients)) {
        throw new Error(payload.error ?? t('clientsPage.loadError'));
      }

      const total = Number(payload.total) || 0;
      const lastValidOffset =
        total > 0
          ? Math.floor((total - 1) / CLIENTS_PAGE_SIZE) * CLIENTS_PAGE_SIZE
          : 0;

      setTotalClients(total);
      if (offset > lastValidOffset) {
        setOffset(lastValidOffset);
        return;
      }

      setClients(payload.clients as Client[]);
      hasLoadedClients.current = true;
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[Clientes Sync Error]:', error);
      toast.error(
        error instanceof Error ? error.message : t('clientsPage.loadError'),
      );
    } finally {
      if (!controller.signal.aborted) setLoadingInitial(false);
    }
  }, [barbershopId, offset, searchClientQuery, t]);

  useEffect(() => {
    if (isLoadingBarbershop) return;

    const timer = window.setTimeout(
      () => void fetchClients(),
      searchClientQuery.trim() ? 250 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, [
    barbershopId,
    fetchClients,
    isLoadingBarbershop,
    offset,
    searchClientQuery,
  ]);

  useEffect(
    () => () => {
      requestController.current?.abort();
    },
    [],
  );

  const updateSearch = (value: string) => {
    setSearchClientQuery(value);
    setOffset(0);
  };

  const {
    loadingClients,
    newClientData,
    setNewClientData,
    editingClient,
    setEditingClient,
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient,
  } = useClients(barbershopId, fetchClients);

  const currentPage = Math.floor(offset / CLIENTS_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalClients / CLIENTS_PAGE_SIZE));

  return (
    <main className="min-h-screen bg-zinc-950 p-4 pt-16 text-zinc-100 sm:p-6 sm:pt-16 lg:p-8 lg:pt-16">
      <div className="mx-auto max-w-7xl space-y-6">
        <ManagementPageHeader
          icon={Users}
          eyebrow={t('clientsPage.eyebrow')}
          title={t('clientsPage.title')}
          description={t('clientsPage.description')}
          accentClassName="text-blue-400 bg-blue-500/10 border-blue-500/20"
        />

        {loadingInitial ? (
          <ClientsListSkeleton />
        ) : (
          <ClientsListCard
            clientsCount={totalClients}
            filteredClients={clients}
            searchClientQuery={searchClientQuery}
            setSearchClientQuery={updateSearch}
            showAddClientForm={showAddClientForm}
            setShowAddClientForm={setShowAddClientForm}
            newClientData={newClientData}
            setNewClientData={setNewClientData}
            handleCreateClient={handleCreateClient}
            setEditingClient={setEditingClient}
            handleDeleteClient={handleDeleteClient}
            onViewClient={(client) => setSelectedClientId(client.id)}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) =>
              setOffset((page - 1) * CLIENTS_PAGE_SIZE)
            }
            loading={loadingClients}
          />
        )}

        <ClientDetailsDialog
          clientId={selectedClientId}
          open={Boolean(selectedClientId)}
          onOpenChange={(open) => {
            if (!open) setSelectedClientId(null);
          }}
        />

        <EditClientDialog
          editingClient={editingClient}
          onClose={() => setEditingClient(null)}
          onUpdate={handleUpdateClient}
          onChange={setEditingClient}
          loading={loadingClients}
        />
      </div>
    </main>
  );
}

function ClientsListSkeleton() {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      aria-label={t('clientsPage.loading')}
      className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
    >
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

interface EditClientDialogProps {
  editingClient: Client | null;
  onClose: () => void;
  onUpdate: (e: React.FormEvent) => void;
  onChange: (client: Client) => void;
  loading: boolean;
}

function EditClientDialog({
  editingClient,
  onClose,
  onUpdate,
  onChange,
  loading,
}: EditClientDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={!!editingClient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('clientsPage.editTitle')}</DialogTitle>
        </DialogHeader>

        {editingClient && (
          <form onSubmit={onUpdate} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-client-name" className="text-xs text-zinc-400">
                {t('clientsPage.name')}
              </label>
              <input
                id="edit-client-name"
                required
                disabled={loading}
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-blue-500/50"
                value={editingClient.name_complete ?? ''}
                onChange={(e) =>
                  onChange({ ...editingClient, name_complete: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-client-phone" className="text-xs text-zinc-400">
                {t('clientsPage.phone')}
              </label>
              <input
                id="edit-client-phone"
                required
                disabled={loading}
                type="tel"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-blue-500/50"
                value={editingClient.num_phone ?? ''}
                onChange={(e) =>
                  onChange({ ...editingClient, num_phone: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-client-email" className="text-xs text-zinc-400">
                {t('auth.email')}
              </label>
              <input
                id="edit-client-email"
                disabled={loading}
                type="email"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-blue-500/50"
                value={editingClient.email ?? ''}
                onChange={(e) =>
                  onChange({ ...editingClient, email: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="edit-client-birth-date"
                className="text-xs text-zinc-400"
              >
                {t('clientsPage.birthDate')}{' '}
                <span className="text-zinc-600">{t('clientsPage.optional')}</span>
              </label>
              <input
                id="edit-client-birth-date"
                disabled={loading}
                type="date"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-blue-500/50"
                value={editingClient.birth_date ?? ''}
                onChange={(e) =>
                  onChange({
                    ...editingClient,
                    birth_date: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-client-style-notes" className="text-xs text-zinc-400">
                {t('crmDetail.styleNotes')}
              </label>
              <Textarea
                id="edit-client-style-notes"
                disabled={loading}
                rows={3}
                maxLength={5000}
                value={editingClient.style_notes ?? ''}
                onChange={(e) =>
                  onChange({ ...editingClient, style_notes: e.target.value })
                }
                placeholder={t('crmDetail.notePlaceholder')}
              />
            </div>

            <DialogFooter>
              <Button
                aria-label={loading ? 'A guardar cliente' : 'Guardar cliente'}
                type="submit"
                disabled={loading}
                className="min-h-11 w-full bg-blue-600 text-white hover:bg-blue-500"
              >
                {loading ? <Spinner className="size-4" /> : t('clientsPage.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
