'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { performFullLogout } from '@/lib/logout';

export function LogoutButton() {
  const t = useTranslations('nav');

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => performFullLogout('/')}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      {t('logout')}
    </Button>
  );
}
