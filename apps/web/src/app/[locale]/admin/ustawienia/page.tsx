import { Metadata } from 'next';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { api } from '@/lib/api';
import { SettingsPanel } from '@/components/admin/SettingsPanel';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.settings');
  return { title: t('title') };
}

export default async function AdminSettingsPage() {
  const session = await auth();
  const t = await getTranslations('admin.settings');
  const token = await getBackendToken() ?? '';

  let settings: Record<string, unknown> = {};
  try {
    const res = await api.admin.getSettings(token);
    settings = res.settings;
  } catch {
    // empty settings on error
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SettingsPanel initialSettings={settings} />
    </div>
  );
}
