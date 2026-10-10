import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { ManualPaymentDocumentService } from '@/services/billing/manual-payment-document.service';
import { assertSameOrigin } from '@/services/billing/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ documentId: string }> };

async function GETHandler(request: Request, { params }: Params) {
  const { documentId } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const document = await ManualPaymentDocumentService.getForUser(
        documentId,
        user.id,
      );
      if (document) {
        const pdf = ManualPaymentDocumentService.generatePdf(document);
        return new NextResponse(new Uint8Array(pdf), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Silentra-${document.document_number}.pdf"`,
            'Cache-Control': 'private, no-store',
          },
        });
      }
    }
    await requirePlatformAdmin();
    const document = await ManualPaymentDocumentService.getById(documentId);
    if (!document)
      return NextResponse.json(
        { error: 'Comprovativo não encontrado.' },
        { status: 404 },
      );
    const pdf = ManualPaymentDocumentService.generatePdf(document);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Silentra-${document.document_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[BILLING_DOCUMENT_DOWNLOAD]', error);
    return NextResponse.json(
      { error: 'Não autorizado ou comprovativo não encontrado.' },
      { status: 401 },
    );
  }
}

async function POSTHandler(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    await requirePlatformAdmin();
    const { documentId } = await params;
    const document = await ManualPaymentDocumentService.getById(documentId);
    if (!document)
      return NextResponse.json(
        { error: 'Comprovativo não encontrado.' },
        { status: 404 },
      );
    const result = await ManualPaymentDocumentService.sendReceipt(
      document.manual_request_id,
      true,
    );
    return NextResponse.json(
      {
        ok: result.sent,
        document: result.document,
        error: result.error ?? null,
      },
      { status: result.sent ? 200 : 502 },
    );
  } catch (error) {
    console.error('[BILLING_DOCUMENT_RESEND]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível reenviar o comprovativo.',
      },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/billing/documents/[documentId]', GETHandler);
export const POST = withApiLogging('/api/billing/documents/[documentId]', POSTHandler);
