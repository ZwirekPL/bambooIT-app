import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { api } from '@/lib/api';
import type { NoteTemplate } from '@/types/api';
import { NoteTemplateManager } from '@/components/dietitian/NoteTemplateManager';

export default async function TemplatesPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  const t = await getTranslations('dietitian.templates');

  let templates: NoteTemplate[] = [];
  try {
    const res = await api.noteTemplates.list(token);
    templates = res.templates;
  } catch {
    // Will show empty state
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <NoteTemplateManager
        initialTemplates={templates}
        token={token}
        labels={{
          addNew: t('addNew'),
          editTemplate: t('editTemplate'),
          deleteTemplate: t('deleteTemplate'),
          titleLabel: t('titleLabel'),
          titlePlaceholder: t('titlePlaceholder'),
          contentLabel: t('contentLabel'),
          contentPlaceholder: t('contentPlaceholder'),
          categoryLabel: t('categoryLabel'),
          categoryPlaceholder: t('categoryPlaceholder'),
          save: t('save'),
          saving: t('saving'),
          cancel: t('cancel'),
          empty: t('empty'),
          deleteConfirm: t('deleteConfirm'),
          successCreate: t('successCreate'),
          successUpdate: t('successUpdate'),
          successDelete: t('successDelete'),
          error: t('error'),
        }}
      />
    </div>
  );
}
