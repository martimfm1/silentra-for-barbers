import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_HISTORY_ITEMS = 12;
const PENDING_INVOICE_TTL_MS = 10 * 60 * 1000;

type HistoryItem = {
  id: string;
  source: 'STRIPE' | 'MANUAL';
  document_number: string | null;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  date: string;
  issued_at: string;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  download_url: string | null;
};

function formatDate(value: Date) {
  return value.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function stripeStatusLabel(status: string | null) {
  switch (status) {
    case 'paid':
      return 'Paga';
    case 'open':
      return 'Por pagar';
    case 'draft':
      return 'Rascunho';
    case 'void':
      return 'Anulada';
    case 'uncollectible':
      return 'Incobrável';
    default:
      return 'Emitida';
  }
}

function planLabel(plan: string) {
  switch (plan.toLowerCase()) {
    case 'pro':
      return 'Barbers Pro';
    case 'enterprise':
      return 'Enterprise';
    default:
      return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}

async function GET__unobserved() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const admin = createAdminClient();
    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id, barbershop_id')
      .eq('id', user.id)
      .maybeSingle();

    if (userError) {
      console.error('[BILLING_HISTORY_USER_READ_ERROR]', {
        code: userError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível carregar a conta de faturação.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!userRow?.barbershop_id) {
      return NextResponse.json(
        { invoices: [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const barbershopId = userRow.barbershop_id;
    const { data: barbershop, error: barbershopError } = await admin
      .from('barbershops')
      .select('id, created_by')
      .eq('id', barbershopId)
      .maybeSingle();

    if (barbershopError) {
      console.error('[BILLING_HISTORY_TENANT_READ_ERROR]', {
        code: barbershopError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível validar a conta de faturação.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!barbershop || barbershop.created_by !== user.id) {
      return NextResponse.json(
        {
          error:
            'Só o proprietário da barbearia pode consultar o histórico de faturação.',
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const { data: documents, error: documentsError } = await admin
      .from('billing_documents')
      .select(
        [
          'id',
          'document_number',
          'issued_at',
          'plan',
          'billing_interval',
          'currency',
          'total',
          'user_id',
          'barbershop_id',
        ].join(', '),
      )
      .eq('barbershop_id', barbershopId)
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false })
      .limit(50);

    if (documentsError) {
      console.error('[BILLING_HISTORY_MANUAL_DOCUMENTS_ERROR]', {
        code: documentsError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível carregar os comprovativos de pagamento.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const manualHistory: HistoryItem[] = (documents ?? []).map((document) => {
      const issuedAt = new Date(document.issued_at);
      const intervalLabel =
        document.billing_interval === 'year' ? 'Anual' : 'Mensal';

      return {
        id: document.id,
        source: 'MANUAL' as const,
        document_number: document.document_number,
        amount: Math.round(Number(document.total) * 100),
        currency: String(document.currency ?? 'EUR').toUpperCase(),
        status: 'Pago',
        plan: `${planLabel(String(document.plan ?? 'subscrição'))} · ${intervalLabel}`,
        date: formatDate(issuedAt),
        issued_at: issuedAt.toISOString(),
        invoice_pdf: null,
        hosted_invoice_url: null,
        download_url: `/api/billing/documents/${encodeURIComponent(document.id)}`,
      };
    });

    // Resolve an already-stored Stripe customer only. Reading the history must
    // never create a new customer as a side effect.
    let stripeCustomerId: string | null = null;
    try {
      const { data: billingAccount, error: billingAccountError } = await admin
        .from('barbershop_billing_accounts')
        .select('stripe_customer_id')
        .eq('barbershop_id', barbershopId)
        .maybeSingle();

      if (billingAccountError) throw billingAccountError;
      stripeCustomerId = billingAccount?.stripe_customer_id ?? null;

      if (!stripeCustomerId) {
        const { data: subscription, error: subscriptionError } = await admin
          .from('subscriptions')
          .select('stripe_customer_id')
          .eq('barbershop_id', barbershopId)
          .not('stripe_customer_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscriptionError) throw subscriptionError;
        stripeCustomerId = subscription?.stripe_customer_id ?? null;
      }

      if (!stripeCustomerId) {
        const { data: legacyCustomer, error: legacyCustomerError } = await admin
          .from('customers')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (legacyCustomerError) throw legacyCustomerError;
        stripeCustomerId = legacyCustomer?.stripe_customer_id ?? null;
      }
    } catch (error) {
      console.error('[BILLING_HISTORY_STRIPE_CUSTOMER_LOOKUP_ERROR]', {
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
      });
    }

    let stripeHistory: HistoryItem[] = [];
    if (stripeCustomerId) {
      try {
        const stripe = getStripeClient();
        const { data: invoices } = await stripe.invoices.list({
          customer: stripeCustomerId,
          limit: 50,
        });
        const now = Date.now();
        stripeHistory = invoices
          .filter((invoice) => {
            const pending =
              invoice.status === null ||
              invoice.status === 'draft' ||
              invoice.status === 'open';
            return (
              !pending ||
              now - invoice.created * 1000 <= PENDING_INVOICE_TTL_MS
            );
          })
          .map((invoice) => {
            const issuedAt = new Date(invoice.created * 1000);
            return {
              id: invoice.id,
              source: 'STRIPE' as const,
              document_number: invoice.number ?? null,
              amount: invoice.amount_paid || invoice.amount_due,
              currency: invoice.currency.toUpperCase(),
              status: stripeStatusLabel(invoice.status),
              plan:
                invoice.lines.data.find((line) => Boolean(line.description))
                  ?.description?.trim() || 'Subscrição Silentra',
              date: formatDate(issuedAt),
              issued_at: issuedAt.toISOString(),
              invoice_pdf: invoice.invoice_pdf,
              hosted_invoice_url: invoice.hosted_invoice_url,
              download_url: null,
            };
          });
      } catch (error) {
        // Manual documents should remain visible even if Stripe is unavailable.
        console.error('[BILLING_HISTORY_STRIPE_INVOICES_ERROR]', {
          errorName: error instanceof Error ? error.name : 'UNKNOWN',
        });
      }
    }

    const invoices = [...stripeHistory, ...manualHistory]
      .sort(
        (left, right) =>
          new Date(right.issued_at).getTime() -
          new Date(left.issued_at).getTime(),
      )
      .slice(0, MAX_HISTORY_ITEMS);

    return NextResponse.json(
      { invoices },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('[BILLING_HISTORY_CRITICAL]', {
      errorName: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível carregar o histórico de faturação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiObservability(
  '/api/billing/history',
  GET__unobserved,
);
