'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ChevronRight, User, ClipboardList, Leaf, Sparkles, Ruler } from 'lucide-react';

interface PatientEmptyStateProps {
  token: string;
  hasPlan: boolean;
}

interface ChecklistItem {
  key: string;
  icon: React.ElementType;
  href: string;
}

const ITEMS: ChecklistItem[] = [
  { key: 'profile', icon: User, href: '/dashboard/profil' },
  { key: 'interview', icon: ClipboardList, href: '/dashboard/wywiad' },
  { key: 'plan', icon: Leaf, href: '/dashboard/plan' },
  { key: 'measurements', icon: Ruler, href: '/dashboard/pomiary' },
];

export function PatientEmptyState({ token, hasPlan }: PatientEmptyStateProps) {
  const t = useTranslations('dashboard.emptyState');
  const [profileDone, setProfileDone] = useState(false);
  const [interviewDone, setInterviewDone] = useState(false);
  const [measurementsDone, setMeasurementsDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.onboarding.getStatus(token),
      api.measurements.list(token, 1).catch(() => null),
    ])
      .then(([status, measurements]) => {
        setProfileDone(status.profileComplete);
        setInterviewDone(status.interviewComplete);
        if (measurements && Array.isArray(measurements.items) && measurements.items.length > 0) {
          setMeasurementsDone(true);
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return null;

  const isDone = (key: string) => {
    if (key === 'profile') return profileDone;
    if (key === 'interview') return interviewDone;
    if (key === 'plan') return hasPlan;
    if (key === 'measurements') return measurementsDone;
    return false;
  };

  const allDone = ITEMS.every((item) => isDone(item.key));
  if (allDone) return null;

  const completedCount = ITEMS.filter((item) => isDone(item.key)).length;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('title') ?? 'Przygotuj swój plan diety'}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t('subtitle', { done: completedCount, total: ITEMS.length }) ?? `${completedCount}/${ITEMS.length} kroków ukończone`}
        </p>
        <div className="space-y-1.5">
          {ITEMS.map((item) => {
            const done = isDone(item.key);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  done ? 'text-muted-foreground line-through opacity-60' : 'hover:bg-background'
                }`}
              >
                <div className={`flex items-center justify-center h-5 w-5 rounded-full border ${
                  done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                }`}>
                  {done && <Check className="h-3 w-3" />}
                </div>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{t(item.key) ?? item.key}</span>
                {!done && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
