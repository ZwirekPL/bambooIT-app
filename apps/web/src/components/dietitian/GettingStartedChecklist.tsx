'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight, X, Share2, BookOpen, Sparkles, Users, BarChart3, Pill, Wrench, MessageSquare, GitCompareArrows } from 'lucide-react';

interface GettingStartedChecklistProps {
  hasPatients: boolean;
  dietitianCode: string;
}

const CHECKLIST_ITEMS = [
  {
    key: 'share_code',
    icon: Share2,
    href: '/dietetyk/profil',
    checkFn: (props: GettingStartedChecklistProps) => false, // manual dismiss
  },
  {
    key: 'browse_recipes',
    icon: BookOpen,
    href: '/dietetyk/przepisy',
    checkFn: () => false,
  },
  {
    key: 'first_patient',
    icon: Users,
    href: '/dietetyk/pacjenci',
    checkFn: (props: GettingStartedChecklistProps) => props.hasPatients,
  },
  {
    key: 'first_plan',
    icon: Sparkles,
    href: '/dietetyk/pacjenci',
    checkFn: () => false,
  },
  {
    key: 'send_message',
    icon: MessageSquare,
    href: '/dietetyk/wiadomosci',
    checkFn: () => false,
  },
  {
    key: 'check_analytics',
    icon: BarChart3,
    href: '/dietetyk/analityka',
    checkFn: () => false,
  },
  {
    key: 'medication_check',
    icon: Pill,
    href: '/dietetyk/pacjenci',
    checkFn: () => false,
  },
  {
    key: 'repair_slots',
    icon: Wrench,
    href: '/dietetyk/pacjenci',
    checkFn: () => false,
  },
  {
    key: 'compare_plans',
    icon: GitCompareArrows,
    href: '/dietetyk/pacjenci',
    checkFn: () => false,
  },
] as const;

export function GettingStartedChecklist({ hasPatients, dietitianCode }: GettingStartedChecklistProps) {
  const t = useTranslations('dietitian.gettingStarted');
  const [dismissed, setDismissed] = useState(true); // start hidden until we check
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const markComplete = (key: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem('dietitian_checklist_completed', JSON.stringify([...next]));
      return next;
    });
  };

  const handleDismiss = () => {
    localStorage.setItem('dietitian_checklist_dismissed', '1');
    setDismissed(true);
  };

  useEffect(() => {
    const isDismissed = localStorage.getItem('dietitian_checklist_dismissed') === '1';
    if (isDismissed) {
      setDismissed(true);
      return;
    }
    setDismissed(false);

    // Load completed items
    const stored = localStorage.getItem('dietitian_checklist_completed');
    if (stored) {
      try {
        setCompletedItems(new Set(JSON.parse(stored)));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (hasPatients && !completedItems.has('first_patient')) {
      markComplete('first_patient');
    }
  }, [hasPatients]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed) return null;

  const totalDone = CHECKLIST_ITEMS.filter(
    (item) => completedItems.has(item.key) || item.checkFn({ hasPatients, dietitianCode })
  ).length;

  if (totalDone === CHECKLIST_ITEMS.length) {
    // All done — auto-dismiss after showing briefly
    handleDismiss();
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t('title') ?? 'Pierwsze kroki'}</h3>
            <p className="text-xs text-muted-foreground">
              {t('progress', { done: totalDone, total: CHECKLIST_ITEMS.length }) ?? `${totalDone}/${CHECKLIST_ITEMS.length} ukończone`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1.5">
          {CHECKLIST_ITEMS.map((item) => {
            const isDone = completedItems.has(item.key) || item.checkFn({ hasPatients, dietitianCode });
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => markComplete(item.key)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isDone
                    ? 'text-muted-foreground line-through opacity-60'
                    : 'hover:bg-background'
                }`}
              >
                <div className={`flex items-center justify-center h-5 w-5 rounded-full border ${
                  isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                }`}>
                  {isDone && <Check className="h-3 w-3" />}
                </div>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{t(item.key) ?? item.key}</span>
                {!isDone && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
