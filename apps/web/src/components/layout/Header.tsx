'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
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

// TODO(4-cleanup): diet routes (/dietetyk, /dashboard) removed in K4.
// DIETITIAN role removed in K7. Client panel rebuilt as /panel in K11.
function getDashboardHref(role?: string): string {
  if (role === 'ADMIN') return '/admin';
  return '/';
}

// TODO(4-cleanup): /o-nas, /oferta, /faq removed in K4 (diet pages).
// Rebuild as /o-nas (bambooIT) + /pakiety + /audyt in K11.
const navLinks = [
  // { href: '/o-nas',            label: 'about'   },
  // { href: '/oferta',           label: 'pricing' },
  // { href: '/faq',              label: 'faq'     },
  { href: '/blog',             label: 'blog'    },
  { href: '/dokumenty-prawne', label: 'legal'   },
] as const;

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
        'sticky top-0 z-40 w-full transition-all duration-300',
        scrolled
          ? 'bg-background/95 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-transparent'
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="hover:opacity-90 transition-opacity" aria-label={BRAND.shortName}>
          <Image
            src="/logo.png"
            alt={BRAND.shortName}
            width={200}
            height={200}
            className="h-10 w-auto md:h-12 rounded-md"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(label)}
            </Link>
          ))}
        </nav>

        {/* Desktop Right */}
        <div className="hidden items-center gap-3 md:flex">
          <LocaleSwitcher />
          {isLoggedIn ? (
            <>
              <Button asChild variant="green-outline" size="sm">
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
            <>
              <Button asChild variant="green-outline" size="sm">
                <Link href="/zaloguj">{t('login')}</Link>
              </Button>
              <Button asChild variant="orange" size="sm">
                <Link href="/zaloguj">{t('start')}</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <LocaleSwitcher />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('openMenu')}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-[280px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-foreground">
                  <Image src="/logo.png" alt={BRAND.shortName} width={28} height={28} className="rounded-md" />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-6 pt-2" aria-label="Mobile navigation">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {t('home')}
                </Link>
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t(label)}
                  </Link>
                ))}
                <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-border">
                  {isLoggedIn ? (
                    <>
                      <Button asChild variant="green-outline" size="default" className="w-full">
                        <Link href={panelHref} onClick={() => setOpen(false)}>
                          {t('dashboard')}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="default"
                        className="w-full gap-1.5"
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
                      <Button asChild variant="green-outline" size="default" className="w-full">
                        <Link href="/zaloguj" onClick={() => setOpen(false)}>
                          {t('login')}
                        </Link>
                      </Button>
                      <Button asChild variant="orange" size="default" className="w-full">
                        <Link href="/zaloguj" onClick={() => setOpen(false)}>
                          {t('start')}
                        </Link>
                      </Button>
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
