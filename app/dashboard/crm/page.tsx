'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  ChevronRight,
  Lock,
  Plus,
  Tag,
  UserPlus,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type ClientRow = {
  id: string;
  name_complete: string;
  email?: string | null;
  num_phone?: string | null;
};
type TagRow = { id: string; name: string };

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error('Your session expired. Please sign in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function CRMPage() {
  const { t } = useLanguage();
  const { hasFeature, loading: billingLoading } = useFeatureAccess();
  const allowed = hasFeature('advanced_crm');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (billingLoading || !allowed) return;
    let cancelled = false;
    const load = async () => {
      try {
        const headers = await authHeaders();
        const [clientsRes, tagsRes] = await Promise.all([
          fetch(
            `/api/crm/clients?limit=100&search=${encodeURIComponent(search)}`,
            { headers, cache: 'no-store' },
          ),
          fetch('/api/crm/tags', { headers, cache: 'no-store' }),
        ]);
        if (!clientsRes.ok || !tagsRes.ok)
          throw new Error(t('crm.loadFailed'));
        const clientsJson = await clientsRes.json();
        const tagsJson = await tagsRes.json();
        if (!cancelled) {
          setClients(clientsJson.clients ?? []);
          setTags(tagsJson.tags ?? []);
        }
      } catch (error) {
        if (!cancelled)
          toast.error(
            error instanceof Error
              ? error.message
              : t('crm.loadClientsFailed'),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowed, billingLoading, search, t]);

  async function handleCreateTag(event: React.FormEvent) {
    event.preventDefault();
    if (!newTag.trim()) return;
    setCreatingTag(true);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const response = await fetch('/api/crm/tags', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newTag.trim() }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? t('crm.tagCreateFailed'));
      setTags((current) =>
        [...current, json.tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewTag('');
      toast.success(t('crm.tagCreated'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('crm.tagCreateFailed'),
      );
    } finally {
      setCreatingTag(false);
    }
  }

  const hasSearch = search.trim().length > 0;
  const emptyTitle = hasSearch
    ? t('crm.noCustomerFound')
    : t('crm.baseStartsHere');
  const emptyDescription = hasSearch
    ? t('crm.trySearch')
    : t('crm.autoPopulate');
  const clientCountLabel = useMemo(
    () => `${clients.length} ${t(clients.length === 1 ? 'crm.customerSingular' : 'crm.customerPlural')}`,
    [clients.length],
  );

  if (billingLoading) return <main className="min-h-screen bg-background" />;
  if (!allowed)
    return (
      <main className="min-h-screen bg-background px-4 py-24 text-foreground">
        <div className="mx-auto max-w-2xl">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
              <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                <Lock className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{t('crm.title')}</h1>
                <p className="mt-2 text-muted-foreground">
                  {t('crm.lockedDescription')}
                </p>
              </div>
              <Button asChild>
                <Link href="/plans">{t('crm.comparePlans')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-background px-4 py-20 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {t('crm.relationship')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {t('crm.customers')}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t('crm.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">{t('crm.backDashboard')}</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/agenda">
                <UserPlus className="mr-2 h-4 w-4" />
                {t('crm.newAppointment')}
              </Link>
            </Button>
          </div>
        </header>

        {!loading && clients.length === 0 && !hasSearch && (
          <section className="overflow-hidden rounded-3xl border border-primary/20 bg-primary/[0.05] p-5 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {t('crm.noExtraWork')}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {t('crm.noManualImport')}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t('crm.autoCreateDescription')}
                  </p>
                </div>
              </div>
              <Button asChild className="shrink-0">
                <Link href="/dashboard/agenda">
                  {t('crm.firstAppointment')}{' '}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('crm.customerBase')}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    {clientCountLabel}
                  </span>
                </CardTitle>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('crm.searchPlaceholder')}
                  aria-label={t('crm.searchCustomers')}
                  className="min-h-[44px] pl-9 pr-9"
                />
                {hasSearch && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label={t('crm.clearSearch')}
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 py-6">
                  <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
                  <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
                  <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
                </div>
              ) : clients.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-7 w-7 text-muted-foreground/50" />
                  <p className="mt-3 font-medium">{emptyTitle}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    {emptyDescription}
                  </p>
                  {hasSearch && (
                    <Button
                      variant="outline"
                      onClick={() => setSearch('')}
                      className="mt-4"
                    >
                      {t('crm.clearSearch')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {clients.map((client) => (
                    <Link
                      key={client.id}
                      href={`/dashboard/crm/${client.id}`}
                      className="group flex min-h-[72px] items-center justify-between gap-4 py-4 transition hover:bg-white/[0.03] md:px-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {client.name_complete.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {client.name_complete}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {client.email ||
                              client.num_phone ||
                              t('crm.noContact')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t('crm.tags')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('crm.tagsDescription')}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTag} className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  maxLength={50}
                  placeholder={t('crm.tagPlaceholder')}
                  aria-label={t('crm.newTagName')}
                  className="min-h-[44px]"
                />
                <Button
                  type="submit"
                  disabled={creatingTag || !newTag.trim()}
                  className="min-h-[44px] shrink-0"
                >
                  {creatingTag ? t('crm.creating') : t('crm.add')}
                </Button>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                    >
                      {tag.name}
                    </span>
                  ))
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t('crm.noTags')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
