import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

class SessionAlreadyActiveError extends CredentialsSignin {
  code = 'session_already_active';
}

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'email_not_verified';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        deviceFingerprint: { label: 'Device Fingerprint', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
        const deviceFingerprint = typeof credentials?.deviceFingerprint === 'string'
          ? credentials.deviceFingerprint
          : undefined;

        try {
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...parsed.data, deviceFingerprint }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (body?.error?.code === 'SESSION_ALREADY_ACTIVE') {
              throw new SessionAlreadyActiveError();
            }
            if (body?.error?.code === 'EMAIL_NOT_VERIFIED') {
              throw new EmailNotVerifiedError();
            }
            return null;
          }

          const data = await res.json();
          if (!data.ok || !data.user) return null;

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.firstName ?? data.user.email,
            role: data.user.role,
            companyId: data.user.companyId ?? null,
            backendToken: data.token,
          };
        } catch (err) {
          if (err instanceof SessionAlreadyActiveError) throw err;
          if (err instanceof EmailNotVerifiedError) throw err;
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days — match backend JWT expiry
    updateAge: 24 * 60 * 60, // refresh cookie at most once per 24h while user is active
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: string; companyId?: string | null; backendToken?: string };
        token.role = u.role;
        token.companyId = u.companyId ?? null;
        token.backendToken = u.backendToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as { sub?: string; role?: string; companyId?: string | null };
        if (t.sub) session.user.id = t.sub;
        session.user.role = t.role;
        session.user.companyId = t.companyId ?? null;
        // NOTE: backendToken is intentionally NOT exposed via session.user.
        // It stays in the encrypted JWT cookie and is read server-side only
        // via getBackendToken() in src/lib/server-token.ts. Client API calls
        // go through /api/proxy/* which injects the token server-side.
      }
      return session;
    },
  },
});
