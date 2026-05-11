'use client';

import { SessionProvider } from 'next-auth/react';
import { IdleLogout } from '@/components/auth/IdleLogout';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleLogout />
      {children}
    </SessionProvider>
  );
}
