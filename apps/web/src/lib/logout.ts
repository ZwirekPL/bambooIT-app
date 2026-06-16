import { signOut } from 'next-auth/react';

/**
 * Full logout: invalidates backend session (Redis) via the server-side proxy,
 * then clears the NextAuth cookie. Falls back to NextAuth-only signOut if the
 * backend call fails. The backend token is never read on the client — the
 * proxy injects it from the encrypted JWT cookie.
 */
export async function performFullLogout(callbackUrl = '/') {
  try {
    // Hard 3s timeout — never block logout UX on a hung backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    await fetch('/api/proxy/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    })
      .catch(() => {
        // Swallow network/abort errors — still proceed with NextAuth signOut
      })
      .finally(() => clearTimeout(timeoutId));
  } catch {
    // Swallow errors — always sign out on frontend
  }

  // Clear idle activity cookie + storage so middleware redirects on next nav
  try {
    localStorage.removeItem('idle:lastActivity');
  } catch { /* SSR-safe */ }
  if (typeof document !== 'undefined') {
    document.cookie = 'idle_last_activity=; Path=/; SameSite=Lax; Max-Age=0';
  }

  // signOut() hits /api/auth/* — never let its failure (e.g. no origin in the
  // test env, or a network blip) reject performFullLogout. We always proceed to
  // the hard redirect, which clears the session regardless.
  try {
    await signOut({ redirect: false });
  } catch {
    /* ignore — fall through to hard redirect */
  }
  window.location.href = callbackUrl;
}
