'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const locales = ['pl', 'en'] as const;

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          disabled={locale === loc || isPending}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
            locale === loc
              ? 'bg-sage-500 text-white'
              : 'text-muted-foreground hover:text-foreground disabled:opacity-50'
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
