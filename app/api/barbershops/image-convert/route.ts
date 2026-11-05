import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { withApiObservability } from '@/lib/observability/api';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 2_500_000;
const MAX_IMAGE_DIMENSION = 1600;

async function POST__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, ['owner', 'admin']);
  if (!tenant.ok) {
    return NextResponse.json(
      {
        error:
          tenant.status === 401
            ? 'A sessão expirou. Inicia sessão novamente.'
            : 'Sem permissão para alterar as imagens da barbearia.',
      },
      { status: tenant.status },
    );
  }

  try {
    const allowed = await consumePublicRateLimit(
      request,
      'barbershop-image-conversion',
      tenant.userId,
      8,
      15 * 60,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: 'Atingiste o limite de conversões. Tenta novamente mais tarde.' },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const image = formData.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: 'Não foi enviada nenhuma imagem válida.' },
        { status: 400 },
      );
    }

    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'A imagem para conversão não pode exceder 4 MB.' },
        { status: 413 },
      );
    }

    if (image.type !== 'image/jpeg' && image.type !== 'image/png') {
      return NextResponse.json(
        { error: 'O formato intermédio da imagem não é suportado.' },
        { status: 415 },
      );
    }

    const input = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();

    const expectedFormat = image.type === 'image/png' ? 'png' : 'jpeg';
    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS
    ) {
      return NextResponse.json(
        { error: 'A imagem enviada não é válida ou tem dimensões demasiado grandes.' },
        { status: 422 },
      );
    }

    const webp = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    if (webp.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível gerar a imagem WebP.' },
        { status: 422 },
      );
    }

    return new NextResponse(new Uint8Array(webp), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(webp.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[BARBERSHOP_IMAGE_CONVERSION_FAILED]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível converter a imagem. Tenta usar uma imagem JPG ou PNG.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/barbershops/image-convert',
  POST__unobserved,
);
