'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Shield, Download, ExternalLink, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Consent {
  type: string;
  granted: boolean;
  grantedAt: string;
  version?: string;
}

/** Maps consent types from backend to translation keys */
const CONSENT_CONFIG: Record<string, { labelKey: string; revocable: boolean }> = {
  healthDataProcessing: { labelKey: 'consentHealth', revocable: false },
  aiDisclaimer: { labelKey: 'consentAi', revocable: false },
  emailNotifications: { labelKey: 'consentEmail', revocable: true },
  terms: { labelKey: 'consentTerms', revocable: false },
  privacy: { labelKey: 'consentPrivacy', revocable: false },
};

export function DataPrivacyPanel() {
  const t = useTranslations('dataPrivacy');
  const { data: session } = useSession();
  const token = '';

  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchConsents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.profile.getConsents(token);
      setConsents(res.consents);
    } catch {
      // Silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const data = await api.profile.exportData(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `e-dietetyk-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
      // Error handling — could show a toast
    } finally {
      setExporting(false);
    }
  }

  async function handleRevoke(type: string) {
    if (!token) return;
    setRevoking(type);
    try {
      await api.profile.revokeConsent(type, token);
      await fetchConsents();
    } catch {
      // Error handling
    } finally {
      setRevoking(null);
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-sage-600" />
          <div>
            <h2 className="text-lg font-semibold">{t('title')}</h2>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>

        {/* Active consents */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('activeConsents')}</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(CONSENT_CONFIG).map(([type, config]) => {
                const consent = consents.find((c) => c.type === type);
                const isGranted = consent?.granted ?? false;

                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full shrink-0 ${
                          isGranted ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      <div>
                        <span className="text-sm">{t(config.labelKey)}</span>
                        {consent?.version && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t('version')}: {consent.version}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.revocable ? (
                        <Badge variant="secondary" className="text-xs">
                          {t('consentOptional')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t('consentRequired')}
                        </Badge>
                      )}
                      {config.revocable && isGranted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          disabled={revoking === type}
                          onClick={() => handleRevoke(type)}
                        >
                          {revoking === type ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t('revokeConsent')
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Data export */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
          <h3 className="text-sm font-medium mb-1">{t('exportTitle')}</h3>
          <p className="text-xs text-muted-foreground mb-3">{t('exportDescription')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('exporting')}
              </>
            ) : exportDone ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-600" />
                {t('exportSuccess')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('exportButton')}
              </>
            )}
          </Button>
        </div>

        {/* GDPR rights info */}
        <div className="text-sm text-muted-foreground space-y-2">
          <h3 className="text-sm font-medium text-foreground">{t('rightsTitle')}</h3>
          <p className="text-xs">{t('rightsText')}</p>
          <Link
            href="/dokumenty-prawne?tab=privacy"
            className="inline-flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 hover:underline"
          >
            {t('rightsLink')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
