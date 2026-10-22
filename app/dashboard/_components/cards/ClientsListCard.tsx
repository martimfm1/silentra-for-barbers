'use client';

import { Client, ClientsListCardProps } from '@/types';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  loading,
}: ClientsListCardProps) {
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
                A tua base de clientes
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {clientsCount === 0
                  ? 'Começa pelo essencial. O histórico cresce com as marcações.'
                  : `${clientsCount} ${clientsCount === 1 ? 'cliente' : 'clientes'} na tua base.`}
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
                placeholder="Pesquisar por nome ou telemóvel"
                aria-label="Pesquisar clientes por nome ou telemóvel"
                className="min-h-11 rounded-lg bg-zinc-950/70 pl-9 pr-10"
              />
              {hasSearch && (
                <button
                  type="button"
                  onClick={() => setSearchClientQuery('')}
                  aria-label="Limpar pesquisa"
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => setShowAddClientForm(true)}
              className="min-h-11 rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white"
            >
              <UserPlus className="mr-2 size-4" />
              Adicionar cliente
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <Dialog open={showAddClientForm} onOpenChange={setShowAddClientForm}>
          <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar cliente</DialogTitle>
              <DialogDescription>
                Guarda os contactos essenciais. A data de nascimento pode ser adicionada ao editar o cliente.
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
              <Button variant="outline" onClick={() => setShowAddClientForm(false)} className="border-white/10 bg-transparent">
                Fechar
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
              />
            ))}
          </div>
        )}
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
  async function submit(event: FormEvent) {
    const created = await handleCreateClient(event);
    if (created) setShowAddClientForm(false);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid gap-4 py-2"
    >
      <div className="mb-4 flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-400" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Adiciona apenas o essencial
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label
            htmlFor="new-client-name"
            className="text-xs font-medium text-zinc-400"
          >
            Nome completo
          </label>
          <input
            id="new-client-name"
            required
            disabled={loading}
            autoFocus
            placeholder="Ex.: João Silva"
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
            Telemóvel
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
            Email
          </label>
          <input
            id="new-client-email"
            disabled={loading}
            type="email"
            placeholder="cliente@email.com"
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
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
        >
          {loading ? (
            <Spinner className="size-4" />
          ) : (
            <>
              Adicionar <ArrowRight className="ml-2 size-4" />
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
  if (hasSearch) {
    return (
      <EmptyState
        icon={Users}
        title="Não encontrámos esse cliente"
        description="Experimenta outro nome ou telemóvel."
        actionLabel="Limpar pesquisa"
        onAction={() => setSearchClientQuery('')}
        tone="blue"
      />
    );
  }

  return (
    <EmptyState
      icon={Users}
      title="A tua base ainda está vazia"
      description="Adiciona o primeiro cliente agora ou deixa o Silentra criá-lo a partir de uma marcação concluída."
      actionLabel="Adicionar primeiro cliente"
      onAction={() => setShowAddClientForm(true)}
      tone="blue"
    />
  );
}

interface ClientItemCardProps {
  client: Client;
  setEditingClient: (client: Client) => void;
  handleDeleteClient: (id: string) => void;
}

function ClientItemCard({
  client,
  setEditingClient,
  handleDeleteClient,
}: ClientItemCardProps) {
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
            <p className="mt-1 text-xs text-zinc-500">Cliente</p>
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
                'pt-PT',
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-1 border-t border-white/5 pt-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditingClient(client)}
          className="size-9 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label={`Editar ${client.name_complete}`}
        >
          <Pencil className="size-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
              aria-label={`Eliminar ${client.name_complete}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar este cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é permanente. Se existirem marcações associadas, o
                histórico deve ser preservado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white">
                Manter
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white"
                onClick={() => handleDeleteClient(client.id)}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </article>
  );
}
