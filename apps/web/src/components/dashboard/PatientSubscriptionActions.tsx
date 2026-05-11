'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { Loader2, XCircle, RotateCcw, ShieldAlert } from 'lucide-react';

interface PatientSubscriptionActionsProps {
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string;
  token: string;
}

export function PatientSubscriptionActions({
  cancelAtPeriodEnd,
  subscriptionStatus,
  token,
}: PatientSubscriptionActionsProps) {
  const t = useTranslations('dashboard.subscription');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [withdrawEligible, setWithdrawEligible] = useState(false);
  const [withdrawDaysLeft, setWithdrawDaysLeft] = useState(0);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const isActive = subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING';

  useEffect(() => {
    api.orders.canWithdraw(token)
      .then((res) => {
        setWithdrawEligible(res.eligible);
        setWithdrawDaysLeft(res.daysLeft ?? 0);
      })
      .catch(() => {});
  }, [token]);

  async function handleCancel() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.orders.cancelSubscription(token);
      setSuccess(t('cancelSuccess'));
      router.refresh();
    } catch {
      setError(t('actionError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.orders.resumeSubscription(token);
      setSuccess(t('resumeSuccess'));
      router.refresh();
    } catch {
      setError(t('actionError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    setError(null);
    setSuccess(null);
    setWithdrawLoading(true);
    try {
      await api.orders.withdraw(token);
      setSuccess(t('withdrawSuccess'));
      setWithdrawEligible(false);
      router.refresh();
    } catch {
      setError(t('actionError'));
    } finally {
      setWithdrawLoading(false);
    }
  }

  if (!isActive && !cancelAtPeriodEnd && !withdrawEligible) return null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700">{success}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Cancel / Resume */}
        {isActive && !cancelAtPeriodEnd && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={loading}
                className="gap-2 text-destructive hover:text-destructive"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {t('cancelButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('cancelConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cancelConfirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancelConfirmCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCancel}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('cancelConfirmAction')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {cancelAtPeriodEnd && (
          <Button
            variant="outline"
            onClick={handleResume}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {t('resumeButton')}
          </Button>
        )}

        {/* 14-day withdrawal */}
        {withdrawEligible && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={withdrawLoading}
                className="gap-2 text-amber-700 hover:text-amber-800"
              >
                {withdrawLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                {t('withdrawButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('withdrawConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span>{t('withdrawConfirmDesc')}</span>
                  {withdrawDaysLeft > 0 && (
                    <span className="block text-sm font-medium text-amber-700">
                      {t('withdrawDaysLeft', { days: withdrawDaysLeft })}
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('withdrawConfirmCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleWithdraw}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {t('withdrawConfirmAction')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
