'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { InvitePatientDialog } from './InvitePatientDialog';

interface InvitePatientButtonProps {
  token: string;
}

export function InvitePatientButton({ token }: InvitePatientButtonProps) {
  const t = useTranslations('dietitian.invite');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="h-4 w-4" />
        {t('button') ?? 'Zaproś pacjenta'}
      </Button>
      <InvitePatientDialog open={open} onOpenChange={setOpen} token={token} />
    </>
  );
}
