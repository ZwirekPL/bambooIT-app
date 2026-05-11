import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-compatible auth config — NO Node.js-only imports here.
 * Used by middleware for route protection.
 *
 * pages.signIn includes the default locale prefix because
 * next-intl uses localePrefix: 'always'.
 */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — must match IdleLogout.tsx
const IDLE_COOKIE = 'idle_last_activity';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/pl/zaloguj',
  },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.includes('/dashboard') ||
        nextUrl.pathname.includes('/dietetyk') ||
        nextUrl.pathname.includes('/admin');
      if (!isProtected) return true;
      if (!isLoggedIn) return false;

      // Idle timeout enforcement (server-side).
      // IdleLogout component writes a cookie with the last activity timestamp
      // on every interaction (Max-Age = IDLE_TIMEOUT). If the browser was
      // closed for longer than IDLE_TIMEOUT, the cookie is gone → treat as
      // expired and redirect to login. This eliminates the brief flash of
      // logged-in UI on cold page load.
      const raw = request.cookies.get(IDLE_COOKIE)?.value;
      if (!raw) return false;
      const last = parseInt(raw, 10);
      if (!Number.isFinite(last)) return false;
      if (Date.now() - last >= IDLE_TIMEOUT_MS) return false;

      return true;
    },
  },
  providers: [],
};
