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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper">
      <main className="mx-auto w-full max-w-[1100px] px-5 py-12 md:px-10 md:py-16">
        {children}
      </main>
    </div>
  );
}
