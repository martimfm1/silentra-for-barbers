import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireModuleContext } from '@/services/modules/authorization';
import { PLANS } from '@/lib/stripe/constants';

type ExportType = 'appointments' | 'clients' | 'pos';
type RowRecord = Record<string, unknown>;

function parseDate(value: string | null, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function dayStart(value: Date) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayEnd(value: Date) {
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

function relationRecord(value: unknown): RowRecord | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as RowRecord) : null;
  }
  return value && typeof value === 'object' ? (value as RowRecord) : null;
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

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelXml(
  title: string,
  headers: string[],
  rows: unknown[][],
  from: Date,
  to: Date,
) {
  const generated = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
  const rowXml = (values: unknown[], header = false) =>
    `\n<Row>${values.map((value) => `<Cell ss:StyleID="${header ? 'Header' : 'Cell'}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join('')}</Row>`;
  const stats = [
    ['Relatório', title],
    ['Período', `${formatDate(from)} — ${formatDate(to)}`],
    ['Gerado em', generated],
  ];

  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Styles><Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Aptos" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F8F68" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Cell"><Alignment ss:Vertical="Top"/></Style><Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#0F8F68"/></Style></Styles>\n<Worksheet ss:Name="${escapeXml(title.slice(0, 31))}"><Table><Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="160"/>\n<Row><Cell ss:MergeAcross="6" ss:StyleID="Title"><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>\n${stats.map((item) => rowXml(item)).join('')}\n${rowXml(headers, true)}\n${rows.map((row) => rowXml(row)).join('')}\n</Table></Worksheet></Workbook>`;
}

function response(filename: string, xml: string) {
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function GET__unobserved(request: Request) {
  try {
    const { admin, barbershopId, plan } = await requireModuleContext(
      'advanced_analytics',
      'analytics',
    );
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') ?? 'appointments') as ExportType;
    const now = new Date();
    const from = dayStart(
      parseDate(
        url.searchParams.get('from'),
        new Date(now.getTime() - 29 * 86400000),
      ),
    );
    const to = dayEnd(parseDate(url.searchParams.get('to'), now));

    if (to < from || to.getTime() - from.getTime() > 366 * 86400000) {
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 },
      );
    }

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
      return response(
        `silentra-clientes-${fromLabel}-${toLabel}.xls`,
        excelXml(
          'Clientes — Silentra',
          ['Nome', 'Email', 'Telefone', 'Data de nascimento', 'Cliente desde'],
          rows,
          from,
          to,
        ),
      );
    }

    if (type === 'appointments') {
      const { data, error } = await admin
        .from('appointments')
        .select(
          'date_hour,status,manual_name,value_products,payment_method,service:services(name,price),professional:professionals(name)',
        )
        .eq('barbershop_id', barbershopId)
        .gte('date_hour', from.toISOString())
        .lte('date_hour', to.toISOString())
        .order('date_hour', { ascending: true })
        .limit(20000);
      if (error) throw error;
      const rows = (data ?? []).map((row: RowRecord) => {
        const service = relationRecord(row.service);
        const total =
          Number(service?.price ?? 0) + Number(row.value_products ?? 0);
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
        `silentra-marcacoes-${fromLabel}-${toLabel}.xls`,
        excelXml(
          'Marcações — Silentra',
          [
            'Data e hora',
            'Estado',
            'Cliente',
            'Serviço',
            'Profissional',
            'Total',
            'Pagamento',
          ],
          rows,
          from,
          to,
        ),
      );
    }

    if (type === 'pos') {
      if (plan !== PLANS.ENTERPRISE)
        return NextResponse.json(
          { error: 'POS export requires Enterprise.' },
          { status: 403 },
        );
      const { data, error } = await admin
        .from('pos_transactions')
        .select('created_at,subtotal,discount,total,payment_method,status')
        .eq('barbershop_id', barbershopId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: true })
        .limit(20000);
      if (error) throw error;
      const rows = (data ?? []).map((row) => [
        formatDateTime(row.created_at),
        money(row.subtotal),
        money(row.discount),
        money(row.total),
        row.payment_method,
        row.status,
      ]);
      return response(
        `silentra-financeiro-${fromLabel}-${toLabel}.xls`,
        excelXml(
          'Financeiro POS — Silentra',
          [
            'Data e hora',
            'Subtotal',
            'Desconto',
            'Total',
            'Pagamento',
            'Estado',
          ],
          rows,
          from,
          to,
        ),
      );
    }

    return NextResponse.json(
      { error: 'Unsupported export type' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[ANALYTICS_EXPORT_EXCEL]', error);
    return NextResponse.json(
      { error: 'Unable to export Excel report' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/analytics/export-excel',
  GET__unobserved,
);
