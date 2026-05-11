import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { InterviewForm } from '@/components/dashboard/InterviewForm';
import { PaywallGate } from '@/components/dashboard/PaywallGate';
import { api } from '@/lib/api';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.interview');
  return { title: t('title') };
}

export default async function InterviewPage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.interview');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();

  // Check paywall access
  let hasAccess = true;
  if (token && session?.user?.role === 'PATIENT') {
    try {
      const accessStatus = await api.access.status(token);
      hasAccess = accessStatus.hasAccess;
    } catch {
      // If access check fails, allow through (fail-open)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PaywallGate hasAccess={hasAccess}>
        <Card className="border-border">
          <CardContent className="py-6">
            <InterviewForm />
          </CardContent>
        </Card>
      </PaywallGate>
    </div>
  );
}
