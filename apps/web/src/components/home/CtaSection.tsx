import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartCtaLink } from '@/components/shared/SmartCtaLink';

export function CtaSection() {
  const t = useTranslations('home.cta');

  return (
    <section className="bg-gradient-to-br from-brand-green/5 via-background to-brand-orange/5 py-24">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <h2 className="mb-4 text-3xl font-extrabold text-foreground sm:text-4xl md:text-5xl text-balance">
          {t('title')}
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-muted-foreground text-base sm:text-lg">
          {t('subtitle')}
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <SmartCtaLink
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-8 py-3.5 text-base font-semibold text-white shadow hover:bg-brand-orange/90 transition-colors"
          >
            {t('button')}
            <ArrowRight className="h-5 w-5" />
          </SmartCtaLink>
          <Button asChild size="xl" variant="green-outline">
            <Link href="/oferta">{t('secondaryButton')}</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">{t('note')}</p>

        {/* Trust microcopy */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-green" />
            {t('trustRodo')}
          </span>
          <span className="flex items-center gap-1">
            <UserCheck className="h-3.5 w-3.5 text-brand-green" />
            {t('trustDietitian')}
          </span>
        </div>
      </div>
    </section>
  );
}
