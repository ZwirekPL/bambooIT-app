import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { PatientTour } from '@/components/dashboard/PatientTour';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Check if the patient must complete onboarding before accessing the dashboard.
 * Returns true if onboarding pre-requisites (profile + trial) are done.
 * Interview step is allowed from within the dashboard itself.
 */
async function checkOnboardingPrereqs(token: string): Promise<boolean> {
  try {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/onboarding/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return true; // On error, don't block
    const data = await res.json();
    // Allow dashboard access if profile and trial are complete
    // (interview is done inside the dashboard)
    return data.profileComplete === true && data.trialActive === true;
  } catch {
    return true; // On network error, don't block
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const locale = await getLocale();

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const role = session?.user?.role;

  if (role === 'ADMIN') {
    redirect({ href: '/admin', locale });
  }

  if (role === 'DIETITIAN') {
    redirect({ href: '/dietetyk', locale });
  }

  // Block dashboard access until onboarding is complete (29.4.4)
  const token = await getBackendToken();
  if (token) {
    const prereqsDone = await checkOnboardingPrereqs(token);
    if (!prereqsDone) {
      redirect({ href: '/onboarding', locale });
    }
  }

  const email = session?.user?.email ?? '';

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
      <DashboardSidebar email={email} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      <PatientTour />
    </div>
  );
}
