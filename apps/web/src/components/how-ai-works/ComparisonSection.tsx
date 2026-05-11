'use client';

import { useTranslations } from 'next-intl';

export function ComparisonSection() {
  const t = useTranslations('howAiWorks');

  const rows = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    label: t(`comp${n}Label` as Parameters<typeof t>[0]),
    trad: t(`comp${n}Trad` as Parameters<typeof t>[0]),
    us: t(`comp${n}Us` as Parameters<typeof t>[0]),
  }));

  return (
    <section className="py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('comparisonTitle')}
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            {t('comparisonSubtitle')}
          </p>
        </div>

        <div className="mx-auto max-w-4xl overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-semibold">{t('compCol1')}</th>
                <th className="px-4 py-3 text-left font-semibold">{t('compCol2')}</th>
                <th className="px-4 py-3 text-left font-semibold text-brand-green">
                  {t('compCol3')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, trad, us }, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-border ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                >
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trad}</td>
                  <td className="px-4 py-3 font-medium text-brand-green">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
