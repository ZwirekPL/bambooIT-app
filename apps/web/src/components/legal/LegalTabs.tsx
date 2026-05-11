'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LegalMarkdown } from './LegalMarkdown';

const VALID_TABS = ['privacy', 'terms', 'cookies', 'ai'] as const;
type TabValue = (typeof VALID_TABS)[number];

interface LegalTabsProps {
  privacy: string;
  terms: string;
  cookies: string;
  ai: string;
}

export function LegalTabs({ privacy, terms, cookies, ai }: LegalTabsProps) {
  const t = useTranslations('legal');
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as TabValue | null;
  const defaultTab: TabValue = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'privacy';

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="mb-8 flex flex-wrap h-auto gap-1">
        <TabsTrigger value="privacy">{t('tabPrivacy')}</TabsTrigger>
        <TabsTrigger value="terms">{t('tabTerms')}</TabsTrigger>
        <TabsTrigger value="cookies">{t('tabCookies')}</TabsTrigger>
        <TabsTrigger value="ai">{t('tabAi')}</TabsTrigger>
      </TabsList>

      <TabsContent value="privacy">
        <LegalMarkdown content={privacy} />
      </TabsContent>

      <TabsContent value="terms">
        <LegalMarkdown content={terms} />
      </TabsContent>

      <TabsContent value="cookies">
        <LegalMarkdown content={cookies} />
      </TabsContent>

      <TabsContent value="ai">
        <LegalMarkdown content={ai} />
      </TabsContent>
    </Tabs>
  );
}
