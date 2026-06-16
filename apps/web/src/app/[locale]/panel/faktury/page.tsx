import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@config/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clientPanel.invoices');
  return {
    title: `${t('metaTitle')} — ${BRAND.name}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Client invoices page — informational placeholder. Invoices are issued via
 * the (still undecided) invoicing provider and emailed after each payment, so
 * there is no in-panel list yet. When a provider is chosen (Fakturownia vs
 * wfirma — see project memory `project_invoicing_deferred`) this page swaps the
 * placeholder for a real invoice table fed by the CompanyInvoice cache.
 */
export default async function ClientInvoicesPage() {
  const t = await getTranslations('clientPanel.invoices');

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-bamboo-deep">
          {t('eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-[-0.02em] text-navy md:text-4xl">
          {t('title')}
        </h1>
      </header>

      <div className="rounded-3xl border border-line bg-white p-8 md:p-10">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-bamboo/15 text-bamboo-deep">
          <Mail className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-6 max-w-[28ch] font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em] text-navy">
          {t('cardHeading')}
        </h2>
        <p className="mt-4 max-w-[60ch] text-base leading-[1.7] text-navy-soft">{t('body1')}</p>
        <p className="mt-4 max-w-[60ch] text-base leading-[1.7] text-navy-soft">{t('body2')}</p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 rounded-full bg-navy-deep px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-bamboo hover:text-navy-deep"
          >
            {t('contactCta')}
          </Link>
          <Link
            href="/panel/subskrypcja"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-colors hover:border-bamboo-deep"
          >
            {t('subscriptionCta')}
          </Link>
        </div>

        <p className="mt-6 text-xs text-navy-soft">{t('note')}</p>
      </div>
    </div>
  );
}
