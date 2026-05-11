import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    // NOTE: backendToken is intentionally NOT here. It lives only inside the
    // encrypted JWT cookie and is read server-side via getBackendToken() in
    // src/lib/server-token.ts. Client API calls go through /api/proxy/*.
    user: DefaultSession['user'] & {
      id?: string;
      role?: string;
      patientId?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    patientId?: string | null;
    // backendToken stays in JWT (server-side only, read via getBackendToken)
    backendToken?: string;
  }
}
