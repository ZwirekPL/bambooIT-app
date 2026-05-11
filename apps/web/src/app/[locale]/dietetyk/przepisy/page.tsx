import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { RecipeList } from '@/components/dietitian/RecipeList';

export default async function PrzepisyPage() {
  const session = await auth();
  const t = await getTranslations('dietitian');
  const token = await getBackendToken() ?? '';

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('recipes.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('recipes.subtitle')}</p>
      </div>
      <RecipeList token={token} />
    </div>
  );
}
