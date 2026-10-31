'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Lock,
  Plus,
  Tag,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  params: Promise<{ clientId: string }>;
}
type Client = {
  id: string;
  name_complete: string;
  email?: string | null;
  num_phone?: string | null;
  style_notes?: string | null;
  created_at: string;
};
type Appointment = {
  id: string;
  date_hour: string;
  status: string;
  payment_method?: string | null;
  value_products?: number | null;
};
type Note = { id: string; content: string; created_at: string };
type Tag = {
  tag_id: string;
  client_tags?: { id: string; name: string } | null;
};

async function authHeaders(contentType = false) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error('Your session expired. Please sign in again.');
  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

export default function CRMClientPage({ params }: Props) {
  const { t, locale } = useLanguage();
  const { hasFeature, loading: billingLoading } = useFeatureAccess();
  const allowed = hasFeature('advanced_crm');
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setClientId(value.clientId));
  }, [params]);
  useEffect(() => {
    if (billingLoading || !allowed || !clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/crm/clients/${clientId}`, {
          headers: await authHeaders(),
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok)
          throw new Error(json.error ?? t('crmDetail.loadFailed'));
        if (!cancelled) {
          setClient(json.client);
          setAppointments(json.appointments ?? []);
          setNotes(json.notes ?? []);
          setTags(json.tags ?? []);
        }
      } catch (error) {
        if (!cancelled)
          toast.error(
            error instanceof Error ? error.message : t('crmDetail.loadError'),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, billingLoading, clientId, t]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId || !note.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/clients/${clientId}/notes`, {
        method: 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify({ content: note.trim() }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? t('crmDetail.saveNoteFailed'));
      setNotes((current) => [json.note, ...current]);
      setNote('');
      toast.success(t('crmDetail.noteSaved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('crmDetail.saveNoteError'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (billingLoading) return <main className="min-h-screen bg-background" />;
  if (!allowed)
    return (
      <main className="min-h-screen bg-background px-4 py-24">
        <Card className="mx-auto max-w-2xl border-white/10 bg-white/[0.03]">
          <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
            <Lock className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold">{t('crmDetail.title')}</h1>
            <p className="text-muted-foreground">
              {t('crmDetail.planRequired')}
            </p>
            <Button asChild>
              <Link href="/plans">{t('crmDetail.viewPlans')}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  if (loading || !client)
    return (
      <main className="min-h-screen bg-background px-4 py-24 text-center text-muted-foreground">
        {t('crmDetail.loadingClient')}
      </main>
    );

  return (
    <main className="min-h-screen bg-background px-4 py-20 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/crm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('crmDetail.backToCustomers')}
          </Link>
        </Button>
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-primary">{t('crmDetail.profile')}</p>
            <h1 className="text-3xl font-semibold">{client.name_complete}</h1>
            <p className="mt-1 text-muted-foreground">
              {client.email || t('crmDetail.noEmail')} ·{' '}
              {client.num_phone || t('crmDetail.noPhone')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((item) =>
              item.client_tags?.name ? (
                <span
                  key={item.tag_id}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                >
                  <Tag className="mr-1 inline h-3 w-3" />
                  {item.client_tags.name}
                </span>
              ) : null,
            )}
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {t('crmDetail.appointmentHistory')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('crmDetail.noAppointments')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                      >
                        <div>
                          <p className="font-medium">
                            {new Date(item.date_hour).toLocaleString(
                              locale === 'en' ? 'en-GB' : 'pt-PT',
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.status}
                            {item.payment_method
                              ? ` · ${item.payment_method}`
                              : ''}
                          </p>
                        </div>
                        {item.value_products ? (
                          <span className="text-sm">
                            €{Number(item.value_products).toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle>{t('crmDetail.internalNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addNote} className="space-y-3">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={5000}
                    placeholder={t('crmDetail.notePlaceholder')}
                  />
                  <Button type="submit" disabled={saving || !note.trim()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('crmDetail.saveNote')}
                  </Button>
                </form>
                <div className="mt-6 space-y-3">
                  {notes.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-black/10 p-4"
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {item.content}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString('pt-PT')}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="h-fit border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                {t('crmDetail.customerData')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('crmDetail.email')}</p>
                <p>{client.email || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('crmDetail.phone')}</p>
                <p>{client.num_phone || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t('crmDetail.customerSince')}
                </p>
                <p>
                  {new Date(client.created_at).toLocaleDateString(
                    locale === 'en' ? 'en-GB' : 'pt-PT',
                  )}
                </p>
              </div>
              {client.style_notes ? (
                <div>
                  <p className="text-muted-foreground">
                    {t('crmDetail.styleNotes')}
                  </p>
                  <p className="whitespace-pre-wrap">{client.style_notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
