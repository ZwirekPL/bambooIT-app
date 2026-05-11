import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Mail, Phone, Facebook, Instagram, Cookie } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BRAND } from '@config/brand';
import { ManageCookiesButton } from '@/components/legal/ManageCookiesButton';

export function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-sage-950 text-sage-100">
      <div className="container mx-auto px-4 py-16 md:px-6">
        <div className="grid grid-cols-1 gap-6 sm:gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex mb-4 hover:opacity-80 transition-opacity" aria-label={BRAND.shortName}>
              <Image
                src="/logo.png"
                alt={BRAND.shortName}
                width={160}
                height={160}
                className="h-12 w-auto rounded-md"
              />
            </Link>
            <p className="text-sm text-sage-400 leading-relaxed mb-6">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-3">
              <a
                href={BRAND.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-800 text-sage-300 hover:bg-sage-600 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href={BRAND.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-800 text-sage-300 hover:bg-sage-600 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-white mb-4">{t('footer.linksTitle')}</h3>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: t('nav.home') },
                { href: '/o-nas', label: t('nav.about') },
                { href: '/blog', label: t('nav.blog') },
                { href: '/oferta', label: t('nav.pricing') },
                { href: '/jak-to-dziala', label: t('nav.howAiWorks') },
                { href: '/faq', label: t('nav.faq') },
                { href: '/slownik', label: t('nav.glossary') },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-sage-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-white mb-4">{t('footer.legalTitle')}</h3>
            <ul className="space-y-2.5">
              {[
                { href: '/dokumenty-prawne?tab=privacy', label: t('footer.privacy') },
                { href: '/dokumenty-prawne?tab=terms', label: t('footer.terms') },
                { href: '/dokumenty-prawne?tab=cookies', label: t('footer.cookies') },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-sage-400 hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <ManageCookiesButton className="text-sm text-sage-400 hover:text-white transition-colors" />
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">{t('footer.contactTitle')}</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={`mailto:${BRAND.email}`}
                  className="flex items-center gap-2 text-sm text-sage-400 hover:text-white transition-colors"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {BRAND.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${BRAND.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-sm text-sage-400 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {BRAND.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-sage-800" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-sage-500 sm:flex-row">
          <p>
            &copy; {year} {BRAND.name}. {t('footer.rights')}
          </p>
          <p className="text-sage-600 text-xs">{BRAND.domain}</p>
        </div>
      </div>
    </footer>
  );
}
