'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PushState = 'loading' | 'enabled' | 'disabled' | 'denied' | 'unsupported' | 'install-required' | 'not-configured' | 'error';
function decodeVapidKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}
function getPlatform(): 'ios' | 'android' | 'desktop' {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(agent)) return 'android';
  return 'desktop';
}
function isIosHomeScreenApp(): boolean {
  const agent = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && standalone;
}
export function SettingsPushNotificationsPanel() {
  const { locale } = useLanguage();
  const isEnglish = locale === 'en';
  const [state, setState] = useState<PushState>('loading');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = isEnglish ? {
    title: 'Push notifications',
    description: 'Receive important booking alerts even when the dashboard is closed.',
    enabled: 'Notifications are enabled on this device.',
    disabled: 'Notifications are not enabled on this device yet.',
    denied: 'Notifications are blocked in browser settings. Enable them there to continue.',
    unsupported: 'This browser or device does not support web push notifications.',
    install: 'On iPhone, add Silentra to the Home Screen and open it from its icon before enabling notifications. Safari tabs cannot receive iPhone web push.',
    setup: 'Push delivery is not configured on the server yet. Contact the Silentra team.',
    enable: 'Enable notifications', disable: 'Disable on this device', test: 'Send a test notification',
    testSent: 'Test notification sent.', enableFailed: 'Could not enable notifications. Please try again.',
    disableFailed: 'Could not disable notifications. Please try again.', testFailed: 'Could not send the test notification.',
    loading: 'Checking notification support…',
  } : {
    title: 'Notificações push',
    description: 'Recebe alertas importantes de marcações mesmo quando a dashboard está fechada.',
    enabled: 'As notificações estão ativas neste dispositivo.',
    disabled: 'Ainda não ativaste as notificações neste dispositivo.',
    denied: 'As notificações estão bloqueadas nas definições do browser. Ativa-as para continuar.',
    unsupported: 'Este browser ou dispositivo não suporta notificações push.',
    install: 'No iPhone, adiciona a Silentra ao ecrã principal e abre-a pelo respetivo ícone antes de ativar as notificações. Os separadores normais do Safari não recebem push no iPhone.',
    setup: 'O envio de notificações ainda não está configurado no servidor. Contacta a equipa Silentra.',
    enable: 'Ativar notificações', disable: 'Desativar neste dispositivo', test: 'Enviar notificação de teste',
    testSent: 'Notificação de teste enviada.', enableFailed: 'Não foi possível ativar as notificações. Tenta novamente.',
    disableFailed: 'Não foi possível desativar as notificações. Tenta novamente.', testFailed: 'Não foi possível enviar a notificação de teste.',
    loading: 'A verificar o suporte de notificações…',
  };
  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (getPlatform() === 'ios' && !isIosHomeScreenApp()) { setState('install-required'); return; }
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) { setState('unsupported'); return; }
    try {
      const response = await fetch('/api/notifications/push', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error('PUSH_STATUS_FAILED');
      setPublicKey(typeof result.publicKey === 'string' ? result.publicKey : null);
      if (!result.configured) setState('not-configured');
      else if (Notification.permission === 'denied') setState('denied');
      else {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        let subscribed = false;
        if (subscription) {
          const statusResponse = await fetch('/api/notifications/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status', endpoint: subscription.endpoint }),
          });
          const status = await statusResponse.json();
          if (!statusResponse.ok) throw new Error('PUSH_DEVICE_STATUS_FAILED');
          subscribed = status.subscribed === true;
        }
        setState(subscribed ? 'enabled' : 'disabled');
      }
    } catch { setState('error'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function enable() {
    if (!publicKey) { await refresh(); return; }
    setBusy(true);
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'disabled'); return; }
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), platform: getPlatform() }),
      });
      if (!response.ok) throw new Error('PUSH_SUBSCRIBE_FAILED');
      setState('enabled');
      toast.success(isEnglish ? 'Notifications enabled.' : 'Notificações ativadas.');
    } catch {
      setState('error');
      toast.error(copy.enableFailed);
    } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch('/api/notifications/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error('PUSH_UNSUBSCRIBE_FAILED');
        await subscription.unsubscribe();
      }
      setState('disabled');
      toast.success(isEnglish ? 'Notifications disabled on this device.' : 'Notificações desativadas neste dispositivo.');
    } catch { toast.error(copy.disableFailed); }
    finally { setBusy(false); }
  }
  async function sendTest() {
    setBusy(true);
    try {
      const response = await fetch('/api/notifications/push/test', { method: 'POST' });
      if (!response.ok) throw new Error('PUSH_TEST_FAILED');
      toast.success(copy.testSent);
    } catch { toast.error(copy.testFailed); }
    finally { setBusy(false); }
  }
  const statusText = state === 'loading' ? copy.loading
    : state === 'enabled' ? copy.enabled
    : state === 'disabled' ? copy.disabled
    : state === 'denied' ? copy.denied
    : state === 'unsupported' ? copy.unsupported
    : state === 'install-required' ? copy.install
    : state === 'not-configured' ? copy.setup
    : copy.enableFailed;
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8" aria-labelledby="push-settings-title">
      <Card className="border border-white/10 bg-white/[.02] text-zinc-50">
        <CardHeader>
          <CardTitle id="push-settings-title" className="flex items-center gap-2"><Bell className="size-5 text-violet-300" />{copy.title}</CardTitle>
          <CardDescription className="text-zinc-400">{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {state === 'enabled' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" /> : <Smartphone className="mt-0.5 size-5 shrink-0 text-zinc-400" />}
            <p className="text-sm leading-6 text-zinc-300">{statusText}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {state === 'disabled' || state === 'denied' || state === 'error' ? (
              <Button type="button" onClick={() => void enable()} disabled={busy || state === 'denied'}><Bell className="mr-2 size-4" />{copy.enable}</Button>
            ) : null}
            {state === 'enabled' ? (
              <>
                <Button type="button" onClick={() => void sendTest()} disabled={busy}>{copy.test}</Button>
                <Button type="button" variant="outline" onClick={() => void disable()} disabled={busy}><BellOff className="mr-2 size-4" />{copy.disable}</Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
