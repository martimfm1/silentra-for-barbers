import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications';
import {
  customerPaymentReceiptEmail,
  getBillingEmailBaseUrl,
} from '@/services/billing/email-templates';
import {
  generateManualPaymentReceiptPdf,
  type ManualPaymentDocument,
} from '@/services/billing/manual-payment-document';

const doc = (row: Record<string, unknown>) =>
  row as unknown as ManualPaymentDocument;

export class ManualPaymentDocumentService {
  static async ensureDocument(requestId: string) {
    const { data, error } = await createAdminClient().rpc(
      'create_manual_payment_document',
      { p_request_id: requestId },
    );
    if (error || !data) {
      console.error('[MANUAL_PAYMENT_DOCUMENT_CREATE_ERROR]', {
        requestId,
        code: error?.code ?? null,
        message: error?.message ?? null,
      });
      throw new Error('Não foi possível criar o comprovativo de pagamento.');
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('O comprovativo de pagamento não foi criado.');
    return doc(row as Record<string, unknown>);
  }
  static async prepareReceipt(requestId: string) {
    const document = await this.ensureDocument(requestId);
    const pdf = generateManualPaymentReceiptPdf(document);
    if (!document.pdf_generated_at) {
      const now = new Date().toISOString();
      await createAdminClient()
        .from('billing_documents')
        .update({ pdf_generated_at: now, updated_at: now })
        .eq('id', document.id)
        .is('pdf_generated_at', null);
      document.pdf_generated_at = now;
    }
    return { document, pdf };
  }
  static async sendReceipt(requestId: string, force = false) {
    const { document, pdf } = await this.prepareReceipt(requestId);
    if (document.email_sent_at && !force)
      return { sent: true, alreadySent: true, document };
    const t = customerPaymentReceiptEmail({
      customerName: document.customer_name,
      customerEmail: document.customer_email,
      barbershopName: document.barbershop_name,
      plan: document.plan as 'pro' | 'enterprise',
      billingInterval: document.billing_interval,
      price: document.total,
      currency: document.currency,
      requestId: document.manual_request_id,
      issuedAt: document.issued_at,
      documentNumber: document.document_number,
      dashboardUrl: new URL(
        '/dashboard/billing',
        getBillingEmailBaseUrl(),
      ).toString(),
    });
    const result = await sendEmail(
      { email: document.customer_email, userId: document.user_id },
      {
        subject: `Comprovativo de pagamento ${document.document_number} — Silentra`,
        body: t.text,
        html: t.html,
        senderName: 'Silentra',
        attachments: [
          {
            content: pdf.toString('base64'),
            name: `Silentra-${document.document_number}.pdf`,
          },
        ],
      },
    );
    const now = new Date().toISOString();
    if (result.success) {
      await createAdminClient()
        .from('billing_documents')
        .update({
          email_sent_at: now,
          email_message_id: result.messageId ?? null,
          email_error: null,
          updated_at: now,
        })
        .eq('id', document.id);
      return { sent: true, alreadySent: false, document };
    }
    await createAdminClient()
      .from('billing_documents')
      .update({
        email_error: result.error ?? 'Não foi possível enviar o comprovativo.',
        updated_at: now,
      })
      .eq('id', document.id);
    return { sent: false, alreadySent: false, document, error: result.error };
  }
  static async getForUser(documentId: string, userId: string) {
    const { data, error } = await createAdminClient()
      .from('billing_documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('Não foi possível carregar o comprovativo.');
    return data ? doc(data as Record<string, unknown>) : null;
  }
  static async getById(documentId: string) {
    const { data, error } = await createAdminClient()
      .from('billing_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();
    if (error) throw new Error('Não foi possível carregar o comprovativo.');
    return data ? doc(data as Record<string, unknown>) : null;
  }
  static generatePdf(document: ManualPaymentDocument) {
    return generateManualPaymentReceiptPdf(document);
  }
}
