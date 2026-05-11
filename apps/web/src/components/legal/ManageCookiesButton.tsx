'use client';

import { useTranslations } from 'next-intl';
import { Cookie } from 'lucide-react';
import { openCookieSettings } from './CookieBanner';

interface ManageCookiesButtonProps {
  className?: string;
}

export function ManageCookiesButton({ className }: ManageCookiesButtonProps) {
  const t = useTranslations('footer');

  return (
    <button
      onClick={openCookieSettings}
      className={`flex items-center gap-1.5 ${className ?? ''}`}
    >
      <Cookie className="h-3.5 w-3.5" />
      {t('manageCookies')}
    </button>
  );
}
