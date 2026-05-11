import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { AdminRecipeList } from '@/components/admin/AdminRecipeList';
import { AiRecipesPanel } from '@/components/admin/AiRecipesPanel';
import { RecipeDuplicatesPanel } from '@/components/admin/RecipeDuplicatesPanel';
import { RecipeQualityPanel } from '@/components/admin/RecipeQualityPanel';

export default async function AdminPrzepisyPage() {
  await auth();
  const t = await getTranslations('admin');
  const token = await getBackendToken() ?? '';

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('recipes.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('recipes.subtitle')}</p>
      </div>
      <AdminRecipeList token={token} />
      <hr className="border-border" />
      <RecipeQualityPanel token={token} />
      <hr className="border-border" />
      <RecipeDuplicatesPanel token={token} />
      <hr className="border-border" />
      <AiRecipesPanel token={token} />
    </div>
  );
}
