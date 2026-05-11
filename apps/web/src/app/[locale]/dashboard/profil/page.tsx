import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { ProfileForm } from '@/components/dashboard/ProfileForm';
import { NotificationSettings } from '@/components/dashboard/NotificationSettings';
import { ReferralCard } from '@/components/dashboard/ReferralCard';
import { DataPrivacyPanel } from '@/components/dashboard/DataPrivacyPanel';
import { DeleteAccountSection } from '@/components/dashboard/DeleteAccountSection';
import { RestartTourButton } from '@/components/dashboard/RestartTourButton';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.profile');
  return { title: t('title') };
}

export default async function ProfilePage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dashboard.profile');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();

  let patient = null;
  if (token) {
    try {
      const res = await api.profile.get(token);
      patient = res.patient;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        // unexpected error — render empty state below
      }
    }
  }

  if (!patient) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('noProfile')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Card className="border-border" data-tour="pt-profile-form">
        <CardContent className="py-6">
          <ProfileForm patient={patient} />
        </CardContent>
      </Card>

      <Card className="border-border" data-tour="pt-notifications">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold">{t('notificationsTitle')}</h2>
          </div>
          <NotificationSettings />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="py-6">
          <ReferralCard />
        </CardContent>
      </Card>

      {/* RODO data & privacy panel */}
      <div data-tour="pt-data-privacy">
        <DataPrivacyPanel />
      </div>

      {/* RODO Art. 17 — delete account (66.2) */}
      <div data-tour="pt-delete-account">
        <DeleteAccountSection />
      </div>

      {/* Restart tour */}
      <RestartTourButton />
    </div>
  );
}
