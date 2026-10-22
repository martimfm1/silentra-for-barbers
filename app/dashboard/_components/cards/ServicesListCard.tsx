'use client';

import { Service, ServicesListCardProps } from '@/types';
import {
  Scissors,
  Plus,
  Clock3,
  Pencil,
  Trash2,
  Euro,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  loading,
}: ServicesListCardProps) {
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
                O teu menu
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                {servicesCount === 0
                  ? 'Começa pelo serviço que os clientes mais procuram.'
                  : `${servicesCount} ${servicesCount === 1 ? 'serviço configurado' : 'serviços configurados'}.`}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddServiceForm(true)}
            className="min-h-11 w-full bg-zinc-50 text-zinc-950 hover:bg-zinc-200 sm:w-auto"
          >
            <Plus className="mr-2 size-4" />
            Adicionar serviço
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <Dialog open={showAddServiceForm} onOpenChange={setShowAddServiceForm}>
          <DialogContent className="border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Adicionar serviço</DialogTitle>
              <DialogDescription>
                Define o nome, o preço e a duração. Podes acrescentar mais serviços depois.
              </DialogDescription>
            </DialogHeader>
            <AddServiceForm
              newServiceData={newServiceData}
              setNewServiceData={setNewServiceData}
              handleCreateService={handleCreateService}
              loading={loading}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddServiceForm(false)} className="border-white/10 bg-transparent">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="Ainda não tens serviços"
            description="Não precisas de criar o menu todo. Adiciona primeiro o serviço mais procurado e começa a receber marcações."
            actionLabel="Adicionar primeiro serviço"
            onAction={() => setShowAddServiceForm(true)}
            tone="amber"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceItemCard
                key={service.id}
                service={service}
                setEditingService={setEditingService}
                handleDeleteService={handleDeleteService}
              />
            ))}
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
  loading: boolean;
}

function AddServiceForm({
  newServiceData,
  setNewServiceData,
  handleCreateService,
  loading,
}: AddServiceFormProps) {
  return (
    <form
      onSubmit={handleCreateService}
      className="grid gap-4 py-2"
    >
      <div className="mb-4 flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            Adiciona apenas o essencial
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
            placeholder="Ex.: Corte + Barba"
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
            Preço
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
            Duração
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
          type="submit"
          disabled={loading}
          className="min-h-11 bg-amber-600 text-white hover:bg-amber-500"
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

interface ServiceItemCardProps {
  service: Service;
  setEditingService: (service: Service) => void;
  handleDeleteService: (id: string) => void;
}

function ServiceItemCard({
  service,
  setEditingService,
  handleDeleteService,
}: ServiceItemCardProps) {
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
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <Clock3 className="size-3.5" />
          {service.duration ?? (service as any).min_duration ?? '—'} min
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-1 border-t border-white/5 pt-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setEditingService(service)}
          className="size-9 rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label={`Editar ${service.name}`}
        >
          <Pencil className="size-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
              aria-label={`Eliminar ${service.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-white/10 bg-zinc-950">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar este serviço?</AlertDialogTitle>
              <AlertDialogDescription>
                As marcações existentes não devem ser alteradas. Confirma apenas
                se já não precisas deste serviço.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white">
                Manter
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white"
                onClick={() => handleDeleteService(service.id)}
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
