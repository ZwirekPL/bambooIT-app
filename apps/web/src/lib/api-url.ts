/**
 * Returns the backend API base URL, adapting the hostname for LAN access.
 *
 * When running in the browser on a non-localhost host (e.g. 192.168.x.x),
 * replaces the hostname from NEXT_PUBLIC_API_URL with the current browser
 * hostname so that API calls work from LAN devices (phones, tablets).
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  if (typeof window === 'undefined') return envUrl;

  try {
    const url = new URL(envUrl);
    const browserHost = window.location.hostname;

    // Only rewrite if browser is on a different host than the env URL
    if (url.hostname !== browserHost) {
      return `${url.protocol}//${browserHost}:${url.port}`;
    }
  } catch {
    // Invalid URL — fall through
  }

  return envUrl;
}
