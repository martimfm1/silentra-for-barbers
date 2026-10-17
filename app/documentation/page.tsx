import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Database,
  FileCode2,
  Globe2,
  Layers3,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { SiteNavbar } from '@/components/site-navbar';
import { CopyCodeButton } from '@/components/documentation/copy-code-button';

export const metadata: Metadata = {
  title: 'Documentação da API pública | Silentra for Barbers',
  description:
    'Guia de integração da API pública Silentra for Barbers: pedidos, respostas JSON, exemplos, cache, limites e segurança.',
  alternates: {
    canonical: 'https://barbers.silentra.me/documentation',
  },
  openGraph: {
    title: 'Documentação da API pública | Silentra for Barbers',
    description:
      'Integra perfis públicos de barbearias, serviços, avaliações e links para marcações.',
    url: 'https://barbers.silentra.me/documentation',
    siteName: 'Silentra for Barbers',
    locale: 'pt_PT',
    type: 'website',
  },
};

const API_ORIGIN = 'https://barbers.silentra.me';
const ENDPOINT = API_ORIGIN + '/api/v1/public/barbershops/{slug}';

const curlExample = [
  'curl --include \\',
  '  --header "Accept: application/json" \\',
  '  "https://barbers.silentra.me/api/v1/public/barbershops/barbearia-exemplo"',
].join('\n');

const browserExample = [
  'const slug = "barbearia-exemplo";',
  'const url =',
  '  "https://barbers.silentra.me/api/v1/public/barbershops/" +',
  '  encodeURIComponent(slug);',
  '',
  'const response = await fetch(url, {',
  '  headers: { Accept: "application/json" }',
  '});',
  '',
  'if (!response.ok) {',
  '  const failure = await response.json().catch(() => ({}));',
  '  throw new Error(failure.error || "Não foi possível carregar a barbearia.");',
  '}',
  '',
  'const { data } = await response.json();',
  'console.log(data.barbershop.name);',
  'console.log(data.services);',
  'console.log(data.bookingUrl);',
].join('\n');

const nextExample = [
  'export async function getPublicBarbershop(slug: string) {',
  '  const url =',
  '    "https://barbers.silentra.me/api/v1/public/barbershops/" +',
  '    encodeURIComponent(slug);',
  '  const response = await fetch(url, {',
  '    headers: { Accept: "application/json" },',
  '    next: { revalidate: 60 }',
  '  });',
  '',
  '  if (!response.ok) {',
  '    throw new Error("API pública: HTTP " + response.status);',
  '  }',
  '',
  '  return response.json();',
  '}',
].join('\n');

const responseExample = [
  '{',
  '  "apiVersion": "1",',
  '  "data": {',
  '    "barbershop": {',
  '      "id": "public-barbershop-id",',
  '      "slug": "barbearia-exemplo",',
  '      "name": "Barbearia Exemplo",',
  '      "city": "Braga",',
  '      "address": "Rua Exemplo, 10",',
  '      "phone": "+351 200 000 000",',
  '      "avatarUrl": null,',
  '      "coverUrl": null,',
  '      "tags": ["clássica", "fade"],',
  '      "publicProfileEnabled": true,',
  '      "seo": { "title": null, "description": null, "imageUrl": null },',
  '      "amenities": {},',
  '      "openingHours": {',
  '        "opens": "09:00:00",',
  '        "closes": "19:00:00",',
  '        "lunchStarts": null,',
  '        "lunchEnds": null,',
  '        "closedDays": ""',
  '      }',
  '    },',
  '    "services": [',
  '      {',
  '        "id": "public-service-id",',
  '        "name": "Corte clássico",',
  '        "price": 15,',
  '        "currency": "EUR",',
  '        "durationMinutes": 30,',
  '        "popular": true',
  '      }',
  '    ],',
  '    "reviews": [',
  '      {',
  '        "id": "public-review-id",',
  '        "name": "Cliente",',
  '        "rating": 5,',
  '        "comment": "Excelente serviço.",',
  '        "createdAt": "2026-10-01T10:00:00.000Z"',
  '      }',
  '    ],',
  '    "rating": 4.8,',
  '    "reviewsCount": 28,',
  '    "bookingUrl": "https://barbers.silentra.me/barbershops/barbearia-exemplo",',
  '    "landingPage": {',
  '      "available": true,',
  '      "url": "https://barbers.silentra.me/site/barbearia-exemplo"',
  '    }',
  '  }',
  '}',
].join('\n');

const conditionalExample = [
  'curl --include \\',
  '  --header \'If-None-Match: "etag-recebido-anteriormente"\' \\',
  '  "https://barbers.silentra.me/api/v1/public/barbershops/barbearia-exemplo"',
].join('\n');

function CodePanel({
  title,
  language,
  code,
}: {
  title: string;
  language: string;
  code: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-200">{title}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            {language}
          </p>
        </div>
        <CopyCodeButton value={code} />
      </div>
      <pre className="max-w-full overflow-x-auto p-4 text-xs leading-6 text-zinc-300 sm:p-5 sm:text-[13px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

const sections = [
  { id: 'inicio', label: 'Primeiros passos' },
  { id: 'resposta', label: 'Estrutura da resposta' },
  { id: 'campos', label: 'Campos disponíveis' },
  { id: 'exemplos', label: 'Exemplos de integração' },
  { id: 'cache', label: 'Cache e desempenho' },
  { id: 'limites', label: 'Limites e erros' },
  { id: 'cors', label: 'CORS e browser' },
  { id: 'seguranca', label: 'Dados e segurança' },
  { id: 'enterprise', label: 'Landing page Enterprise' },
  { id: 'versoes', label: 'Versões e compatibilidade' },
];

const responseStatuses = [
  { status: '200', meaning: 'Dados públicos devolvidos.' },
  {
    status: '304',
    meaning: 'O ETag corresponde; a resposta não contém corpo.',
  },
  { status: '400', meaning: 'O slug tem um formato inválido.' },
  {
    status: '404',
    meaning: 'Perfil inexistente, indisponível ou não público.',
  },
  {
    status: '429',
    meaning: 'Limite de pedidos atingido; respeita Retry-After.',
  },
  { status: '500', meaning: 'Ocorreu um erro interno inesperado.' },
  { status: '503', meaning: 'Serviço temporariamente indisponível.' },
  { status: '204', meaning: 'Preflight OPTIONS aceite.' },
];

export default async function DocumentationPage() {
  const cookieStore = await cookies();
  const english = cookieStore.get('locale')?.value === 'en';
  const tr = (pt: string, en: string) => (english ? en : pt);
  const sectionLabels: Record<string, { pt: string; en: string }> = {
    inicio: { pt: 'Primeiros passos', en: 'Getting started' },
    resposta: { pt: 'Estrutura da resposta', en: 'Response structure' },
    campos: { pt: 'Campos disponíveis', en: 'Available fields' },
    exemplos: { pt: 'Exemplos de integração', en: 'Integration examples' },
    cache: { pt: 'Cache e desempenho', en: 'Caching and performance' },
    limites: { pt: 'Limites e erros', en: 'Rate limits and errors' },
    cors: { pt: 'CORS e browser', en: 'CORS and browsers' },
    seguranca: { pt: 'Dados e segurança', en: 'Data and security' },
    enterprise: { pt: 'Landing page Enterprise', en: 'Enterprise landing page' },
    versoes: { pt: 'Versões e compatibilidade', en: 'Versions and compatibility' },
  };
  const statusMeanings: Record<string, { pt: string; en: string }> = {
    '200': { pt: 'Dados públicos devolvidos.', en: 'Public data returned.' },
    '304': { pt: 'O ETag corresponde; a resposta não contém corpo.', en: 'The ETag matches; the response has no body.' },
    '400': { pt: 'O slug tem um formato inválido.', en: 'The slug has an invalid format.' },
    '404': { pt: 'Perfil inexistente, indisponível ou não público.', en: 'The profile does not exist, is unavailable, or is not public.' },
    '429': { pt: 'Limite de pedidos atingido; respeita Retry-After.', en: 'Rate limit reached; respect Retry-After.' },
    '500': { pt: 'Ocorreu um erro interno inesperado.', en: 'An unexpected internal error occurred.' },
    '503': { pt: 'Serviço temporariamente indisponível.', en: 'The service is temporarily unavailable.' },
    '204': { pt: 'Preflight OPTIONS aceite.', en: 'OPTIONS preflight accepted.' },
  };
  const localizedSections = sections.map((section) => ({
    ...section,
    label: sectionLabels[section.id]?.[english ? 'en' : 'pt'] ?? section.label,
  }));
  const localizedResponseStatuses = localizedResponseStatuses.map((item) => ({
    ...item,
    meaning: statusMeanings[item.status]?.[english ? 'en' : 'pt'] ?? item.meaning,
  }));
  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50 antialiased">
      <SiteNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(130deg,rgba(24,24,27,0.92),rgba(9,9,11,0.94))] p-5 sm:p-8 lg:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
          <div className="relative max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
              <BookOpen className="size-3.5" aria-hidden="true" />
              {tr('Recursos para programadores', 'Developer resources')}
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.03] tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              {tr('Documentação da API pública', 'Public API documentation')}
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              {tr('Integra perfis públicos, serviços, avaliações e ligações para marcações em websites e aplicações externas. Esta API é de consulta, não exige autenticação e disponibiliza apenas informação aprovada para publicação.', 'Integrate public barbershop profiles, services, reviews and booking links into external websites and apps. This read-only API requires no authentication and only returns information approved for publication.')}
            </p>
            <div className="mt-7 grid gap-2 sm:flex sm:flex-wrap">
              <a
                href="#inicio"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              >
                {tr('Começar a integrar', 'Start integrating')}{' '}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a
                href="/openapi-v1.yaml"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-5 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                OpenAPI 3.1 <FileCode2 className="size-4" aria-hidden="true" />
              </a>
              <a
                href="https://github.com/martimfm1/silentra-for-barbers/blob/main/docs/API_PUBLICA.md"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {tr('Guia no GitHub', 'Guide on GitHub')}{' '}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="relative mt-9 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: tr('Método', 'Method'), value: 'GET / OPTIONS', icon: Code2 },
              { label: tr('Autenticação', 'Authentication'), value: tr('Não necessária', 'Not required'), icon: Globe2 },
              {
                label: tr('Limite inicial', 'Initial rate limit'),
                value: '120 pedidos/min',
                icon: Timer,
              },
              { label: tr('Contrato', 'Contract'), value: 'API v1 · JSON', icon: Layers3 },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-xl bg-black/20 p-3"
              >
                <item.icon
                  className="mt-0.5 size-4 shrink-0 text-emerald-300"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-200">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
          <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.025] p-4 lg:sticky lg:top-28">
            <p className="px-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {tr('Nesta documentação', 'On this page')}
            </p>
            <nav
              aria-label={tr('Índice da documentação', 'Documentation index')}
              className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
            >
              {localizedSections.map((section, index) => (
                <a
                  key={section.id}
                  href={'#' + section.id}
                  className="flex shrink-0 items-center gap-3 rounded-lg px-2.5 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 lg:shrink"
                >
                  <span className="font-mono text-[10px] text-zinc-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{section.label}</span>
                </a>
              ))}
            </nav>
            <div className="mt-4 border-t border-white/10 pt-4">
              <a
                href="/openapi-v1.yaml"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/[0.06]"
              >
                <FileCode2 className="size-4" aria-hidden="true" />
                {tr('Descarregar especificação', 'Download specification')}
              </a>
              <a
                href="https://github.com/martimfm1/silentra-for-barbers"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                <ArrowUpRight className="size-4" aria-hidden="true" />
                {tr('Repositório GitHub', 'GitHub repository')}
              </a>
            </div>
          </aside>

          <article className="min-w-0 space-y-14">
            <section id="inicio" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('01 · Início rápido', '01 · Quick start')}
                title={tr('Faz o primeiro pedido', 'Make your first request')}
                description={tr('Usa o slug público da barbearia. Não precisas de criar uma conta técnica, enviar uma API key nem incluir credenciais na aplicação.', 'Use the barbershop’s public slug. You do not need a technical account or API key, and you must not embed credentials in your app.')}
              />
              <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {tr('URL base', 'Base URL')}
                </p>
                <p className="mt-1 break-all font-mono text-sm text-emerald-200">
                  {API_ORIGIN}
                </p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {tr('Recurso', 'Resource')}
                </p>
                <p className="mt-1 break-all font-mono text-sm text-zinc-200">
                  {ENDPOINT}
                </p>
              </div>
              <CodePanel
                title={tr('Primeiro pedido', 'First request')}
                language="bash"
                code={curlExample}
              />
              <p className="mt-3 text-xs leading-6 text-zinc-500">
                {tr('No exemplo, substitui', 'In the example, replace')}{' '}
                <code className="rounded bg-white/[0.06] px-1 py-0.5 text-zinc-300">
                  barbearia-exemplo
                </code>
                {tr('pelo slug real. O slug deve ter entre 3 e 60 caracteres, usando letras minúsculas, números e hífen.', 'with the actual slug. It must contain 3–60 characters, using lowercase letters, numbers and hyphens.')}
              </p>
            </section>

            <section id="resposta" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('02 · Contrato', '02 · Response contract')}
                title={tr('Estrutura da resposta', 'Response structure')}
                description={tr('A resposta de sucesso usa sempre apiVersion e data. Os identificadores do exemplo são ilustrativos; alguns campos podem ser null quando a barbearia não os preencheu.', 'A successful response always includes apiVersion and data. The identifiers are illustrative; some fields may be null when the barbershop has not provided them.')}
              />
              <CodePanel
                title="Exemplo JSON"
                language="json"
                code={responseExample}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">barbershop</p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Perfil público, contactos comerciais, imagens, etiquetas, SEO, comodidades e horário.', 'Public profile, business contact details, images, tags, SEO, amenities and opening hours.')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">services</p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Até 100 serviços, com preço em EUR, duração e indicação de popularidade.', 'Up to 100 services, including EUR price, duration and popularity.')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">reviews</p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Até 100 avaliações recentes. O total agregado pode ser superior à lista devolvida.', 'Up to 100 recent reviews. The aggregate total may exceed the returned list.')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">
                    bookingUrl / landingPage
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Links absolutos para marcações e, quando elegível, para a landing page Enterprise.', 'Absolute links for bookings and, when eligible, the Enterprise landing page.')}
                  </p>
                </div>
              </div>
            </section>

            <section id="campos" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('03 · Referência', '03 · Field reference')}
                title={tr('Campos disponíveis', 'Available fields')}
                description={tr('Consome apenas os campos de que precisas e trata os valores opcionais sem assumir que existem em todos os perfis.', 'Only use the fields you need, and handle optional values without assuming they exist in every profile.')}
              />
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">{tr('Campo', 'Field')}</th>
                      <th className="px-4 py-3 font-medium">{tr('Tipo', 'Type')}</th>
                      <th className="px-4 py-3 font-medium">{tr('Descrição', 'Description')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-zinc-400">
                    {[
                      [
                        'barbershop.id / slug / name',
                        'string',
                        tr('Identificação pública e nome da barbearia.', 'Public identifier and barbershop name.'),
                      ],
                      [
                        'barbershop.city / address / phone',
                        'string | null',
                        tr('Dados de contacto comercial públicos.', 'Public business contact details.'),
                      ],
                      [
                        'barbershop.avatarUrl / coverUrl',
                        'URL | null',
                        tr('Imagens públicas do perfil.', 'Public profile images.'),
                      ],
                      [
                        'barbershop.tags',
                        'string[]',
                        tr('Etiquetas públicas do perfil.', 'Public profile tags.'),
                      ],
                      [
                        'barbershop.seo',
                        'object',
                        tr('title, description e imageUrl, quando definidos.', 'title, description and imageUrl, when set.'),
                      ],
                      [
                        'barbershop.amenities',
                        'object',
                        tr('Comodidades públicas normalizadas.', 'Normalized public amenities.'),
                      ],
                      [
                        'barbershop.openingHours',
                        'object',
                        tr('Abertura, fecho, pausa de almoço e dias fechados.', 'Opening, closing, lunch break and closed days.'),
                      ],
                      [
                        'services[]',
                        'array',
                        tr('Até 100 serviços, ordenados por popularidade e nome.', 'Up to 100 services, sorted by popularity and name.'),
                      ],
                      ['reviews[]', 'array', tr('Até 100 avaliações recentes.', 'Up to 100 recent reviews.')],
                      [
                        'rating / reviewsCount',
                        'number / integer',
                        tr('Classificação e contagem agregadas, quando disponíveis.', 'Aggregate rating and count, when available.'),
                      ],
                      [
                        'bookingUrl',
                        'URL',
                        tr('Ligação pública para consultar e marcar.', 'Public link to view details and book.'),
                      ],
                      [
                        'landingPage.available / url',
                        'boolean / URL | null',
                        tr('Disponibilidade da landing page Enterprise.', 'Enterprise landing page availability.'),
                      ],
                    ].map((row) => (
                      <tr key={row[0]}>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-200">
                          {row[0]}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-emerald-200">
                          {row[1]}
                        </td>
                        <td className="px-4 py-3 leading-5">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="exemplos" className="scroll-mt-28 space-y-5">
              <SectionTitle
                eyebrow={tr('04 · Integração', '04 · Integration examples')}
                title={tr('Exemplos prontos a adaptar', 'Examples you can adapt')}
                description={tr('Todos os exemplos verificam o status HTTP antes de usar o corpo da resposta. Os botões permitem copiar o código diretamente.', 'Every example checks the HTTP status before reading the response body. Use the buttons to copy the code.')}
              />
              <CodePanel
                title={tr('JavaScript — browser ou Node.js', 'JavaScript — browser or Node.js')}
                language="javascript"
                code={browserExample}
              />
              <CodePanel
                title={tr('Next.js — consulta no servidor', 'Next.js — server-side request')}
                language="typescript"
                code={nextExample}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm font-semibold text-zinc-200">
                  {tr('Dica para integrações públicas', 'Tip for public integrations')}
                </p>
                <p className="mt-2 text-xs leading-6 text-zinc-400">
                  {tr('Se apresentares os dados no browser, usa textContent ou o mecanismo de escape do teu framework para mostrar conteúdo textual. Não transformes comentários de avaliações em HTML executável.', 'When displaying data in the browser, use textContent or your framework’s escaping mechanism for text. Never turn review comments into executable HTML.')}
                </p>
              </div>
            </section>

            <section id="cache" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('05 · Performance', '05 · Performance')}
                title={tr('Cache HTTP e ETag', 'HTTP caching and ETags')}
                description={tr('A API suporta cache partilhada para reduzir latência e carga. O conteúdo é público e pode ficar temporariamente desatualizado.', 'The API supports shared caching to reduce latency and load. The content is public and may be temporarily stale.')}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: tr('60 segundos', '60 seconds'), label: 'CDN cache (s-maxage)' },
                  {
                    value: tr('300 segundos', '300 seconds'),
                    label: 'stale-while-revalidate window',
                  },
                  { value: 'SHA-256', label: 'JSON representation ETag' },
                  {
                    value: '304',
                    label: tr('Resposta sem corpo quando não há alterações', 'Bodyless response when nothing has changed'),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                  >
                    <p className="text-xl font-semibold tracking-tight text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                {tr('Guarda o ETag recebido e envia-o no cabeçalho If-None-Match do próximo pedido. Se receberes 304, reutiliza a resposta guardada; não tentes ler JSON de uma resposta sem corpo.', 'Store the ETag and send it in the If-None-Match header on the next request. If you receive 304, reuse the cached response; do not try to parse JSON from an empty response.')}
              </p>
              <div className="mt-4">
                <CodePanel
                  title={tr('Pedido condicional', 'Conditional request')}
                  language="bash"
                  code={conditionalExample}
                />
              </div>
            </section>

            <section id="limites" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('06 · Resiliência', '06 · Reliability')}
                title={tr('Limites e erros HTTP', 'Rate limits and HTTP errors')}
                description={tr('Usa o código HTTP para gerir os fluxos. A mensagem dentro de error é destinada a diagnóstico e pode evoluir sem alterar o contrato.', 'Use the HTTP status to control your flow. The error message is for diagnostics and may change without changing the API contract.')}
              />
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[440px] border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">HTTP</th>
                      <th className="px-4 py-3 font-medium">{tr('Significado', 'Meaning')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-zinc-400">
                    {responseStatuses.map((item) => (
                      <tr key={item.status}>
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-200">
                          {item.status}
                        </td>
                        <td className="px-4 py-3 leading-5">{item.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-xl border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <Timer
                    className="size-4 text-emerald-300"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-zinc-200">
                    {tr('120 pedidos por minuto', '120 requests per minute')}
                  </p>
                </div>
                <p className="mt-2 text-xs leading-6 text-zinc-400">
                  {tr('O limite inicial é aplicado por IP, recurso e slug. Uma resposta 429 inclui Retry-After. Faz espera progressiva e respeita esse cabeçalho em vez de repetir imediatamente.', 'The initial limit applies per IP, resource and slug. A 429 response includes Retry-After. Use progressive backoff and respect the header instead of retrying immediately.')}
                </p>
              </div>
            </section>

            <section id="cors" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('07 · Browser', '07 · Browsers')}
                title={tr('CORS', 'CORS')}
                description={tr('O recurso foi concebido para leitura a partir de websites externos, sem cookies nem credenciais cross-origin.', 'This resource is designed to be read by external websites without cookies or cross-origin credentials.')}
              />
              <div className="overflow-hidden rounded-2xl border border-white/10">
                {[
                  ['Access-Control-Allow-Origin', '*'],
                  ['Access-Control-Allow-Methods', 'GET, OPTIONS'],
                  ['Access-Control-Allow-Headers', 'Accept, If-None-Match'],
                  ['Access-Control-Max-Age', '86400'],
                  ['X-API-Version', '1'],
                  ['X-Content-Type-Options', 'nosniff'],
                ].map(([name, value]) => (
                  <div
                    key={name}
                    className="grid gap-1 border-b border-white/[0.06] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
                  >
                    <code className="break-all text-[11px] text-zinc-300">
                      {name}
                    </code>
                    <code className="break-all text-[11px] text-emerald-200">
                      {value}
                    </code>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-zinc-500">
                {tr('CORS é uma política do browser; não impede chamadas feitas por servidores ou scripts fora do browser. A proteção de abuso é aplicada separadamente por rate limiting.', 'CORS is a browser policy; it does not prevent requests from servers or scripts outside the browser. Abuse prevention is handled separately through rate limiting.')}
              </p>
            </section>

            <section id="seguranca" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('08 · Privacidade', '08 · Privacy')}
                title={tr('Que dados são expostos?', 'What data is exposed?')}
                description={tr('A resposta limita-se à informação aprovada para publicação no perfil. A API não permite consultar ou modificar dados privados da conta.', 'The response is limited to information approved for public display. The API cannot read or modify private account data.')}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-zinc-100">
                      {tr('Incluído', 'Included')}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Perfil público, contactos comerciais publicados, serviços, preços, horário, avaliações públicas e links públicos.', 'Public profile, published business contacts, services, prices, opening hours, public reviews and public links.')}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="size-4 text-zinc-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-zinc-100">
                      {tr('Nunca incluído neste contrato', 'Never included in this API contract')}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    {tr('Email de proprietário, IDs de utilizadores, clientes, marcações, faturas, tokens, secrets, notas internas e chaves de integração.', 'Owner email, user IDs, customer records, bookings, invoices, tokens, secrets, internal notes and integration keys.')}
                  </p>
                </div>
              </div>
            </section>

            <section id="enterprise" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('09 · Enterprise', '09 · Enterprise')}
                title={tr('Landing page incluída no Enterprise', 'Landing page included with Enterprise')}
                description={tr('A API devolve o endereço público da landing page apenas quando o plano efetivo e o entitlement da página estão ativos.', 'The API returns the public landing page URL only while the active plan and page entitlement are valid.')}
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-start gap-3">
                  <Database
                    className="mt-0.5 size-5 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {tr('Ligação automática ao perfil', 'Connected to the public profile')}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      {tr('A página usa o perfil e o catálogo de serviços existente. Não é necessário criar uma segunda conta nem manter os serviços em duplicado. Se o acesso Enterprise terminar, a página é suspensa e a API deixa de a anunciar como disponível.', 'The page uses the existing profile and service catalogue. There is no need for a second account or duplicate service records. If Enterprise access ends, the page is suspended and the API stops reporting it as available.')}
                    </p>
                    <p className="mt-3 break-all font-mono text-xs text-emerald-200">
                      https://barbers.silentra.me/site/{'{slug}'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section id="versoes" className="scroll-mt-28">
              <SectionTitle
                eyebrow={tr('10 · Compatibilidade', '10 · Compatibility')}
                title={tr('Versões e evolução', 'Versions and evolution')}
                description={tr('O caminho /api/v1 identifica a versão principal do contrato. A versão 1 é de leitura e foi desenhada para ser tolerante a campos adicionais.', 'The /api/v1 path identifies the major contract version. Version 1 is read-only and designed to tolerate additional fields.')}
              />
              <div className="space-y-3 text-sm leading-7 text-zinc-400">
                <p>
                  {tr('Ignora campos adicionais que não utilizes e trata campos opcionais como null. Valida sempre o código HTTP antes de ler o corpo.', 'Ignore additional fields you do not use and treat optional fields as null. Always check the HTTP status before reading the body.')}
                </p>
                <p>
                  {tr('Mudanças incompatíveis serão publicadas numa nova versão principal, em vez de serem introduzidas silenciosamente na v1.', 'Breaking changes will be released in a new major version instead of being introduced silently into v1.')}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="/openapi-v1.yaml"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  <FileCode2 className="size-4" aria-hidden="true" />
                  {tr('Especificação OpenAPI', 'OpenAPI specification')}{' '}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/martimfm1/silentra-for-barbers/blob/main/docs/API_PUBLICA.md"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  {tr('Guia completo no GitHub', 'Full guide on GitHub')}{' '}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </section>

            <section className="border-t border-white/10 pt-8">
              <p className="text-sm font-semibold text-white">
                {tr('Pronto para integrar?', 'Ready to integrate?')}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {tr('Começa com uma única barbearia, valida os estados de erro e ativa cache antes de escalar a frequência dos pedidos.', 'Start with a single barbershop, test error states and enable caching before increasing request volume.')}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/barbershops"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  {tr('Explorar barbearias', 'Browse barbershops')}{' '}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  {tr('Consultar planos', 'View plans')}{' '}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </article>
        </div>

        <footer className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Silentra for Barbers · {tr('Documentação API v1', 'Public API documentation v1')}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="transition hover:text-zinc-300">
              {tr('Privacidade', 'Privacy')}
            </Link>
            <Link href="/terms" className="transition hover:text-zinc-300">
              {tr('Termos', 'Terms')}
            </Link>
            <a
              href="https://github.com/martimfm1/silentra-for-barbers"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-zinc-300"
            >
              GitHub
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
