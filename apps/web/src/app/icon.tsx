import { ImageResponse } from 'next/og';

// bambooIT favicon — generated, no binary asset. Navy rounded tile with a
// bamboo-green lowercase "b" wordmark initial. Replaces the legacy favicon.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1A2735',
          color: '#8BC34A',
          fontSize: 24,
          fontWeight: 800,
          borderRadius: 7,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        b
      </div>
    ),
    { ...size },
  );
}
