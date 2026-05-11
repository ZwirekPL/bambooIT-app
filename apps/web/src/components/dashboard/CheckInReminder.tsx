'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';

export function CheckInReminder() {
  const t = useTranslations('dashboard.checkinReminder');
  const { data: session } = useSession();
  const token = '';

  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.checkIns.list({ limit: 1 }, token)
      .then((res) => {
        const checkins = res.checkIns ?? [];
        if (checkins.length === 0) {
          setDaysSince(null);
        } else {
          const latest = new Date(checkins[0].createdAt);
          setDaysSince(Math.floor((Date.now() - latest.getTime()) / 86400000));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [token]);

  if (!loaded) return null;
  // Show only if no check-in or last check-in > 3 days ago
  if (daysSince !== null && daysSince < 3) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {daysSince === null ? t('noCheckIn') : t('lastCheckIn', { days: daysSince })}
            </p>
            <p className="text-xs text-amber-600">{t('description')}</p>
          </div>
        </div>
        <Link href="/dashboard/postep" className="text-sm font-medium text-amber-700 hover:underline shrink-0">
          {t('cta')} →
        </Link>
      </CardContent>
    </Card>
  );
}
