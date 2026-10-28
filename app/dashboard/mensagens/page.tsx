'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Phone,
  Send,
  Smartphone,
  Eye,
  ShieldCheck,
  Cake,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';

interface Client {
  id: string;
  name_complete?: string | null;
  name?: string | null;
  email?: string | null;
  num_phone?: string | null;
}

const templatesByLocale = {
  pt: {
    reminder: {
      label: 'Lembrete de marcação',
      subject: 'Lembrete da sua marcação',
      body: 'Olá {{nome}},\\n\\nEstamos a enviar-lhe um lembrete da sua próxima marcação na {{barbearia}}.\\n\\nSe precisar de alterar a marcação, entre em contacto connosco.\\n\\nObrigado,\\n{{barbearia}}',
    },
    thanks: {
      label: 'Obrigado pela visita',
      subject: 'Obrigado pela sua visita',
      body: 'Olá {{nome}},\\n\\nObrigado por visitar a {{barbearia}}. Esperamos voltar a recebê-lo em breve.\\n\\nAté à próxima!\\n{{barbearia}}',
    },
    custom: {
      label: 'Mensagem personalizada',
      subject: '',
      body: 'Olá {{nome}},\\n\\n',
    },
  },
  en: {
    reminder: {
      label: 'Appointment reminder',
      subject: 'Your appointment reminder',
      body: 'Hi {{nome}},\\n\\nThis is a reminder of your upcoming appointment at {{barbearia}}.\\n\\nPlease contact us if you need to change your booking.\\n\\nThank you,\\n{{barbearia}}',
    },
    thanks: {
      label: 'Thank you for visiting',
      subject: 'Thank you for your visit',
      body: 'Hi {{nome}},\\n\\nThank you for visiting {{barbearia}}. We look forward to seeing you again soon.\\n\\nSee you next time!\\n{{barbearia}}',
    },
    custom: {
      label: 'Custom message',
      subject: '',
      body: 'Hi {{nome}},\\n\\n',
    },
  },
} as const;

type TemplateKey = keyof typeof templatesByLocale.pt;

const pageCopy = {
  pt: {
    communication: 'Comunicação', title: 'Mensagens',
    intro: 'Envia emails personalizados aos teus clientes sem complicar o processo.',
    birthdays: 'Aniversários', secureEmail: 'Email seguro',
    birthdayAutomation: 'Automação de aniversários',
    birthdayDescription: 'Transforma uma data importante numa oportunidade de voltar a contactar o cliente.',
    manageAutomation: 'Gerir automação', newMessage: 'Nova mensagem',
    newMessageDescription: 'Escolhe um cliente, usa um modelo e ajusta apenas o necessário.',
    recipient: 'Destinatário', loadingClients: 'A carregar clientes…',
    chooseClient: 'Selecionar cliente', customer: 'Cliente',
    subject: 'Assunto', subjectHint: 'Um assunto curto torna a mensagem mais fácil de compreender.',
    message: 'Mensagem', availableVariables: 'Variáveis disponíveis:',
    clientMissingEmail: 'Este cliente não tem email registado. Escolhe outro cliente ou atualiza o contacto primeiro.',
    sending: 'A enviar…', sendEmail: 'Enviar email',
    previewAria: 'Pré-visualização da mensagem', preview: 'Pré-visualização',
    previewDescription: 'Vê o resultado final antes de enviar.', to: 'para',
    sampleEmail: 'cliente@exemplo.pt', noSubject: 'Sem assunto',
    messagePlaceholder: 'A tua mensagem aparecerá aqui.', phone: 'Telemóvel',
    smsDescription: 'O envio manual por SMS está temporariamente desativado.',
    disabled: 'Desativado',
    smsEnableDescription: 'Quando o serviço SMS for ativado, esta área poderá ser disponibilizada sem alterar o compositor de email.',
    sendSms: 'Enviar SMS', fallbackShop: 'a tua barbearia',
    customerName: 'Nome do cliente', selectClient: 'Seleciona um cliente.',
    noEmail: 'O cliente selecionado não tem email.',
    requiredMessage: 'Preenche o assunto e a mensagem.',
    loadClientsFailed: 'Não foi possível carregar os clientes.',
    loadDataFailed: 'Ocorreu um erro ao carregar os dados.',
    emailSendFailed: 'Não foi possível enviar o email.',
    emailSent: 'Email enviado com sucesso.',
    sendError: 'Ocorreu um erro ao enviar o email.',
    template: 'Modelo',
  },
  en: {
    communication: 'Communication', title: 'Messages',
    intro: 'Send personalised emails to your clients without making the process complicated.',
    birthdays: 'Birthdays', secureEmail: 'Secure email',
    birthdayAutomation: 'Birthday automation',
    birthdayDescription: 'Turn an important date into an opportunity to reconnect with a client.',
    manageAutomation: 'Manage automation', newMessage: 'New message',
    newMessageDescription: 'Choose a client, use a template and adjust only what you need.',
    recipient: 'Recipient', loadingClients: 'Loading clients…',
    chooseClient: 'Select a client', customer: 'Client',
    subject: 'Subject', subjectHint: 'A short subject makes your message easier to understand.',
    message: 'Message', availableVariables: 'Available variables:',
    clientMissingEmail: 'This client has no email address on record. Choose another client or update the contact first.',
    sending: 'Sending…', sendEmail: 'Send email',
    previewAria: 'Message preview', preview: 'Preview',
    previewDescription: 'Review the final result before sending.', to: 'to',
    sampleEmail: 'client@example.com', noSubject: 'No subject',
    messagePlaceholder: 'Your message will appear here.', phone: 'Mobile phone',
    smsDescription: 'Manual SMS sending is temporarily disabled.',
    disabled: 'Disabled',
    smsEnableDescription: 'When SMS service is enabled, this area can be made available without changing the email composer.',
    sendSms: 'Send SMS', fallbackShop: 'your barbershop',
    customerName: 'Client name', selectClient: 'Select a client.',
    noEmail: 'The selected client does not have an email address.',
    requiredMessage: 'Enter both a subject and a message.',
    loadClientsFailed: 'Could not load clients.',
    loadDataFailed: 'An error occurred while loading the data.',
    emailSendFailed: 'Could not send the email.',
    emailSent: 'Email sent successfully.',
    sendError: 'An error occurred while sending the email.',
    template: 'Template',
  },
} as const;

export default function MensagensPage() {
  const { locale } = useLanguage();
  const english = locale === 'en';
  const templates = templatesByLocale[english ? 'en' : 'pt'];
  const copy = pageCopy[english ? 'en' : 'pt'];
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [template, setTemplate] = useState<TemplateKey>('reminder');
  const [subject, setSubject] = useState<string>(templates.reminder.subject);
  const [body, setBody] = useState<string>(templates.reminder.body);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [shopName, setShopName] = useState<string>('');
  const { barbershopId } = useBarbershop();

  useEffect(() => {
    const loadData = async () => {
      try {
        const clientsResponse = await fetch('/api/crm/clients?limit=100', {
          cache: 'no-store',
        });
        const clientsData = await clientsResponse.json();
        if (!clientsResponse.ok)
          throw new Error(
            copy.loadClientsFailed,
          );
        setClients(clientsData.clients ?? []);

        if (barbershopId) {
          const shopResponse = await fetch(`/api/barbershops/${barbershopId}`, {
            cache: 'no-store',
          });
          if (shopResponse.ok) {
            const shopData = await shopResponse.json();
            if (shopData.name) setShopName(shopData.name);
          }
        }
      } catch (error) {
        toast.error(
          copy.loadDataFailed,
        );
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [barbershopId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clients, clientId],
  );

  const applyTemplate = (next: TemplateKey) => {
    setTemplate(next);
    setSubject(templates[next].subject);
    setBody(templates[next].body);
  };

  const preview = body
    .replaceAll(
      '{{nome}}',
      selectedClient?.name_complete ||
        selectedClient?.name ||
        'Nome do cliente',
    )
    .replaceAll('{{barbearia}}', shopName || copy.fallbackShop);

  const sendEmail = async () => {
    if (!clientId) return toast.error(copy.selectClient);
    if (!selectedClient?.email)
      return toast.error(copy.noEmail);
    if (!subject.trim() || !body.trim())
      return toast.error(copy.requiredMessage);

    setSending(true);
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          template,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(copy.emailSendFailed);
      toast.success(copy.emailSent);
    } catch (error) {
      toast.error(
        copy.sendError,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="dashboard-page min-h-screen px-4 pb-24 pt-24 text-foreground sm:px-6 lg:px-8 lg:pt-10">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="dashboard-page-header border-b border-white/10 pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
              <Mail className="size-4" aria-hidden="true" /> {copy.communication}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              {copy.intro}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="min-h-11 border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10"
            >
              <Link href="/dashboard/mensagens/birthdays">
                <Cake className="mr-2 size-4" />
                {copy.birthdays}
                <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </Button>
            <Badge
              variant="secondary"
              className="w-fit gap-1.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {copy.secureEmail}
            </Badge>
          </div>
        </header>

        <Card className="overflow-hidden border-amber-500/15 bg-amber-500/[0.04]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300">
                <Cake className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {copy.birthdayAutomation}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {copy.birthdayDescription}
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="shrink-0 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
            >
              <Link href="/dashboard/mensagens/birthdays">
                {copy.manageAutomation}
                <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="dashboard-card min-w-0 border-white/10 bg-white/[0.03]">
            <CardHeader className="border-b border-white/10 pb-5">
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Mail className="size-5 text-emerald-400" aria-hidden="true" />
                {copy.newMessage}
              </CardTitle>
              <CardDescription>
                {copy.newMessageDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="client">{copy.recipient}</Label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={loading}
                >
                  <SelectTrigger
                    id="client"
                    className="min-h-11 w-full bg-black/20"
                  >
                    <SelectValue
                      placeholder={
                        loading ? copy.loadingClients : copy.chooseClient
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients
                      .filter((client) => client.email)
                      .map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name_complete || client.name || copy.customer} —{' '}
                          {client.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="template">{copy.template}</Label>
                  <Select
                    value={template}
                    onValueChange={(value) =>
                      applyTemplate(value as TemplateKey)
                    }
                  >
                    <SelectTrigger
                      id="template"
                      className="min-h-11 bg-black/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(templates).map(([key, item]) => (
                        <SelectItem key={key} value={key}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="subject">{copy.subject}</Label>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {subject.length}/180
                    </span>
                  </div>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    maxLength={180}
                    className="min-h-11 bg-black/20"
                  />
                  <p className="text-xs text-zinc-500">
                    {copy.subjectHint}
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="body">{copy.message}</Label>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {body.length}/8000
                    </span>
                  </div>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={8000}
                    className="min-h-56 resize-y bg-black/20 leading-6"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{copy.availableVariables}</span>
                    <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                      {'{{nome}}'}
                    </code>
                    <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                      {'{{barbearia}}'}
                    </code>
                  </div>
                </div>
              </div>
              {selectedClient && !selectedClient.email && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300"
                >
                  {copy.clientMissingEmail}
                </div>
              )}
              <Button
                type="button"
                onClick={sendEmail}
                disabled={sending || !clientId || !selectedClient?.email}
                className="min-h-11 w-full sm:w-auto"
              >
                <Send className="mr-2 size-4" aria-hidden="true" />
                {sending ? copy.sending : copy.sendEmail}
              </Button>
            </CardContent>
          </Card>

          <aside
            className="space-y-5"
            aria-label={copy.previewAria}
          >
            <Card className="dashboard-card overflow-hidden border-white/10 bg-white/[0.03]">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="size-4 text-emerald-400" aria-hidden="true" />
                  {copy.preview}
                </CardTitle>
                <CardDescription>
                  {copy.previewDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-xl">
                  <div className="border-b border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <Mail className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">
                          {shopName}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {copy.to} {selectedClient?.email || copy.sampleEmail}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 break-words text-sm font-semibold text-zinc-100">
                      {subject || copy.noSubject}
                    </p>
                  </div>
                  <div className="min-h-48 p-4 sm:p-5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                      {preview || copy.messagePlaceholder}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="dashboard-card border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Smartphone className="size-4" aria-hidden="true" />
                  {copy.phone}
                </CardTitle>
                <CardDescription>
                  {copy.smsDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-white/10 bg-zinc-950/60 p-4">
                  <Badge variant="secondary" className="mb-3">
                    {copy.disabled}
                  </Badge>
                  <p className="text-sm leading-6 text-zinc-400">
                    {copy.smsEnableDescription}
                  </p>
                  <Button
                    type="button"
                    disabled
                    className="mt-4 min-h-11 w-full"
                  >
                    <Phone className="mr-2 size-4" aria-hidden="true" />
                    {copy.sendSms}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
