'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';

/**
 * Z1: per-dietitian grey-list window setting (0-4 previous plans).
 * Mounted on the dietitian profile page beneath the main profile form.
 */
export function GreyListWindowSettings() {
  const t = useTranslations('dietitian.profile');
  const { data: session } = useSession();
  const token = (session as { backendToken?: string } | null)?.backendToken ?? '';

  const [value, setValue] = useState<string>('1');
  const [effective, setEffective] = useState<number | null>(null);
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      try {
        const res = await api.dietitian.getGreyListWindow(token);
        if (cancelled) return;
        setValue(String(res.override ?? res.effective));
        setEffective(res.effective);
        setMin(res.min);
        setMax(res.max);
      } catch {
        if (!cancelled) setMessage({ type: 'error', text: t('errorGeneral') });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  function handleSave() {
    setMessage(null);
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setMessage({ type: 'error', text: t('greyListRange') });
      return;
    }
    startTransition(async () => {
      try {
        const res = await api.dietitian.setGreyListWindow(parsed, token);
        setEffective(res.effective);
        setValue(String(res.override));
        setMessage({ type: 'success', text: t('greyListSaved') });
      } catch (err) {
        const text = err instanceof ApiError ? err.message : t('errorGeneral');
        setMessage({ type: 'error', text });
      }
    });
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {t('greyListSection')}
        </CardTitle>
        <CardDescription>{t('greyListDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>…</span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3">
              <div className="space-y-2 flex-1">
                <Label htmlFor="grey_list_window">{t('greyListLabel')}</Label>
                <Input
                  id="grey_list_window"
                  type="number"
                  min={min}
                  max={max}
                  step={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('greyListSave')}
              </Button>
            </div>

            {effective !== null && (
              <p className="text-xs text-muted-foreground">
                {t('greyListEffective', { value: effective })}
              </p>
            )}

            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
