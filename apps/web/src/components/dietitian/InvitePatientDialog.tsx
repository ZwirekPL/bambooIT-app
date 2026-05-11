'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Mail, CheckCircle } from 'lucide-react';

interface InvitePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
}

export function InvitePatientDialog({ open, onOpenChange, token }: InvitePatientDialogProps) {
  const t = useTranslations('dietitian.invite');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError(t('emailRequired') ?? 'Podaj adres e-mail');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.invitePatient(email.trim(), token);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError(t('emailExists') ?? 'Ten adres e-mail jest już zarejestrowany');
        } else {
          setError(err.message);
        }
      } else {
        setError(t('error') ?? 'Wystąpił błąd. Spróbuj ponownie.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail('');
      setError('');
      setSuccess(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('title') ?? 'Zaproś pacjenta'}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-medium">{t('successTitle') ?? 'Zaproszenie wysłane!'}</p>
            <p className="text-sm text-muted-foreground">
              {t('successDesc') ?? 'Pacjent otrzyma e-mail z linkiem do rejestracji i Twoim kodem dietetyka.'}
            </p>
            <Button variant="outline" onClick={() => { setSuccess(false); }}>
              {t('inviteAnother') ?? 'Zaproś kolejną osobę'}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {t('desc') ?? 'Podaj adres e-mail pacjenta. Otrzyma zaproszenie z linkiem do rejestracji i Twoim kodem dietetyka.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('emailLabel') ?? 'E-mail pacjenta'}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder') ?? 'jan.kowalski@email.pl'}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t('cancel') ?? 'Anuluj'}
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                <Mail className="h-4 w-4" />
                {loading ? (t('sending') ?? 'Wysyłam...') : (t('send') ?? 'Wyślij zaproszenie')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
