import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { DietitianOnboardingStepper } from '@/components/dietitian/DietitianOnboardingStepper';

export default async function DietitianOnboardingPage() {
  const session = await auth();
  const t = await getTranslations('dietitian.onboarding');
  const token = await getBackendToken() ?? '';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <DietitianOnboardingStepper token={token} />
    </div>
  );
}
