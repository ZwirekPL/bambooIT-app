'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { Milestone } from '@/types/api';

interface MilestonesProps {
  milestones: Milestone[];
}

const ICON_MAP: Record<string, string> = {
  first_checkin: '1',
  first_week: '7',
  first_month: '30',
  kg_1: '1',
  kg_2: '2',
  kg_5: '5',
  kg_10: '10',
  goal_reached: '!',
  five_checkins: '5',
  ten_checkins: '10',
};

export function Milestones({ milestones }: MilestonesProps) {
  const t = useTranslations('dashboard.progress.milestones');

  const achieved = milestones.filter((m) => m.achieved);
  const pending = milestones.filter((m) => !m.achieved);

  if (milestones.length === 0) return null;

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          <span className="text-xs text-muted-foreground">
            {t('count', { achieved: achieved.length, total: milestones.length })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {milestones.map((m) => (
            <MilestoneBadge key={m.id} milestone={m} t={t} />
          ))}
        </div>

        {/* Next milestone hint */}
        {pending.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('next')}: {getMilestoneLabel(pending[0], t)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MilestoneBadge({
  milestone,
  t,
}: {
  milestone: Milestone;
  t: ReturnType<typeof useTranslations>;
}) {
  const label = getMilestoneLabel(milestone, t);

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-all ${
        milestone.achieved
          ? 'bg-sage-50 dark:bg-sage-950 border border-sage-200 dark:border-sage-800'
          : 'bg-muted/50 border border-transparent opacity-50'
      }`}
      title={
        milestone.achievedAt
          ? `${label} — ${new Date(milestone.achievedAt).toLocaleDateString()}`
          : label
      }
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
          milestone.achieved
            ? 'bg-sage-600 text-white'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {milestone.achieved ? getIcon(milestone.id) : getIcon(milestone.id)}
      </div>
      <span className="text-[10px] leading-tight line-clamp-2">
        {label}
      </span>
    </div>
  );
}

function getIcon(id: string): string {
  if (id === 'goal_reached') return '\u2605'; // star
  return ICON_MAP[id] ?? '?';
}

function getMilestoneLabel(
  m: Milestone,
  t: ReturnType<typeof useTranslations>
): string {
  try {
    if (m.params && 'kg' in m.params) {
      return t(m.label, { kg: m.params.kg });
    }
    return t(m.label);
  } catch {
    return m.label;
  }
}
