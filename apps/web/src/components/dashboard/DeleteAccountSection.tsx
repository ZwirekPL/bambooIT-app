'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { performFullLogout } from '@/lib/logout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

export function DeleteAccountSection() {
  const t = useTranslations('dashboard.deleteAccount');
  const { data: session } = useSession();
  const token = '';

  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!token || !password) return;
    setLoading(true);
    setError(null);
    try {
      await api.profile.deleteAccount(password, token);
      await performFullLogout('/pl?deleted=1');
    } catch {
      setError(t('error'));
      setLoading(false);
    }
  }

  return (
    <>
      <div className="border-t border-red-200 pt-6 mt-8">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {t('trigger')}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setConfirmed(false); setPassword(''); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 space-y-2">
              <p className="font-medium">{t('warning')}</p>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>{t('lose1')}</li>
                <li>{t('lose2')}</li>
                <li>{t('lose3')}</li>
              </ul>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="confirm-delete"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="confirm-delete" className="text-sm">{t('confirmCheckbox')}</label>
            </div>

            {confirmed && (
              <div className="space-y-2">
                <Label htmlFor="delete-password">{t('passwordLabel')}</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!confirmed || !password || loading}
            >
              {loading ? '...' : t('deleteButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
