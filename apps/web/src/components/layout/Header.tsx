'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LocaleSwitcher } from './LocaleSwitcher';
import { BRAND } from '@config/brand';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { performFullLogout } from '@/lib/logout';

function getDashboardHref(role?: string): string {
  if (role === 'ADMIN') return '/admin';
  return '/';
}

// Anchor-based links scroll to homepage sections; route-based links go to dedicated pages.
// Routes /pakiety, /o-nas, /audyt land in W2.CC; until then they 404 but Header renders OK.
const navLinks = [
  { href: '/#offer',    labelKey: 'whatWeDo'  },
  { href: '/#services', labelKey: 'services'  },
  { href: '/pakiety',   labelKey: 'packages'  },
  { href: '/#process',  labelKey: 'howWeWork' },
  { href: '/o-nas',     labelKey: 'aboutUs'   },
  { href: '/audyt',     labelKey: 'audit'     },
  { href: '/#faq',      labelKey: 'faq'       },
] as const;

function BrandMark({ className }: { className?: string }) {
  // bambooIT wordmark with bamboo-green accents on `m` and `it`.
  return (
    <span
      className={cn('font-display font-black tracking-tight leading-none', className)}
      aria-label={BRAND.shortName}
    >
      ba<span className="text-bamboo">m</span>boo<span className="text-bamboo">it</span>
    </span>
  );
}

export function Header() {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const panelHref = getDashboardHref(session?.user?.role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full bg-paper/85 backdrop-blur-md text-navy-deep transition-all duration-300',
        scrolled && 'border-b border-line shadow-sm',
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-4 md:px-6 py-4">
        {/* Logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity" aria-label={BRAND.shortName}>
          <BrandMark className="text-2xl" />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Main navigation">
          {navLinks.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium py-1.5 transition-colors hover:text-bamboo-deep"
            >
              {t(labelKey)}
            </Link>
          ))}
        </nav>

        {/* Desktop right cluster — auth + locale + CTA */}
        <div className="hidden lg:flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={panelHref}>{t('dashboard')}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => performFullLogout('/')}
                className="gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                {t('logout')}
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/zaloguj">{t('login')}</Link>
            </Button>
          )}
          <LocaleSwitcher />
          <Link
            href="/audyt"
            className="inline-flex items-center gap-2 rounded-full bg-bamboo px-5 py-2.5 text-sm font-semibold text-navy-deep transition-all hover:bg-white hover:-translate-y-0.5"
          >
            {t('ctaAudit')}
          </Link>
        </div>

        {/* Mobile menu */}
        <div className="flex items-center gap-2 lg:hidden">
          <LocaleSwitcher />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('openMenu')}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="bg-navy-deep text-white border-l border-navy-soft w-full max-w-[320px]"
            >
              <SheetHeader>
                <SheetTitle className="text-white">
                  <BrandMark className="text-xl" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 pt-8" aria-label="Mobile navigation">
                {navLinks.map(({ href, labelKey }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 font-display text-lg font-normal transition-colors hover:text-bamboo"
                  >
                    {t(labelKey)}
                  </Link>
                ))}
                <div className="mt-6 flex flex-col gap-3 pt-6 border-t border-navy-soft">
                  {isLoggedIn ? (
                    <>
                      <Button
                        asChild
                        size="default"
                        className="w-full bg-bamboo text-navy-deep hover:bg-white"
                      >
                        <Link href={panelHref} onClick={() => setOpen(false)}>
                          {t('dashboard')}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="default"
                        className="w-full gap-1.5 justify-start text-white hover:text-bamboo hover:bg-transparent"
                        onClick={() => {
                          setOpen(false);
                          performFullLogout('/');
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        {t('logout')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        asChild
                        variant="ghost"
                        size="default"
                        className="w-full justify-start text-white hover:text-bamboo hover:bg-transparent"
                      >
                        <Link href="/zaloguj" onClick={() => setOpen(false)}>
                          {t('login')}
                        </Link>
                      </Button>
                      <Link
                        href="/audyt"
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-bamboo px-5 py-3 text-sm font-semibold text-navy-deep transition-all hover:bg-white"
                      >
                        {t('ctaAudit')}
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
