import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { requireModuleContext } from '@/services/modules/authorization';
import { PLANS } from '@/lib/stripe/constants';

type ExportType = 'appointments' | 'clients' | 'pos';
type RowRecord = Record<string, unknown>;

type Stat = { label: string; value: string };

function date(value: string | null, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function start(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function end(value: Date) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDateTime(value: unknown) {
  if (!value) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

function formatDate(value: unknown) {
  if (!value) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(
    parsed,
  );
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount)
    : '0,00 €';
}

function relationRecord(value: unknown): RowRecord | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as RowRecord) : null;
  }
  return value && typeof value === 'object' ? (value as RowRecord) : null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function reportHtml({
  title,
  subtitle,
  period,
  stats,
  headers,
  rows,
}: {
  title: string;
  subtitle: string;
  period: string;
  stats: Stat[];
  headers: string[];
  rows: unknown[][];
}) {
  const generatedAt = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  const statsHtml = stats
    .map(
      (stat) => `
        <div class="stat">
          <span>${escapeHtml(stat.label)}</span>
          <strong>${escapeHtml(stat.value)}</strong>
        </div>`,
    )
    .join('');

  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const rowsHtml = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${headers.length}" class="empty">Sem dados para o período selecionado.</td></tr>`;

  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Silentra — ${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f4f5f7;
    color: #17181b;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .page { max-width: 1180px; margin: 0 auto; padding: 36px 24px 56px; }
  .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:28px; }
  .brand { font-size:14px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#0f8f68; }
  h1 { margin:8px 0 6px; font-size:32px; letter-spacing:-.04em; }
  .subtitle { margin:0; color:#656b75; font-size:14px; }
  .period { text-align:right; font-size:13px; color:#656b75; }
  .period strong { display:block; margin-top:4px; color:#17181b; font-size:14px; }
  .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:24px; }
  .stat { background:#fff; border:1px solid #e1e5e9; border-radius:16px; padding:18px; }
  .stat span { display:block; color:#6b717b; font-size:12px; margin-bottom:8px; }
  .stat strong { display:block; font-size:22px; letter-spacing:-.03em; }
  .table-wrap { background:#fff; border:1px solid #e1e5e9; border-radius:18px; overflow:hidden; box-shadow:0 8px 30px rgba(20,25,30,.05); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; background:#f7f8f9; color:#5e6670; font-size:11px; text-transform:uppercase; letter-spacing:.08em; padding:12px 14px; border-bottom:1px solid #e1e5e9; white-space:nowrap; }
  td { padding:12px 14px; border-bottom:1px solid #edf0f2; vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  .empty { text-align:center; padding:48px; color:#7b828b; }
  .footer { display:flex; justify-content:space-between; gap:20px; margin-top:18px; color:#8a9098; font-size:11px; }
  .notice { margin-top:18px; padding:12px 14px; border-radius:12px; background:#eaf8f2; color:#226b53; border:1px solid #cdeee1; font-size:12px; }
  @media (max-width: 800px) {
    .page { padding:24px 14px 40px; }
    .topbar { flex-direction:column; }
    .period { text-align:left; }
    .stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .table-wrap { overflow:auto; }
    table { min-width:760px; }
  }
  @media print {
    body { background:#fff; }
    .page { max-width:none; padding:0; }
    .table-wrap { box-shadow:none; }
  }
</style>
</head>
<body>
<main class="page">
  <header class="topbar">
    <div>
      <div class="brand">Silentra</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </div>
    <div class="period">
      Período
      <strong>${escapeHtml(period)}</strong>
    </div>
  </header>
  <section class="stats">${statsHtml}</section>
  <section class="table-wrap">
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>
  <div class="notice">Relatório gerado pela Silentra. Pode imprimir ou guardar esta página como PDF para arquivo, partilha ou contabilidade.</div>
  <footer class="footer">
    <span>Gerado em ${escapeHtml(generatedAt)}</span>
    <span>silentra.me</span>
  </footer>
</main>
</body>
</html>`;
}

function response(filename: string, html: string) {
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function GETHandler(request: Request) {
  try {
    const { admin, barbershopId, plan } = await requireModuleContext(
      'advanced_analytics',
      'analytics',
    );
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') ?? 'appointments') as ExportType;
    const now = new Date();
    const from = start(
      date(
        url.searchParams.get('from'),
        new Date(now.getTime() - 29 * 86400000),
      ),
    );
    const to = end(date(url.searchParams.get('to'), now));

    if (to < from || to.getTime() - from.getTime() > 366 * 86400000) {
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 },
      );
    }

    const period = `${formatDate(from)} — ${formatDate(to)}`;
    const fromLabel = from.toISOString().slice(0, 10);
    const toLabel = to.toISOString().slice(0, 10);

    if (type === 'clients') {
      const { data, error } = await admin
        .from('users')
        .select('name_complete,email,num_phone,birth_date,created_at')
        .eq('barbershop_id', barbershopId)
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;

      const rows = (data ?? []).map((row) => [
        row.name_complete,
        row.email,
        row.num_phone,
        formatDate(row.birth_date),
        formatDate(row.created_at),
      ]);
      const createdInPeriod = (data ?? []).filter((row) => {
        const created = new Date(String(row.created_at));
        return created >= from && created <= to;
      }).length;
      const withBirthDate = (data ?? []).filter((row) =>
        Boolean(row.birth_date),
      ).length;

      return response(
        `silentra-relatorio-clientes-${fromLabel}-${toLabel}.html`,
        reportHtml({
          title: 'Relatório de clientes',
          subtitle:
            'Base de clientes da barbearia para gestão e acompanhamento.',
          period,
          stats: [
            { label: 'Clientes totais', value: String(data?.length ?? 0) },
            { label: 'Novos no período', value: String(createdInPeriod) },
            { label: 'Com data de nascimento', value: String(withBirthDate) },
            {
              label: 'Cobertura de dados',
              value: `${data?.length ? Math.round((withBirthDate / data.length) * 100) : 0}%`,
            },
          ],
          headers: [
            'Nome',
            'Email',
            'Telefone',
            'Data de nascimento',
            'Cliente desde',
          ],
          rows,
        }),
      );
    }

    if (type === 'appointments') {
      const { data, error } = await admin
        .from('appointments')
        .select(
          'date_hour,status,manual_name,manual_email,manual_phone,value_products,payment_method,service:services(name,price),professional:professionals(name)',
        )
        .eq('barbershop_id', barbershopId)
        .gte('date_hour', from.toISOString())
        .lte('date_hour', to.toISOString())
        .order('date_hour', { ascending: true })
        .limit(20000);
      if (error) throw error;

      let revenue = 0;
      let completed = 0;
      let cancelled = 0;
      const rows = (data ?? []).map((row: RowRecord) => {
        const service = relationRecord(row.service);
        const servicePrice = Number(service?.price ?? 0);
        const products = Number(row.value_products ?? 0);
        const total = servicePrice + products;
        revenue += Number.isFinite(total) ? total : 0;
        if (String(row.status).toLowerCase() === 'completed') completed += 1;
        if (String(row.status).toLowerCase() === 'cancelled') cancelled += 1;
        return [
          formatDateTime(row.date_hour),
          row.status,
          row.manual_name,
          service?.name,
          relationRecord(row.professional)?.name,
          money(total),
          row.payment_method,
        ];
      });

      return response(
        `silentra-relatorio-marcacoes-${fromLabel}-${toLabel}.html`,
        reportHtml({
          title: 'Relatório de marcações',
          subtitle:
            'Visão operacional das marcações e receita estimada dos serviços registados.',
          period,
          stats: [
            { label: 'Marcações', value: String(data?.length ?? 0) },
            { label: 'Concluídas', value: String(completed) },
            { label: 'Canceladas', value: String(cancelled) },
            { label: 'Receita registada', value: money(revenue) },
          ],
          headers: [
            'Data e hora',
            'Estado',
            'Cliente',
            'Serviço',
            'Profissional',
            'Total',
            'Pagamento',
          ],
          rows,
        }),
      );
    }

    if (type === 'pos') {
      if (plan !== PLANS.ENTERPRISE) {
        return NextResponse.json(
          { error: 'POS export requires Enterprise.' },
          { status: 403 },
        );
      }

      const { data, error } = await admin
        .from('pos_transactions')
        .select('created_at,subtotal,discount,total,payment_method,status')
        .eq('barbershop_id', barbershopId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: true })
        .limit(20000);
      if (error) throw error;

      const totalRevenue = (data ?? []).reduce(
        (sum, row) => sum + Number(row.total ?? 0),
        0,
      );
      const totalDiscount = (data ?? []).reduce(
        (sum, row) => sum + Number(row.discount ?? 0),
        0,
      );

      return response(
        `silentra-relatorio-financeiro-${fromLabel}-${toLabel}.html`,
        reportHtml({
          title: 'Relatório financeiro',
          subtitle:
            'Resumo das transações POS com detalhe por pagamento e estado.',
          period,
          stats: [
            { label: 'Transações', value: String(data?.length ?? 0) },
            { label: 'Receita', value: money(totalRevenue) },
            { label: 'Descontos', value: money(totalDiscount) },
            {
              label: 'Ticket médio',
              value: money(data?.length ? totalRevenue / data.length : 0),
            },
          ],
          headers: [
            'Data e hora',
            'Subtotal',
            'Desconto',
            'Total',
            'Pagamento',
            'Estado',
          ],
          rows: (data ?? []).map((row) => [
            formatDateTime(row.created_at),
            money(row.subtotal),
            money(row.discount),
            money(row.total),
            row.payment_method,
            row.status,
          ]),
        }),
      );
    }

    return NextResponse.json(
      { error: 'Unsupported export type' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[ANALYTICS_EXPORT]', error);
    return NextResponse.json(
      { error: 'Unable to export analytics' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/analytics/export', GETHandler);
