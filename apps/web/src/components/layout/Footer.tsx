import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BRAND } from '@config/brand';
import { ManageCookiesButton } from '@/components/legal/ManageCookiesButton';

export function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-deep text-white/60 border-t border-white/10">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-4 text-xs md:flex-row md:items-center md:text-sm">
          <p className="text-white/50">
            © {year} {BRAND.name} Sp. z o.o. — {t('tagline')}
          </p>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Legal navigation">
            <span className="text-white/60">NIP {BRAND.nip}</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <Link href="/o-nas" className="text-white/60 hover:text-bamboo transition-colors">
              {t('aboutUs')}
            </Link>
            <span aria-hidden="true" className="text-white/20">·</span>
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
