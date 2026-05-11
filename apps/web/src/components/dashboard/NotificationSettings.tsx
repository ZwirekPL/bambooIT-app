'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, Bell, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import type { NotificationPreferences } from '@/types/api';

const SELECT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function NotificationSettings() {
  const t = useTranslations('dashboard.notifications');
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailReminders: false,
    breakfastTime: null,
    lunchTime: null,
    dinnerTime: null,
    snackTime: null,
    reminderLeadMinutes: 30,
    weeklySummary: true,
    timezone: 'Europe/Warsaw',
  });

  useEffect(() => {
    const token = '';
    if (!token) return;

    api.profile
      .getNotifications(token)
      .then((res) => {
        setPrefs(res.preferences);
      })
      .catch(() => {
        // Use defaults on error
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const token = '';
    if (!token) return;

    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await api.profile.updateNotifications(prefs, token);
      setPrefs(res.preferences);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('errorGeneral'));
      } else {
        setError(t('errorGeneral'));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-sage-50 border border-sage-200 px-4 py-3 text-sm text-sage-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t('saved')}
        </div>
      )}

      {/* Email reminders toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">{t('emailReminders')}</Label>
          <p className="text-sm text-muted-foreground">{t('emailRemindersDesc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.emailReminders}
          onClick={() => {
            setPrefs((p) => ({ ...p, emailReminders: !p.emailReminders }));
            setSuccess(false);
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            prefs.emailReminders ? 'bg-sage-600' : 'bg-input'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
              prefs.emailReminders ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Meal times */}
      {prefs.emailReminders && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-semibold">{t('mealTimes')}</Label>
          </div>
          <p className="text-sm text-muted-foreground">{t('mealTimesDesc')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakfastTime">{t('breakfast')}</Label>
              <Input
                id="breakfastTime"
                type="time"
                value={prefs.breakfastTime ?? ''}
                onChange={(e) => {
                  setPrefs((p) => ({ ...p, breakfastTime: e.target.value || null }));
                  setSuccess(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunchTime">{t('lunch')}</Label>
              <Input
                id="lunchTime"
                type="time"
                value={prefs.lunchTime ?? ''}
                onChange={(e) => {
                  setPrefs((p) => ({ ...p, lunchTime: e.target.value || null }));
                  setSuccess(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dinnerTime">{t('dinner')}</Label>
              <Input
                id="dinnerTime"
                type="time"
                value={prefs.dinnerTime ?? ''}
                onChange={(e) => {
                  setPrefs((p) => ({ ...p, dinnerTime: e.target.value || null }));
                  setSuccess(false);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snackTime">{t('snack')}</Label>
              <Input
                id="snackTime"
                type="time"
                value={prefs.snackTime ?? ''}
                onChange={(e) => {
                  setPrefs((p) => ({ ...p, snackTime: e.target.value || null }));
                  setSuccess(false);
                }}
              />
            </div>
          </div>

          {/* Reminder lead time */}
          <div className="space-y-2">
            <Label htmlFor="reminderLeadMinutes">{t('reminderLead')}</Label>
            <select
              id="reminderLeadMinutes"
              value={prefs.reminderLeadMinutes}
              onChange={(e) => {
                setPrefs((p) => ({ ...p, reminderLeadMinutes: parseInt(e.target.value) }));
                setSuccess(false);
              }}
              className={SELECT_CLASS}
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
        </div>
      )}

      {/* Weekly summary toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">{t('weeklySummary')}</Label>
          <p className="text-sm text-muted-foreground">{t('weeklySummaryDesc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.weeklySummary}
          onClick={() => {
            setPrefs((p) => ({ ...p, weeklySummary: !p.weeklySummary }));
            setSuccess(false);
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            prefs.weeklySummary ? 'bg-sage-600' : 'bg-input'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
              prefs.weeklySummary ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <Button
        type="button"
        variant="sage"
        size="lg"
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto min-h-[48px]"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('save')
        )}
      </Button>
    </div>
  );
}
