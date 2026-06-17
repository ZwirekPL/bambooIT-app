'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Menu, LogOut, ChevronDown, UserRound, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LocaleSwitcher } from './LocaleSwitcher';
import { BrandMark } from '@/components/brand/BrandMark';
import { BRAND } from '@config/brand';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { performFullLogout } from '@/lib/logout';

function getDashboardHref(role?: string): string {
  if (role === 'ADMIN') return '/admin';
  return '/panel';
}

// Build 1-2 letter initials for the account avatar. Prefers the two words of a
// display name ("Jan Kowalski" → "JK"); falls back to the first two characters
// of a single token / email local-part.
function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// Anchor-based links scroll to homepage sections; route-based links go to
// dedicated pages. The "Usługi" entry is a dropdown grouping the four service
// pillars (PRD §4): Obsługa IT abonament + the three cross-sell offers.
type NavItem =
  | { type: 'link'; href: string; labelKey: string }
  | { type: 'menu'; labelKey: string; items: { href: string; labelKey: string }[] };

const navItems: NavItem[] = [
  { type: 'link', href: '/#offer', labelKey: 'whatWeDo' },
  {
    type: 'menu',
    labelKey: 'servicesMenu',
    items: [
      { href: '/#services',          labelKey: 'serviceItManaged' },
      { href: '/strony-internetowe', labelKey: 'serviceWeb' },
      { href: '/aplikacje',          labelKey: 'serviceApps' },
      { href: '/automatyzacje',      labelKey: 'serviceAutomation' },
    ],
  },
  { type: 'link', href: '/pakiety',  labelKey: 'packages' },
  { type: 'link', href: '/#process', labelKey: 'howWeWork' },
  { type: 'link', href: '/o-nas',    labelKey: 'aboutUs' },
  { type: 'link', href: '/audyt',    labelKey: 'audit' },
  { type: 'link', href: '/#faq',     labelKey: 'faq' },
];

export function Header() {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const role = session?.user?.role;
  const panelHref = getDashboardHref(role);
  const isClient = role === 'CLIENT';
  const displayName = session?.user?.name || session?.user?.email || '';
  const email = session?.user?.email ?? '';
  const initials = getInitials(session?.user?.name, email);
  const roleLabel = role === 'ADMIN' ? t('roleAdmin') : t('roleClient');

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
        {/* Logo — full bambooIT lockup (panda + wordmark + tagline) */}
        <Link href="/" className="hover:opacity-80 transition-opacity" aria-label={BRAND.shortName}>
          <Image
            src="/logo.png"
            alt={BRAND.shortName}
            width={1400}
            height={408}
            priority
            className="h-10 w-auto md:h-12"
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Main navigation">
          {navItems.map((item) =>
            item.type === 'menu' ? (
              <DropdownMenu key={item.labelKey} modal={false}>
                <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium py-1.5 outline-none transition-colors hover:text-bamboo-deep data-[state=open]:text-bamboo-deep">
                  {t(item.labelKey)}
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  {item.items.map((sub) => (
                    <DropdownMenuItem key={sub.href} asChild>
                      <Link href={sub.href} className="cursor-pointer">
                        {t(sub.labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium py-1.5 transition-colors hover:text-bamboo-deep"
              >
                {t(item.labelKey)}
              </Link>
            ),
          )}
        </nav>

        {/* Desktop right cluster — auth + locale + CTA */}
        <div className="hidden lg:flex items-center gap-3">
          {isLoggedIn ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className="group inline-flex items-center gap-2 rounded-full border border-navy-deep/15 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-navy-deep outline-none transition-all hover:border-bamboo-deep hover:bg-bamboo/10 data-[state=open]:border-bamboo-deep data-[state=open]:bg-bamboo/10"
                aria-label={t('account')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bamboo text-xs font-bold text-navy-deep">
                  {initials}
                </span>
                <span className="max-w-[10rem] truncate">{displayName}</span>
                <ChevronDown
                  className="h-3.5 w-3.5 text-navy-soft transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-semibold text-navy-deep">{displayName}</p>
                  <p className="truncate text-xs text-navy-soft">
                    {email} · {roleLabel}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={panelHref} className="cursor-pointer gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    {t('dashboard')}
                  </Link>
                </DropdownMenuItem>
                {isClient && (
                  <DropdownMenuItem asChild>
                    <Link href="/panel/profil" className="cursor-pointer gap-2">
                      <UserRound className="h-4 w-4" />
                      {t('profile')}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => performFullLogout('/')}
                  className="cursor-pointer gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/zaloguj"
              className="group inline-flex items-center gap-1.5 rounded-full border border-navy-deep/15 px-4 py-2.5 text-sm font-semibold text-navy-deep transition-all hover:-translate-y-0.5 hover:border-bamboo-deep hover:bg-bamboo/10 hover:text-bamboo-deep"
            >
              <UserRound className="h-4 w-4 text-navy-soft transition-colors group-hover:text-bamboo-deep" />
              {t('login')}
            </Link>
          )}
          <LocaleSwitcher />
          {!isLoggedIn && (
            <Link
              href="/audyt"
              className="inline-flex items-center gap-2 rounded-full bg-bamboo px-5 py-2.5 text-sm font-semibold text-navy-deep transition-all hover:bg-white hover:-translate-y-0.5"
            >
              {t('ctaAudit')}
            </Link>
          )}
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
                {navItems.map((item) =>
                  item.type === 'menu' ? (
                    <div key={item.labelKey} className="py-1">
                      <span className="block px-3 pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-bamboo">
                        {t(item.labelKey)}
                      </span>
                      {item.items.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
                          className="rounded-lg px-3 py-2.5 block font-display text-base font-normal transition-colors hover:text-bamboo"
                        >
                          {t(sub.labelKey)}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 font-display text-lg font-normal transition-colors hover:text-bamboo"
                    >
                      {t(item.labelKey)}
                    </Link>
                  ),
                )}
                <div className="mt-6 flex flex-col gap-3 pt-6 border-t border-navy-soft">
                  {isLoggedIn ? (
                    <>
                      <div className="flex items-center gap-3 px-1 pb-1">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bamboo text-sm font-bold text-navy-deep">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                          <p className="truncate text-xs text-white/60">
                            {email} · {roleLabel}
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        size="default"
                        className="w-full bg-bamboo text-navy-deep hover:bg-white"
                      >
                        <Link href={panelHref} onClick={() => setOpen(false)}>
                          {t('dashboard')}
                        </Link>
                      </Button>
                      {isClient && (
                        <Button
                          asChild
                          variant="ghost"
                          size="default"
                          className="w-full justify-start gap-1.5 text-white hover:bg-transparent hover:text-bamboo"
                        >
                          <Link href="/panel/profil" onClick={() => setOpen(false)}>
                            <UserRound className="h-4 w-4" />
                            {t('profile')}
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="default"
                        className="w-full justify-start gap-1.5 text-red-300 hover:bg-transparent hover:text-red-200"
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
