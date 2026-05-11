'use client';

import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Calculator } from 'lucide-react';

interface SettingsPanelProps {
  initialSettings: Record<string, unknown>;
}

export function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const { data: session } = useSession();
  const t = useTranslations('admin.settings');
  const token = '';

  const [paywallEnabled, setPaywallEnabled] = useState<boolean>(
    initialSettings.paywall_enabled === true,
  );
  const [vatEnabled, setVatEnabled] = useState<boolean>(
    initialSettings.vat_enabled === true,
  );
  const [vatRate, setVatRate] = useState(
    String(initialSettings.vat_rate ?? 23),
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [vatMessage, setVatMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handlePaywallToggle() {
    const next = !paywallEnabled;
    setPaywallEnabled(next);
    setMessage(null);

    startTransition(async () => {
      try {
        await api.admin.patchSettings({ paywall_enabled: next }, token);
        setMessage({ type: 'success', text: t('saved') });
      } catch {
        setPaywallEnabled(!next);
        setMessage({ type: 'error', text: t('error') });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Paywall */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('paywall')}
          </CardTitle>
          <CardDescription>{t('paywallDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {paywallEnabled ? t('paywallEnabled') : t('paywallDisabled')}
              </p>
            </div>
            <Button
              size="sm"
              variant={paywallEnabled ? 'destructive' : 'default'}
              onClick={handlePaywallToggle}
              disabled={isPending}
            >
              {paywallEnabled ? t('paywallToggleOff') : t('paywallToggleOn')}
            </Button>
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* VAT (70.1) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t('vatTitle')}
          </CardTitle>
          <CardDescription>{t('vatDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {vatEnabled ? t('vatEnabled') : t('vatDisabled')}
              </p>
            </div>
            <Button
              size="sm"
              variant={vatEnabled ? 'destructive' : 'default'}
              onClick={() => {
                const next = !vatEnabled;
                setVatEnabled(next);
                setVatMessage(null);
                startTransition(async () => {
                  try {
                    await api.admin.patchSettings({ vat_enabled: next }, token);
                    setVatMessage({ type: 'success', text: t('saved') });
                  } catch {
                    setVatEnabled(!next);
                    setVatMessage({ type: 'error', text: t('error') });
                  }
                });
              }}
              disabled={isPending}
            >
              {vatEnabled ? t('vatToggleOff') : t('vatToggleOn')}
            </Button>
          </div>

          {vatEnabled && (
            <div className="flex items-end gap-3">
              <div className="space-y-2 flex-1">
                <Label htmlFor="vat_rate">{t('vatRateLabel')}</Label>
                <Input
                  id="vat_rate"
                  type="number"
                  min="0"
                  max="100"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setVatMessage(null);
                  startTransition(async () => {
                    try {
                      await api.admin.patchSettings({ vat_rate: parseFloat(vatRate) || 23 }, token);
                      setVatMessage({ type: 'success', text: t('saved') });
                    } catch {
                      setVatMessage({ type: 'error', text: t('error') });
                    }
                  });
                }}
                disabled={isPending}
              >
                {t('vatSave')}
              </Button>
            </div>
          )}

          {vatMessage && (
            <p className={`text-sm ${vatMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {vatMessage.text}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
