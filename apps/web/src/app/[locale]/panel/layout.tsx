import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ClientPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const locale = await getLocale();

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  // The client panel is for CLIENT accounts. Admins have their own area —
  // send them there so they don't hit CLIENT-only endpoints (403). Mirrors
  // the admin/layout guard that redirects clients to /panel.
  if (session?.user?.role === 'ADMIN') {
    redirect({ href: '/admin', locale });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper">
      <main className="mx-auto w-full max-w-[1100px] px-5 py-12 md:px-10 md:py-16">
        {children}
      </main>
    </div>
  );
}
