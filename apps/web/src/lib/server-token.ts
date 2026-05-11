import 'server-only';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';

/**
 * Server-only helper that reads the backend API JWT from the encrypted
 * NextAuth session cookie. This token is intentionally NOT exposed via
 * `session.user` (it would be readable by client JS via useSession),
 * so this is the only path to get it on the server.
 *
 * Usage in Server Components / Route Handlers / Server Actions:
 *
 *   const token = await getBackendToken();
 *   if (!token) redirect('/zaloguj');
 *   const data = await api.foo.bar(token);
 */
const COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

export async function getBackendToken(): Promise<string | undefined> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return undefined;

  try {
    const decoded = await decode({
      token: raw,
      secret: process.env.AUTH_SECRET!,
      salt: COOKIE_NAME,
    });
    return (decoded as { backendToken?: string } | null)?.backendToken;
  } catch {
    return undefined;
  }
}
