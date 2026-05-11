import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'e-dietetyk.com — Twój dietetyk online';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #bbf7d0 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #1F8F3A, #F57C00)',
          }}
        />

        {/* Logo circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#1F8F3A',
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 40, color: '#fff', fontWeight: 800 }}>e</span>
        </div>

        {/* Brand name */}
        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#1F8F3A',
            margin: '0 0 12px 0',
            letterSpacing: '-1px',
          }}
        >
          e-dietetyk.com
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 28,
            color: '#374151',
            margin: '0 0 32px 0',
            fontWeight: 500,
          }}
        >
          Twój dietetyk online — AI + opieka dietetyka
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['AI + Dietetyk', 'Zgodne z RODO', '6600+ produktów'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '10px 24px',
                borderRadius: 999,
                backgroundColor: 'rgba(31, 143, 58, 0.12)',
                color: '#1F8F3A',
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Domain footer */}
        <p
          style={{
            position: 'absolute',
            bottom: 24,
            fontSize: 16,
            color: '#9ca3af',
          }}
        >
          https://e-dietetyk.com
        </p>
      </div>
    ),
    { ...size },
  );
}
