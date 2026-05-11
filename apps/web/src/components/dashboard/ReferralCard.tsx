'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Gift, Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { BRAND } from '@/../config/brand';

export function ReferralCard() {
  const t = useTranslations('dashboard.profile');
  const { data: session } = useSession();
  const [referral, setReferral] = useState<{
    code: string;
    discountPercent: number;
    usageCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const token = '';
    if (!token) return;

    api.referrals
      .getMy(token)
      .then((res) => setReferral(res.referral))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  async function copyCode() {
    if (!referral) return;
    await navigator.clipboard.writeText(referral.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function copyLink() {
    if (!referral) return;
    const link = `https://${BRAND.domain}/pl/rejestracja?ref=${referral.code}`;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Gift className="h-4 w-4 animate-pulse" />
        {t('referralLoading')}
      </div>
    );
  }

  if (!referral) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-sage-500" />
        <h2 className="text-lg font-semibold">{t('referralTitle')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('referralDescription')}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t('referralCodeLabel')}
          </label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 rounded-md border border-border bg-muted px-4 py-2.5 text-lg font-mono font-bold tracking-widest text-center select-all">
              {referral.code}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCode}
              className="shrink-0"
            >
              {codeCopied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  {t('referralCopied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('referralCopyButton')}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('referralUsageCount', { count: referral.usageCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyLink}
            className="text-sage-600 hover:text-sage-700"
          >
            {linkCopied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                {t('referralLinkCopied')}
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                {t('referralCopyLink')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
