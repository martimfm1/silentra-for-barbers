'use client';

import { useDashboardConfirm } from '@/components/dashboard/dashboard-confirm-provider';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserRoundCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type Role = 'owner' | 'admin' | 'manager' | 'barber' | 'receptionist' | 'staff';
type Permissions = Record<string, boolean>;
type Member = {
  user_id: string;
  name_complete: string | null;
  email: string | null;
  num_phone: string | null;
  role: Role;
  joined_via_code: boolean;
  joined_at: string | null;
  permissions: Permissions;
  professional?: {
    id: string;
    name: string;
    active: boolean;
    commission_percentage: number | null;
  } | null;
};

type TeamMembersManagerProps = {
  onMembershipChanged?: () => Promise<void> | void;
};

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gestor',
  barber: 'Barbeiro',
  receptionist: 'Rececionista',
  staff: 'Equipa',
};

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda e marcações',
  clients: 'Clientes',
  services: 'Serviços',
  team: 'Equipa',
  messages: 'Mensagens',
  marketing: 'Marketing',
  loyalty: 'Fidelização',
  automations: 'Automações',
  analytics: 'Estatísticas',
  qr: 'QR da barbearia',
  settings: 'Definições',
  billing: 'Faturação',
};

export function TeamMembersManager({
  onMembershipChanged,
}: TeamMembersManagerProps) {
  const confirm = useDashboardConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [seats, setSeats] = useState<{
    used: number;
    limit: number;
    unlimited: boolean;
  }>({ used: 0, limit: 1, unlimited: false });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/team/members', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível carregar os membros.');
      setMembers(data.members ?? []);
      setSeats(data.seats ?? { used: 0, limit: 1, unlimited: false });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os membros.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(member: Member) {
    if (member.role === 'owner') return;
    setSavingId(member.user_id);
    try {
      const response = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.user_id,
          role: member.role,
          permissions: member.permissions,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível guardar as permissões.',
        );
      toast.success(`${member.name_complete || 'Membro'} atualizado.`);
      await load();
      await onMembershipChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar as permissões.',
      );
    } finally {
      setSavingId(null);
    }
  }

  async function remove(member: Member) {
    if (member.role === 'owner') return;
    const confirmed = await confirm({
      title: 'Remover membro da equipa?',
      description: `${member.name_complete || 'Este membro'} perderá acesso à barbearia. Esta ação não apaga o histórico de atividade.`,
      confirmLabel: 'Remover membro',
      destructive: true,
    });
    if (!confirmed) return;
    setSavingId(member.user_id);
    try {
      const response = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível remover o membro.');
      toast.success('Membro removido da equipa.');
      await load();
      await onMembershipChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o membro.',
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card className="rounded-3xl border-white/10 bg-zinc-900/60 shadow-xl">
      <CardHeader className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold text-zinc-50">
              Membros e permissões
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              As pessoas convidadas contam para o limite da equipa. A role
              `Barbeiro` cria e mantém automaticamente o perfil de barbeiro
              ligado à conta.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">
              <span className="font-semibold text-white">{seats.used}</span>
              <span className="text-zinc-500">/</span>
              <span>{seats.unlimited ? '∞' : seats.limit}</span>
              <span className="text-zinc-500">
                lugares de equipa utilizados
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-zinc-500" />
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            Ainda não existem membros associados à equipa.
          </div>
        ) : (
          members.map((member) => {
            const isOwner = member.role === 'owner';
            return (
              <div
                key={member.user_id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserRoundCheck
                        className="size-4 text-zinc-400"
                        aria-hidden="true"
                      />
                      <h3 className="font-semibold text-zinc-100">
                        {member.name_complete || member.email || 'Membro'}
                      </h3>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400">
                        {ROLE_LABELS[member.role]}
                      </span>
                      {isOwner && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                          Plano da barbearia
                        </span>
                      )}
                      {member.role === 'barber' && member.professional && (
                        <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-300">
                          Perfil de barbeiro ligado
                        </span>
                      )}
                      {member.joined_via_code && (
                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400">
                          Entrou por código
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {member.email || 'Sem email'}
                      {member.num_phone ? ` · ${member.num_phone}` : ''}
                    </p>
                  </div>

                  {!isOwner && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-52">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                        Função
                      </label>
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          setMembers((current) =>
                            current.map((item) =>
                              item.user_id === member.user_id
                                ? { ...item, role: value as Role }
                                : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="min-h-11 border-white/10 bg-white/[0.04] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS)
                            .filter(([value]) => value !== 'owner')
                            .map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {!isOwner && (
                  <>
                    <div className="mt-5 rounded-2xl border border-white/5 bg-black/10 p-3">
                      <p className="px-1 pb-2 text-xs text-zinc-500">
                        As funcionalidades disponíveis pelo plano continuam
                        disponíveis para a barbearia. Estes interruptores
                        definem apenas o acesso individual deste membro.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(PERMISSION_LABELS).map(
                          ([key, label]) => (
                            <label
                              key={key}
                              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-300"
                            >
                              <span>{label}</span>
                              <Switch
                                checked={Boolean(member.permissions?.[key])}
                                onCheckedChange={(checked) =>
                                  setMembers((current) =>
                                    current.map((item) =>
                                      item.user_id === member.user_id
                                        ? {
                                            ...item,
                                            permissions: {
                                              ...item.permissions,
                                              [key]: checked,
                                            },
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                aria-label={`Permissão: ${label}`}
                              />
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => void remove(member)}
                        disabled={savingId === member.user_id}
                        className="min-h-11 border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 sm:w-auto"
                      >
                        <Trash2 className="mr-2 size-4" /> Remover
                      </Button>
                      <Button
                        onClick={() => void save(member)}
                        disabled={savingId === member.user_id}
                        className="min-h-11 bg-purple-600 text-white hover:bg-purple-500 sm:w-auto"
                      >
                        {savingId === member.user_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          'Guardar permissões'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
