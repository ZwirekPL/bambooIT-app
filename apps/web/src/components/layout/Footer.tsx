import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@config/brand';
import { ManageCookiesButton } from '@/components/legal/ManageCookiesButton';

const serviceLinks = [
  { href: '/pakiety',            labelKey: 'linkItManaged' },
  { href: '/strony-internetowe', labelKey: 'linkWeb' },
  { href: '/aplikacje',          labelKey: 'linkApps' },
  { href: '/automatyzacje',      labelKey: 'linkAutomation' },
] as const;

const companyLinks = [
  { href: '/o-nas',        labelKey: 'aboutUs' },
  { href: '/branze',       labelKey: 'linkBranze' },
  { href: '/pomoc-zdalna', labelKey: 'linkRemoteSupport' },
  { href: '/blog',         labelKey: 'linkBlog' },
] as const;

const contactLinks = [
  { href: '/audyt',   labelKey: 'linkAudit' },
  { href: '/kontakt', labelKey: 'linkContact' },
  { href: '/zaloguj', labelKey: 'linkLogin' },
] as const;

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { href: string; labelKey: string }[];
}) {
  const t = useTranslations('footer');
  return (
    <div>
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">{heading}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map(({ href, labelKey }) => (
          <li key={href}>
            <Link href={href} className="text-sm text-white/60 transition-colors hover:text-bamboo">
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-deep text-white/60 border-t border-white/10">
      <div className="container mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" aria-label={BRAND.shortName}>
              <span className="font-display text-2xl font-black tracking-tight leading-none text-white">
                ba<span className="text-bamboo">m</span>boo<span className="text-bamboo">it</span>
              </span>
            </Link>
            <p className="mt-4 max-w-[30ch] text-sm leading-[1.6] text-white/50">{t('tagline')}</p>
            <p className="mt-4 font-mono text-xs text-white/40">NIP {BRAND.nip}</p>
          </div>

          <FooterColumn heading={t('colServices')} links={serviceLinks} />
          <FooterColumn heading={t('colCompany')} links={companyLinks} />
          <FooterColumn heading={t('colContact')} links={contactLinks} />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-xs md:flex-row md:items-center">
          <p className="text-white/50">
            © {year} {BRAND.name} Sp. z o.o. — {t('rights')}
          </p>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Legal navigation">
            <Link
              href="/dokumenty-prawne?tab=privacy"
              className="text-white/60 hover:text-bamboo transition-colors"
            >
              {t('privacy')}
            </Link>
            <span aria-hidden="true" className="text-white/20">·</span>
            <Link
              href="/dokumenty-prawne?tab=privacy"
              className="text-white/60 hover:text-bamboo transition-colors"
            >
              {t('rodo')}
            </Link>
            <span aria-hidden="true" className="text-white/20">·</span>
            <ManageCookiesButton className="text-white/60 hover:text-bamboo transition-colors" />
          </nav>
        </div>
      </div>
    </footer>
  );
}
