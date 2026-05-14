import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const locale = await getLocale();

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const role = session?.user?.role;
  if (role !== 'ADMIN') {
    // Non-admin clients land on their subscription panel — /dashboard never
    // existed in bambooIT (legacy e-dietetyk route).
    redirect({ href: '/panel/subskrypcja', locale });
  }

  const email = session?.user?.email ?? '';

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      <AdminSidebar email={email} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
