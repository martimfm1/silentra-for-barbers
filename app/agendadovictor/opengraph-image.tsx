import { ImageResponse } from 'next/og';
import { getPublicProfileBySlug } from '@/lib/barbershops/public-profile';

const SLUG = 'silveira-salon-6f1e9637';

export const alt = 'Pré-visualização da página de marcações da Agenda do Victor';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const profile = await getPublicProfileBySlug(SLUG);
  const bannerUrl = profile?.cover_url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 54,
          background: '#101010',
          color: '#f7f5f0',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 28,
            border: '1px solid #373737',
            background: '#171717',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '43%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '46px 38px',
              background: '#202020',
              overflow: 'hidden',
            }}
          >
            {bannerUrl ? (
              <img
                src={bannerUrl}
                width={600}
                height={630}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: bannerUrl
                  ? 'linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.72) 100%)'
                  : '#202020',
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  letterSpacing: 4,
                  color: '#d8c5a8',
                  textTransform: 'uppercase',
                }}
              >
                Marcações online
              </div>
              <div
                style={{
                  fontSize: 54,
                  lineHeight: 1.05,
                  fontWeight: 700,
                  letterSpacing: -2,
                  textShadow: '0 2px 18px rgba(0,0,0,0.35)',
                }}
              >
                Agenda do Victor
              </div>
              <div style={{ fontSize: 20, color: '#f0ede8', lineHeight: 1.45 }}>
                O teu próximo corte começa aqui.
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 15, color: '#e0ddd7' }}>RESERVA SIMPLES E RÁPIDA</div>
              <div style={{ width: 54, height: 3, background: '#d8c5a8', borderRadius: 3 }} />
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '38px 42px',
              background: '#f4f2ed',
              color: '#191919',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 26 }}>
              <div style={{ fontSize: 15, color: '#77736c' }}>AGENDA DO VICTOR</div>
              <div style={{ fontSize: 31, fontWeight: 700 }}>Marca a tua visita</div>
              <div style={{ fontSize: 16, color: '#77736c' }}>Escolhe o serviço ideal para ti</div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 20,
                borderRadius: 18,
                background: '#fff',
                border: '1px solid #e5e1d9',
              }}
            >
              <div style={{ fontSize: 14, color: '#77736c' }}>1. ESCOLHE O SERVIÇO</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 19, fontWeight: 600 }}>
                Corte de cabelo <span style={{ fontSize: 16, color: '#77736c' }}>30 min</span>
              </div>
              <div style={{ height: 1, background: '#e9e6df' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 19, fontWeight: 600 }}>
                Barba <span style={{ fontSize: 16, color: '#77736c' }}>20 min</span>
              </div>
              <div style={{ height: 1, background: '#e9e6df' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 19, fontWeight: 600 }}>
                Corte + Barba <span style={{ fontSize: 16, color: '#77736c' }}>50 min</span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 18,
                padding: '15px 20px',
                borderRadius: 12,
                background: '#202020',
                color: '#fff',
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              Continuar com a marcação
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
