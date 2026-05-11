import type { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { auth } from '@/auth';
import { redirect } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { DietitianProfileForm } from '@/components/dietitian/DietitianProfileForm';
import { GreyListWindowSettings } from '@/components/dietitian/GreyListWindowSettings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dietitian.profile');
  return { title: t('title') };
}

export default async function DietitianProfilePage() {
  const session = await auth();
  const locale = await getLocale();
  const t = await getTranslations('dietitian.profile');

  if (!session) {
    redirect({ href: '/zaloguj', locale });
  }

  const token = await getBackendToken();

  let profile = null;
  if (token) {
    try {
      const res = await api.profile.getDietitian(token);
      profile = res.profile;
    } catch {
      // profile not found — render empty state
    }
  }

  if (!profile) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-4 text-muted-foreground">{t('errorGeneral')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <Card className="border-border">
        <CardContent className="py-6">
          <DietitianProfileForm profile={profile} />
        </CardContent>
      </Card>
      <GreyListWindowSettings />
    </div>
  );
}
