'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { CheckIn } from '@/types/api';

interface CheckInHistoryProps {
  checkIns: CheckIn[];
}

export function CheckInHistory({ checkIns }: CheckInHistoryProps) {
  const t = useTranslations('dashboard.checkin');

  if (checkIns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('noHistory')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {checkIns.map((ci) => (
        <Card key={ci.id} className="border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {t('date')}: {new Date(ci.createdAt).toLocaleDateString()}
              </span>
              {ci.weightKg != null && (
                <span className="text-sm font-semibold">{ci.weightKg} kg</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground sm:grid-cols-4">
              {ci.compliance != null && (
                <Stat label={t('compliance').replace(/ \(.*/, '')} value={`${ci.compliance}%`} />
              )}
              {ci.hunger != null && (
                <Stat label={t('hunger').replace(/ \(.*/, '')} value={`${ci.hunger}/10`} />
              )}
              {ci.energy != null && (
                <Stat label={t('energy').replace(/ \(.*/, '')} value={`${ci.energy}/10`} />
              )}
              {ci.sleep != null && (
                <Stat label={t('sleep').replace(/ \(.*/, '')} value={`${ci.sleep}/10`} />
              )}
              {ci.activity != null && (
                <Stat label={t('activity').replace(/ \(.*/, '')} value={`${ci.activity}/10`} />
              )}
            </div>
            {/* 79.2: GI section — shown only when data present */}
            {(ci.digestion != null || ci.bloating != null || ci.stoolBristol != null) && (
              <div className="mt-2 pt-2 border-t border-amber-200/50">
                <p className="text-xs text-amber-700 font-medium mb-1">Trawienie</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground sm:grid-cols-3">
                  {ci.digestion != null && (
                    <Stat label="Komfort" value={`${ci.digestion}/10`} />
                  )}
                  {ci.bloating != null && (
                    <Stat label="Wzdęcia" value={ci.bloating ? 'Tak' : 'Nie'} />
                  )}
                  {ci.stoolBristol != null && (
                    <Stat label="Bristol" value={`${ci.stoolBristol}/7`} />
                  )}
                </div>
              </div>
            )}
            {ci.notes && (
              <p className="mt-2 text-sm text-muted-foreground italic">{ci.notes}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs">{label}:</span>{' '}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
