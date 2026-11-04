import { createClient } from '@/lib/supabase/client';

interface UploadImageOptions {
  file: File;
  bucket: 'avatar' | 'banner';
  path: string;
  maxWidth?: number;
  quality?: number;
}

interface UploadImageResult {
  path: string;
  publicUrl: string;
  storagePath: string;
}

const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 8192;
const MAX_SOURCE_PIXELS = 40_000_000;
const MAX_SERVER_CONVERSION_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
]);

const STORAGE_BUCKETS = {
  avatar: 'avatar',
  banner: 'banner',
} as const;

/**
 * Validates, decodes and converts a user image to WebP before uploading it.
 * The logical `avatar` bucket maps to the existing Supabase `avatar` bucket.
 * Avatar metadata is updated through a protected tenant-owned RPC.
 */
export async function processAndUploadImage({
  file,
  bucket,
  path,
  maxWidth = 1200,
  quality = 0.8,
}: UploadImageOptions): Promise<{
  data: UploadImageResult | null;
  error: Error | null;
}> {
  try {
    const detectedType = await detectImageMime(file);

    if (!detectedType) {
      return {
        data: null,
        error: new Error(
          'O ficheiro não tem uma assinatura de imagem válida. Escolhe um JPG, PNG, WebP, GIF, BMP, TIFF ou AVIF.',
        ),
      };
    }

    if (detectedType === 'image/heic') {
      return {
        data: null,
        error: new Error(
          'Este ficheiro está em formato HEIC/HEIF. Converte-o para JPG, PNG ou WebP antes de o carregar.',
        ),
      };
    }

    if (!SUPPORTED_IMAGE_TYPES.has(detectedType)) {
      return {
        data: null,
        error: new Error(
          `Formato de imagem não suportado (${detectedType}). Usa JPG, PNG, WebP, GIF, BMP, TIFF ou AVIF.`,
        ),
      };
    }

    if (file.size <= 0) {
      return {
        data: null,
        error: new Error('O ficheiro de imagem está vazio.'),
      };
    }

    if (file.size > MAX_SOURCE_SIZE) {
      return {
        data: null,
        error: new Error('A imagem é demasiado grande. O limite é 10 MB.'),
      };
    }

    const webpBlob = await convertToWebp(file, maxWidth, quality);
    if (webpBlob.type !== 'image/webp' || webpBlob.size === 0) {
      return {
        data: null,
        error: new Error('Não foi possível validar a conversão para WebP.'),
      };
    }

    const supabase = createClient();
    const storageBucket = STORAGE_BUCKETS[bucket];
    const webpPath = path.replace(/\.[^/.]+$/, '') + '.webp';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(webpPath, webpBlob, {
        contentType: 'image/webp',
        // Banner files are overwritten in place and are consumed by public pages.
        // Keep their CDN cache short so a new Settings upload becomes visible quickly.
        cacheControl: bucket === 'banner' ? '60' : '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Upload Error - ${storageBucket}]`, {
        message: uploadError.message,
        name: uploadError.name,
        statusCode: uploadError.statusCode,
        path: webpPath,
      });
      return {
        data: null,
        error: new Error(
          uploadError.message ||
            'Não foi possível carregar a imagem para o armazenamento.',
        ),
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(storageBucket)
      .getPublicUrl(webpPath);
    const publicUrl = publicUrlData.publicUrl;

    if (!publicUrl) {
      console.error('[Upload Error] Supabase did not return a public URL', {
        bucket: storageBucket,
        path: webpPath,
      });
      return {
        data: null,
        error: new Error('Não foi possível obter o endereço da imagem.'),
      };
    }

    if (bucket === 'avatar') {
      const avatarPath = /^([^/]+)\/avatar\.webp$/.exec(webpPath);
      const barbershopId = avatarPath?.[1];
      if (!barbershopId) {
        return { data: null, error: new Error('Caminho do avatar inválido.') };
      }

      const metadataResponse = await fetch('/api/barbershops/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      const metadataBody = await metadataResponse.json().catch(() => null);

      if (!metadataResponse.ok) {
        console.error('[Avatar Metadata Error]', {
          status: metadataResponse.status,
          error: metadataBody?.error ?? null,
          barbershopId,
        });

        const { error: cleanupError } = await supabase.storage
          .from(storageBucket)
          .remove([webpPath]);
        if (cleanupError) {
          console.warn('[Avatar Cleanup Error]', cleanupError);
        }

        return {
          data: null,
          error: new Error(
            metadataBody?.error ||
              'Não foi possível associar o avatar à barbearia.',
          ),
        };
      }
    }

    return {
      data: {
        ...uploadData,
        path: webpPath,
        publicUrl,
        storagePath: webpPath,
      },
      error: null,
    };
  } catch (err) {
    console.error('[Process Image Error]', err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('Não foi possível processar a imagem.'),
    };
  }
}

async function detectImageMime(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());

  const startsWith = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);

  const asciiAt = (offset: number, length = 4) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));

  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png';
  }
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (
    startsWith(0x47, 0x49, 0x46, 0x38) &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (startsWith(0x42, 0x4d)) return 'image/bmp';
  if (
    startsWith(0x49, 0x49, 0x2a, 0x00) ||
    startsWith(0x4d, 0x4d, 0x00, 0x2a)
  ) {
    return 'image/tiff';
  }

  // AVIF and HEIC are ISO Base Media files. Their brand may be present as
  // either the major brand or a compatible brand, so inspect the full header
  // rather than assuming it always starts at byte 8.
  if (asciiAt(4) === 'ftyp' && bytes.length >= 16) {
    const brands = [asciiAt(8)];
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      brands.push(asciiAt(offset));
    }

    if (brands.some((brand) => brand === 'avif' || brand === 'avis')) {
      return 'image/avif';
    }

    if (
      brands.some((brand) =>
        ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(
          brand,
        ),
      )
    ) {
      return 'image/heic';
    }
  }

  return null;
}

function convertToWebp(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finish = (blob: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };
    const encodeCanvas = (
      canvas: HTMLCanvasElement,
      mimeType: string,
      outputQuality: number,
    ) =>
      new Promise<Blob | null>((resolveBlob) => {
        try {
          canvas.toBlob(resolveBlob, mimeType, outputQuality);
        } catch {
          resolveBlob(null);
        }
      });

    const convertOnServer = async (canvas: HTMLCanvasElement) => {
      // Prefer PNG so transparent logos stay transparent. Fall back to a
      // compressed JPEG only when the PNG would exceed the Vercel body limit.
      let fallbackBlob = await encodeCanvas(canvas, 'image/png', 1);
      let fallbackName = 'branding-fallback.png';

      if (
        !fallbackBlob ||
        fallbackBlob.type !== 'image/png' ||
        fallbackBlob.size === 0 ||
        fallbackBlob.size > MAX_SERVER_CONVERSION_BYTES
      ) {
        const jpegCanvas = document.createElement('canvas');
        jpegCanvas.width = canvas.width;
        jpegCanvas.height = canvas.height;
        const jpegContext = jpegCanvas.getContext('2d');
        if (!jpegContext) {
          throw new Error(
            'Não foi possível preparar uma versão alternativa da imagem.',
          );
        }

        // JPEG has no alpha channel. Use a neutral background rather than
        // turning transparent parts of a logo black.
        jpegContext.fillStyle = '#fff';
        jpegContext.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
        jpegContext.drawImage(canvas, 0, 0);

        fallbackName = 'branding-fallback.jpg';
        fallbackBlob = null;
        const qualityCandidates = [
          Math.min(0.88, Math.max(0.5, quality)),
          0.68,
          0.5,
        ];
        for (const candidate of qualityCandidates) {
          const candidateBlob = await encodeCanvas(
            jpegCanvas,
            'image/jpeg',
            candidate,
          );
          if (
            candidateBlob?.type === 'image/jpeg' &&
            candidateBlob.size > 0 &&
            candidateBlob.size <= MAX_SERVER_CONVERSION_BYTES
          ) {
            fallbackBlob = candidateBlob;
            break;
          }
        }
      }

      if (
        !fallbackBlob ||
        fallbackBlob.size === 0 ||
        fallbackBlob.size > MAX_SERVER_CONVERSION_BYTES
      ) {
        throw new Error(
          'A imagem é demasiado grande para a conversão alternativa. Escolhe uma imagem mais pequena.',
        );
      }

      const formData = new FormData();
      formData.append('image', fallbackBlob, fallbackName);

      const response = await fetch('/api/barbershops/image-convert', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(
          typeof responseBody?.error === 'string'
            ? responseBody.error
            : 'Não foi possível converter a imagem no servidor.',
        );
      }

      const convertedBlob = await response.blob();
      if (
        convertedBlob.type !== 'image/webp' ||
        convertedBlob.size === 0
      ) {
        throw new Error(
          'O servidor não devolveu uma imagem WebP válida.',
        );
      }

      return convertedBlob;
    };

    img.onload = () => {
      void (async () => {
        try {
          const sourceWidth = img.naturalWidth;
          const sourceHeight = img.naturalHeight;

          if (!sourceWidth || !sourceHeight) {
            throw new Error(
              'Não foi possível determinar as dimensões da imagem.',
            );
          }

          if (
            sourceWidth > MAX_SOURCE_DIMENSION ||
            sourceHeight > MAX_SOURCE_DIMENSION ||
            sourceWidth * sourceHeight > MAX_SOURCE_PIXELS
          ) {
            throw new Error('As dimensões da imagem são demasiado grandes.');
          }

          // Limit the longest edge, not only the width. Very tall portrait
          // images can otherwise create canvases that exceed browser limits.
          const maxDimension = Math.max(1, maxWidth);
          const scale = Math.min(
            1,
            maxDimension / Math.max(sourceWidth, sourceHeight),
          );
          const width = Math.max(1, Math.round(sourceWidth * scale));
          const height = Math.max(1, Math.round(sourceHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error(
              'Não foi possível inicializar o processamento da imagem.',
            );
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const normalizedQuality = Math.min(1, Math.max(0.1, quality));
          const webpBlob = await encodeCanvas(
            canvas,
            'image/webp',
            normalizedQuality,
          );

          if (
            webpBlob?.type === 'image/webp' &&
            webpBlob.size > 0
          ) {
            finish(webpBlob);
            return;
          }

          // Some browsers can decode the source image but cannot encode WebP
          // through HTMLCanvasElement.toBlob. In that case, send a bounded
          // PNG/JPEG fallback to the authenticated Node.js converter.
          const convertedBlob = await convertOnServer(canvas);
          finish(convertedBlob);
        } catch (error) {
          fail(
            error instanceof Error
              ? error
              : new Error('Falha ao processar a imagem.'),
          );
        }
      })();
    };

    img.onerror = () => {
      fail(
        new Error(
          'Não foi possível ler esta imagem. O teu navegador pode não suportar este formato.',
        ),
      );
    };

    img.src = objectUrl;
  });
}
