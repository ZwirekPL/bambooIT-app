import { useTranslations } from 'next-intl';
import { ClipboardList, Bot, UserCheck, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const stepIcons = [ClipboardList, Bot, UserCheck, TrendingUp];

export function HowItWorksSection() {
  const t = useTranslations('home.howItWorks');

  const steps = [1, 2, 3, 4].map((n, idx) => ({
    Icon:   stepIcons[idx],
    number: t(`step${n}Number` as Parameters<typeof t>[0]),
    title:  t(`step${n}Title` as Parameters<typeof t>[0]),
    desc:   t(`step${n}Desc` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="bg-gradient-to-br from-slate-50 to-brand-green/5 py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-14 text-center">
          <Badge variant="brand-green" className="mb-4">
            {t('badge')}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connector line (large desktop only) */}
          <div
            className="absolute left-0 right-0 top-11 hidden h-px bg-border lg:block"
            style={{ marginLeft: '12.5%', marginRight: '12.5%' }}
            aria-hidden="true"
          />

          {steps.map(({ Icon, number, title, desc }, idx) => (
            <div
              key={idx}
              className="relative flex flex-col items-center rounded-3xl border border-border bg-white p-8 text-center shadow-sm"
            >
              {/* Step icon + number */}
              <div className="relative mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-green/10 ring-2 ring-brand-green/20">
                  <Icon className="h-8 w-8 text-brand-green" />
                </div>
                {/* Step number badge */}
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-[10px] font-extrabold text-white shadow">
                  {number}
                </span>
              </div>

              <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
