import type { Metadata } from 'next';
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

export default function DocumentationPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-zinc-950 text-zinc-50 antialiased">
      <SiteNavbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(130deg,rgba(24,24,27,0.92),rgba(9,9,11,0.94))] p-5 sm:p-8 lg:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
          <div className="relative max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
              <BookOpen className="size-3.5" aria-hidden="true" />
              Developer resources
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.03] tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              Documentação da API pública
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Integra perfis públicos, serviços, avaliações e ligações para
              marcações em websites e aplicações externas. Esta API é de
              consulta, não exige autenticação e disponibiliza apenas informação
              aprovada para publicação.
            </p>
            <div className="mt-7 grid gap-2 sm:flex sm:flex-wrap">
              <a
                href="#inicio"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
              >
                Começar a integrar{' '}
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
                Guia no GitHub{' '}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="relative mt-9 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Método', value: 'GET / OPTIONS', icon: Code2 },
              { label: 'Autenticação', value: 'Não necessária', icon: Globe2 },
              {
                label: 'Limite inicial',
                value: '120 pedidos/min',
                icon: Timer,
              },
              { label: 'Contrato', value: 'API v1 · JSON', icon: Layers3 },
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
              Nesta documentação
            </p>
            <nav
              aria-label="Índice da documentação"
              className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
            >
              {sections.map((section, index) => (
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
                Descarregar especificação
              </a>
              <a
                href="https://github.com/martimfm1/silentra-for-barbers"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                <ArrowUpRight className="size-4" aria-hidden="true" />
                Repositório GitHub
              </a>
            </div>
          </aside>

          <article className="min-w-0 space-y-14">
            <section id="inicio" className="scroll-mt-28">
              <SectionTitle
                eyebrow="01 · Início rápido"
                title="Faz o primeiro pedido"
                description="Usa o slug público da barbearia. Não precisas de criar uma conta técnica, enviar uma API key nem incluir credenciais na aplicação."
              />
              <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  URL base
                </p>
                <p className="mt-1 break-all font-mono text-sm text-emerald-200">
                  {API_ORIGIN}
                </p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Recurso
                </p>
                <p className="mt-1 break-all font-mono text-sm text-zinc-200">
                  {ENDPOINT}
                </p>
              </div>
              <CodePanel
                title="Primeiro pedido"
                language="bash"
                code={curlExample}
              />
              <p className="mt-3 text-xs leading-6 text-zinc-500">
                No exemplo, substitui{' '}
                <code className="rounded bg-white/[0.06] px-1 py-0.5 text-zinc-300">
                  barbearia-exemplo
                </code>
                pelo slug real. O slug deve ter entre 3 e 60 caracteres, usando
                letras minúsculas, números e hífen.
              </p>
            </section>

            <section id="resposta" className="scroll-mt-28">
              <SectionTitle
                eyebrow="02 · Contrato"
                title="Estrutura da resposta"
                description="A resposta de sucesso usa sempre apiVersion e data. Os identificadores do exemplo são ilustrativos; alguns campos podem ser null quando a barbearia não os preencheu."
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
                    Perfil público, contactos comerciais, imagens, etiquetas,
                    SEO, comodidades e horário.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">services</p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    Até 100 serviços, com preço em EUR, duração e indicação de
                    popularidade.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">reviews</p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    Até 100 avaliações recentes. O total agregado pode ser
                    superior à lista devolvida.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-semibold text-white">
                    bookingUrl / landingPage
                  </p>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    Links absolutos para marcações e, quando elegível, para a
                    landing page Enterprise.
                  </p>
                </div>
              </div>
            </section>

            <section id="campos" className="scroll-mt-28">
              <SectionTitle
                eyebrow="03 · Referência"
                title="Campos disponíveis"
                description="Consome apenas os campos de que precisas e trata os valores opcionais sem assumir que existem em todos os perfis."
              />
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Campo</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-zinc-400">
                    {[
                      [
                        'barbershop.id / slug / name',
                        'string',
                        'Identificação pública e nome da barbearia.',
                      ],
                      [
                        'barbershop.city / address / phone',
                        'string | null',
                        'Dados de contacto comercial públicos.',
                      ],
                      [
                        'barbershop.avatarUrl / coverUrl',
                        'URL | null',
                        'Imagens públicas do perfil.',
                      ],
                      [
                        'barbershop.tags',
                        'string[]',
                        'Etiquetas públicas do perfil.',
                      ],
                      [
                        'barbershop.seo',
                        'object',
                        'title, description e imageUrl, quando definidos.',
                      ],
                      [
                        'barbershop.amenities',
                        'object',
                        'Comodidades públicas normalizadas.',
                      ],
                      [
                        'barbershop.openingHours',
                        'object',
                        'Abertura, fecho, pausa de almoço e dias fechados.',
                      ],
                      [
                        'services[]',
                        'array',
                        'Até 100 serviços, ordenados por popularidade e nome.',
                      ],
                      ['reviews[]', 'array', 'Até 100 avaliações recentes.'],
                      [
                        'rating / reviewsCount',
                        'number / integer',
                        'Classificação e contagem agregadas, quando disponíveis.',
                      ],
                      [
                        'bookingUrl',
                        'URL',
                        'Ligação pública para consultar e marcar.',
                      ],
                      [
                        'landingPage.available / url',
                        'boolean / URL | null',
                        'Disponibilidade da landing page Enterprise.',
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
                eyebrow="04 · Integração"
                title="Exemplos prontos a adaptar"
                description="Todos os exemplos verificam o status HTTP antes de usar o corpo da resposta. Os botões permitem copiar o código diretamente."
              />
              <CodePanel
                title="JavaScript — browser ou Node.js"
                language="javascript"
                code={browserExample}
              />
              <CodePanel
                title="Next.js — consulta no servidor"
                language="typescript"
                code={nextExample}
              />
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm font-semibold text-zinc-200">
                  Dica para integrações públicas
                </p>
                <p className="mt-2 text-xs leading-6 text-zinc-400">
                  Se apresentares os dados no browser, usa textContent ou o
                  mecanismo de escape do teu framework para mostrar conteúdo
                  textual. Não transformes comentários de avaliações em HTML
                  executável.
                </p>
              </div>
            </section>

            <section id="cache" className="scroll-mt-28">
              <SectionTitle
                eyebrow="05 · Performance"
                title="Cache HTTP e ETag"
                description="A API suporta cache partilhada para reduzir latência e carga. O conteúdo é público e pode ficar temporariamente desatualizado."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { value: '60 segundos', label: 'Cache CDN (s-maxage)' },
                  {
                    value: '300 segundos',
                    label: 'Janela stale-while-revalidate',
                  },
                  { value: 'SHA-256', label: 'ETag da representação JSON' },
                  {
                    value: '304',
                    label: 'Resposta sem corpo quando não há alterações',
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
                Guarda o ETag recebido e envia-o no cabeçalho If-None-Match do
                próximo pedido. Se receberes 304, reutiliza a resposta guardada;
                não tentes ler JSON de uma resposta sem corpo.
              </p>
              <div className="mt-4">
                <CodePanel
                  title="Pedido condicional"
                  language="bash"
                  code={conditionalExample}
                />
              </div>
            </section>

            <section id="limites" className="scroll-mt-28">
              <SectionTitle
                eyebrow="06 · Resiliência"
                title="Limites e erros HTTP"
                description="Usa o código HTTP para gerir os fluxos. A mensagem dentro de error é destinada a diagnóstico e pode evoluir sem alterar o contrato."
              />
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[440px] border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">HTTP</th>
                      <th className="px-4 py-3 font-medium">Significado</th>
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
                    120 pedidos por minuto
                  </p>
                </div>
                <p className="mt-2 text-xs leading-6 text-zinc-400">
                  O limite inicial é aplicado por IP, recurso e slug. Uma
                  resposta 429 inclui Retry-After. Faz espera progressiva e
                  respeita esse cabeçalho em vez de repetir imediatamente.
                </p>
              </div>
            </section>

            <section id="cors" className="scroll-mt-28">
              <SectionTitle
                eyebrow="07 · Browser"
                title="CORS"
                description="O recurso foi concebido para leitura a partir de websites externos, sem cookies nem credenciais cross-origin."
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
                CORS é uma política do browser; não impede chamadas feitas por
                servidores ou scripts fora do browser. A proteção de abuso é
                aplicada separadamente por rate limiting.
              </p>
            </section>

            <section id="seguranca" className="scroll-mt-28">
              <SectionTitle
                eyebrow="08 · Privacidade"
                title="Que dados são expostos?"
                description="A resposta limita-se à informação aprovada para publicação no perfil. A API não permite consultar ou modificar dados privados da conta."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.035] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="size-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-zinc-100">
                      Incluído
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    Perfil público, contactos comerciais publicados, serviços,
                    preços, horário, avaliações públicas e links públicos.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className="size-4 text-zinc-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-zinc-100">
                      Nunca incluído neste contrato
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-zinc-400">
                    Email de proprietário, IDs de utilizadores, clientes,
                    marcações, faturas, tokens, secrets, notas internas e chaves
                    de integração.
                  </p>
                </div>
              </div>
            </section>

            <section id="enterprise" className="scroll-mt-28">
              <SectionTitle
                eyebrow="09 · Enterprise"
                title="Landing page incluída no Enterprise"
                description="A API devolve o endereço público da landing page apenas quando o plano efetivo e o entitlement da página estão ativos."
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-start gap-3">
                  <Database
                    className="mt-0.5 size-5 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Ligação automática ao perfil
                    </p>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      A página usa o perfil e o catálogo de serviços existente.
                      Não é necessário criar uma segunda conta nem manter os
                      serviços em duplicado. Se o acesso Enterprise terminar, a
                      página é suspensa e a API deixa de a anunciar como
                      disponível.
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
                eyebrow="10 · Compatibilidade"
                title="Versões e evolução"
                description="O caminho /api/v1 identifica a versão principal do contrato. A versão 1 é de leitura e foi desenhada para ser tolerante a campos adicionais."
              />
              <div className="space-y-3 text-sm leading-7 text-zinc-400">
                <p>
                  Ignora campos adicionais que não utilizes e trata campos
                  opcionais como null. Valida sempre o código HTTP antes de ler
                  o corpo.
                </p>
                <p>
                  Mudanças incompatíveis serão publicadas numa nova versão
                  principal, em vez de serem introduzidas silenciosamente na v1.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="/openapi-v1.yaml"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  <FileCode2 className="size-4" aria-hidden="true" />
                  Especificação OpenAPI{' '}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/martimfm1/silentra-for-barbers/blob/main/docs/API_PUBLICA.md"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Guia completo no GitHub{' '}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </section>

            <section className="border-t border-white/10 pt-8">
              <p className="text-sm font-semibold text-white">
                Pronto para integrar?
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Começa com uma única barbearia, valida os estados de erro e
                ativa cache antes de escalar a frequência dos pedidos.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/barbershops"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Explorar barbearias{' '}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.04]"
                >
                  Consultar planos{' '}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </article>
        </div>

        <footer className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Silentra for Barbers · Documentação API v1</p>
          <div className="flex flex-wrap gap-4">
            <a href="/privacy" className="transition hover:text-zinc-300">
              Privacidade
            </a>
            <a href="/terms" className="transition hover:text-zinc-300">
              Termos
            </a>
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
