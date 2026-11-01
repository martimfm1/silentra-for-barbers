'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

import { Client } from '@/types';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { useClients } from '@/app/state/_hooks/dashboard/useClients';

import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { ClientsListCard } from '@/app/dashboard/_components/cards/ClientsListCard';
import { ClientProfileDialog } from '@/app/dashboard/_components/ClientProfileDialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ClientesPage() {
  const { t } = useLanguage();
  // --- Context & State ---
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // --- Data Fetching ---
  const fetchClients = useCallback(async () => {
    if (!barbershopId) return;
    setLoadingInitial(true);
    try {
      const res = await appointmentService.getClients(barbershopId);
      if (res.error) throw res.error;
      setClients(res.data ?? []);
    } catch (error) {
      console.error('[Clientes Sync Error]:', error);
      toast.error(t('clientsPage.loadError'));
    } finally {
      setLoadingInitial(false);
    }
  }, [barbershopId, t]);

  useEffect(() => {
    if (!isLoadingBarbershop && barbershopId) {
      queueMicrotask(() => void fetchClients());
    }
  }, [barbershopId, fetchClients, isLoadingBarbershop]);

  // --- Custom Hook & Handlers ---
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

  // --- Computed State ---
  const filteredClients = useMemo(() => {
    const query = searchClientQuery.trim().toLocaleLowerCase();
    if (!query) return clients;
    const digits = query.replace(/\D/g, '');
    return clients.filter((client) => {
      const fields = [
        client.name_complete,
        client.num_phone,
        client.email,
        client.style_notes,
      ];
      return (
        fields.some((value) => value?.toLocaleLowerCase().includes(query)) ||
        (digits.length > 0 &&
          String(client.num_phone ?? '').replace(/\D/g, '').includes(digits))
      );
    });
  }, [clients, searchClientQuery]);

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
            clientsCount={clients.length}
            filteredClients={filteredClients}
            searchClientQuery={searchClientQuery}
            setSearchClientQuery={setSearchClientQuery}
            showAddClientForm={showAddClientForm}
            setShowAddClientForm={setShowAddClientForm}
            newClientData={newClientData}
            setNewClientData={setNewClientData}
            handleCreateClient={handleCreateClient}
            setEditingClient={setEditingClient}
            onSelectClient={setSelectedClient}
            handleDeleteClient={handleDeleteClient}
            loading={loadingClients}
          />
        )}

        <EditClientDialog
          editingClient={editingClient}
          onClose={() => setEditingClient(null)}
          onUpdate={handleUpdateClient}
          onChange={setEditingClient}
          loading={loadingClients}
        />
        <ClientProfileDialog
          client={selectedClient}
          barbershopId={barbershopId}
          onClose={() => setSelectedClient(null)}
          onEdit={(client) => {
            setSelectedClient(null);
            setEditingClient(client);
          }}
        />
      </div>
    </main>
  );
}

// --- Sub-componentes para melhor organização visual ---

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('clientsPage.editTitle')}</DialogTitle>
        </DialogHeader>

        {editingClient && (
          <form onSubmit={onUpdate} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="edit-client-name"
                className="text-xs text-zinc-400"
              >
                {t('clientsPage.name')}
              </label>
              <input
                id="edit-client-name"
                required
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-emerald-500/50"
                value={editingClient.name_complete ?? ''}
                onChange={(e) =>
                  onChange({
                    ...editingClient,
                    name_complete: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="edit-client-phone"
                className="text-xs text-zinc-400"
              >
                {t('clientsPage.phone')}
              </label>
              <input
                id="edit-client-phone"
                required
                type="tel"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-emerald-500/50"
                value={editingClient.num_phone ?? ''}
                onChange={(e) =>
                  onChange({
                    ...editingClient,
                    num_phone: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="edit-client-email" className="text-xs text-zinc-400">
                {t('clientsPage.email')}
              </label>
              <input
                id="edit-client-email"
                type="email"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-emerald-500/50"
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
                <span className="text-zinc-600">
                  {t('clientsPage.optional')}
                </span>
              </label>
              <input
                id="edit-client-birth-date"
                type="date"
                className="min-h-11 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus:border-emerald-500/50"
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
                {t('clientsPage.preferences')}
                <span className="ml-1 text-zinc-600">{t('clientsPage.optional')}</span>
              </label>
              <Textarea
                id="edit-client-style-notes"
                value={editingClient.style_notes ?? ''}
                onChange={(e) =>
                  onChange({ ...editingClient, style_notes: e.target.value })
                }
                maxLength={2000}
                rows={3}
                className="border-white/10 bg-white/5"
              />
            </div>

            <DialogFooter>
              <Button
                aria-label={loading ? 'A guardar cliente' : 'Guardar cliente'}
                type="submit"
                disabled={loading}
                className="min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {loading ? (
                  <Spinner className="size-4" />
                ) : (
                  t('clientsPage.saveChanges')
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
