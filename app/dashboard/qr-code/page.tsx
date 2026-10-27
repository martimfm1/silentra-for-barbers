'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Printer, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { ManagementPageHeader } from '@/app/dashboard/_components/shared/ManagementPageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/context/LanguageContext';

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

export default function QrCodePage() {
  const { t } = useLanguage();
  const defaultText = t('qrCodePage.defaultText');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('Barbearia');
  const [text, setText] = useState(defaultText);
  const [savedText, setSavedText] = useState(defaultText);
  const [png, setPng] = useState('');
  const [svg, setSvg] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const publicUrl = useMemo(() => {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window === 'undefined' ? '' : window.location.origin);
    return slug && origin
      ? `${origin.replace(/\/$/, '')}/barbershops/${encodeURIComponent(slug)}`
      : '';
  }, [slug]);
  useEffect(() => {
    fetch('/api/barbershops/qr-code', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{
          slug: string;
          name: string;
          text: string;
        }>;
      })
      .then((data) => {
        setSlug(data.slug);
        setName(data.name);
        setText(data.text);
        setSavedText(data.text);
      })
      .catch(() => toast.error(t('qrCodePage.loadError')))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(() => {
    if (!publicUrl) return;
    void Promise.all([
      QRCode.toDataURL(publicUrl, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M',
      }),
      QRCode.toString(publicUrl, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'M',
      }),
    ]).then(([nextPng, nextSvg]) => {
      setPng(nextPng);
      setSvg(nextSvg);
    });
  }, [publicUrl]);
  const saveText = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/barbershops/qr-code', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { text: string };
      setText(data.text);
      setSavedText(data.text);
      toast.success(t('qrCodePage.saveSuccess'));
    } catch {
      toast.error(t('qrCodePage.saveError'));
    } finally {
      setSaving(false);
    }
  };
  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success(t('qrCodePage.copiedUrl'));
  };
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: name, text, url: publicUrl });
    } else {
      await copyUrl();
    }
  };
  const print = () => {
    const page = window.open('about:blank', '_blank');
    if (!page) return toast.error(t('qrCodePage.popupError'));

    page.opener = null;
    const doc = page.document;
    doc.title = t('qrCodePage.documentTitle', { name });

    const styles = doc.createElement('style');
    styles.textContent = `
      @page { margin: 12mm; }
      body {
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        font-family: Arial, sans-serif;
      }
      main {
        padding: 36px;
        border: 1px solid #ddd;
        border-radius: 16px;
        text-align: center;
      }
      img {
        width: 360px;
        max-width: 80vw;
      }
      p {
        overflow-wrap: anywhere;
      }
    `;
    doc.head.append(styles);

    const main = doc.createElement('main');
    const heading = doc.createElement('h1');
    heading.textContent = name;

    const image = doc.createElement('img');
    image.src = png;
    image.alt = t('qrCodePage.qrAlt');

    const paragraph = doc.createElement('p');
    paragraph.textContent = text;

    const url = doc.createElement('small');
    url.textContent = publicUrl;

    main.append(heading, image, paragraph, url);
    doc.body.append(main);

    let printStarted = false;
    const printPage = () => {
      if (printStarted) return;
      printStarted = true;
      page.print();
    };
    image.addEventListener('load', printPage, { once: true });
    image.addEventListener('error', printPage, { once: true });
    if (image.complete) page.setTimeout(printPage, 0);
  };
  return (
    <main className="dashboard-page py-6 sm:py-8 mt-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ManagementPageHeader
          icon={QrCode}
          eyebrow={t('qrCodePage.kicker')}
          title={t('qrCodePage.title')}
          description={t('qrCodePage.description')}
          accentClassName="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        />
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[420px]" />
            <Skeleton className="h-[420px]" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardContent className="p-6 sm:p-8">
                  <div className="mx-auto max-w-sm rounded-2xl bg-white p-5">
                    <p className="text-center text-sm font-semibold text-zinc-900">
                      {name}
                    </p>
                    <img
                      src={png}
                      alt={t('qrCodePage.previewAlt')}
                      className="mt-3 aspect-square w-full"
                    />
                    <p className="mt-4 text-center text-base font-semibold text-zinc-900">
                      {text || defaultText}
                    </p>
                    <p className="mt-2 break-all text-center text-xs text-zinc-500">
                      {publicUrl}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t('qrCodePage.pageTitle')}</CardTitle>
                  <CardDescription>
                    {t('qrCodePage.pageDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="silentra-form-field">
                    <label htmlFor="qr-url">{t('qrCodePage.publicUrl')}</label>
                    <div className="flex gap-2">
                      <Input id="qr-url" value={publicUrl} readOnly />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => void copyUrl()}
                        aria-label={t('qrCodePage.copyUrl')}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="silentra-form-field">
                    <label htmlFor="qr-text">{t('qrCodePage.adjacentText')}</label>
                    <Input
                      id="qr-text"
                      value={text}
                      maxLength={160}
                      onChange={(event) => setText(event.target.value)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('qrCodePage.previewPrintHint')}</span>
                      <span>{text.length}/160</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void saveText()}
                    disabled={saving || text === savedText}
                  >
                    {saving ? (
                      t('qrCodePage.saving')
                    ) : (
                      <>
                        <Check className="size-4" />
                        {t('qrCodePage.saveText')}
                      </>
                    )}
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => download(png, `${slug}-qr-code.png`)}
                    >
                      <Download className="size-4" />
                      {t('qrCodePage.downloadPng')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        download(
                          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
                          `${slug}-qr-code.svg`,
                        )
                      }
                    >
                      <Download className="size-4" />
                      {t('qrCodePage.downloadSvg')}
                    </Button>
                    <Button type="button" variant="outline" onClick={print}>
                      <Printer className="size-4" />
                      {t('qrCodePage.print')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void share()}
                    >
                      <Share2 className="size-4" />
                      {t('qrCodePage.share')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card size="sm">
              <CardHeader>
                <CardTitle>{t('qrCodePage.howToUse')}</CardTitle>
                <CardDescription>
                  Coloca o QR na rececao, em cartoes, junto aos espelhos ou nas
                  redes sociais para levar clientes diretamente ao agendamento.
                </CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
