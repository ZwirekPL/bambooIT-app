'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PLAN_STATUS_FILTERS = [
  { key: 'filterAll', value: '' },
  { key: 'filterNone', value: 'NONE' },
  { key: 'filterAiDraft', value: 'AI_DRAFT' },
  { key: 'filterGenerated', value: 'GENERATED' },
  { key: 'filterPublished', value: 'PUBLISHED' },
] as const;

const INTERVIEW_FILTERS = [
  { key: 'interviewAll', value: '' },
  { key: 'interviewNone', value: 'none' },
  { key: 'interviewStale', value: 'stale' },
] as const;

export function PatientSearchForm() {
  const t = useTranslations('dietitian.patients');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentPlanStatus = searchParams.get('planStatus') ?? '';
  const currentInterviewFilter = searchParams.get('interviewFilter') ?? '';

  const pushParams = useCallback(
    (nextSearch: string, nextPlanStatus: string, nextInterviewFilter: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextSearch) params.set('search', nextSearch); else params.delete('search');
      if (nextPlanStatus) params.set('planStatus', nextPlanStatus); else params.delete('planStatus');
      if (nextInterviewFilter) params.set('interviewFilter', nextInterviewFilter); else params.delete('interviewFilter');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams(value, currentPlanStatus, currentInterviewFilter);
    }, 300);
  };

  const handlePlanFilterClick = (value: string) => {
    pushParams(search, value, currentInterviewFilter);
  };

  const handleInterviewFilterClick = (value: string) => {
    pushParams(search, currentPlanStatus, value);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {PLAN_STATUS_FILTERS.map(({ key, value }) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            onClick={() => handlePlanFilterClick(value)}
            className={cn(
              'text-xs',
              currentPlanStatus === value && 'bg-sage-100 border-sage-300 text-sage-800'
            )}
          >
            {t(key)}
          </Button>
        ))}
      </div>

      {/* IW-17: Interview status filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">{t('interviewFilterLabel')}:</span>
        {INTERVIEW_FILTERS.map(({ key, value }) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            onClick={() => handleInterviewFilterClick(value)}
            className={cn(
              'text-xs',
              currentInterviewFilter === value && 'bg-amber-50 border-amber-300 text-amber-800'
            )}
          >
            {t(key)}
          </Button>
        ))}
      </div>
    </div>
  );
}
