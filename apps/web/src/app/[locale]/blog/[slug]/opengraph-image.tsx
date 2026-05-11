import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Blog e-dietetyk.com';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let title = 'Blog — e-dietetyk.com';
  let category = '';
  try {
    const res = await fetch(`${API_URL}/posts/${slug}`);
    if (res.ok) {
      const data = await res.json();
      title = data.post?.title ?? title;
      category = data.post?.category ?? '';
    }
  } catch {
    // Use fallback title
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 64px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top accent */}
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

        {/* Category badge */}
        <div style={{ display: 'flex' }}>
          {category && (
            <div
              style={{
                display: 'flex',
                padding: '8px 20px',
                borderRadius: 999,
                backgroundColor: 'rgba(31, 143, 58, 0.15)',
                color: '#1F8F3A',
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {category}
            </div>
          )}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: title.length > 60 ? 40 : 48,
            fontWeight: 800,
            color: '#111827',
            lineHeight: 1.2,
            maxWidth: '90%',
            margin: 0,
          }}
        >
          {title}
        </h1>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#1F8F3A',
              }}
            >
              <span style={{ fontSize: 22, color: '#fff', fontWeight: 800 }}>e</span>
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#1F8F3A' }}>e-dietetyk.com</span>
          </div>
          <span style={{ fontSize: 16, color: '#9ca3af' }}>Blog</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
