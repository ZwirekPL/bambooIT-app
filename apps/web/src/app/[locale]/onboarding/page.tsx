import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const session = await auth();
  const locale = await getLocale();

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  // Only patients need onboarding
  if (session?.user?.role !== 'PATIENT') {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <OnboardingStepper />
    </div>
  );
}
