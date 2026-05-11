import { useTranslations } from 'next-intl';
import { Brain, UtensilsCrossed, BarChart3, HeartHandshake, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const icons = [Brain, UtensilsCrossed, BarChart3, HeartHandshake, ShieldCheck, Smartphone];

export function FeaturesSection() {
  const t = useTranslations('home.features');

  const items = Array.from({ length: 6 }, (_, i) => ({
    Icon:      icons[i],
    title:     t(`item${i + 1}Title` as Parameters<typeof t>[0]),
    desc:      t(`item${i + 1}Desc` as Parameters<typeof t>[0]),
    highlight: i === 0, // first card gets the gradient top strip
  }));

  return (
    <section className="bg-background py-24">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <div className="mb-12 text-center">
          <Badge variant="brand-green" className="mb-4">
            {t('badge')}
          </Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Feature grid — uniform white cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ Icon, title, desc, highlight }, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-white p-7 transition-all duration-200 hover:-translate-y-1 ${
                highlight ? 'shadow-md' : 'shadow-sm hover:shadow-md'
              }`}
            >
              {/* Gradient top strip for highlighted card */}
              {highlight && (
                <div
                  className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-brand-green to-brand-orange"
                  aria-hidden="true"
                />
              )}

              {/* Icon */}
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10">
                <Icon className="h-5 w-5 text-brand-green" />
              </div>

              {/* Content */}
              <div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
