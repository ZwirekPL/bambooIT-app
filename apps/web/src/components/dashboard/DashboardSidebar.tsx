'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { performFullLogout } from '@/lib/logout';
import {
  LayoutDashboard,
  User,
  ClipboardList,
  Leaf,
  ShoppingCart,
  History,
  CreditCard,
  ClipboardCheck,
  MessageSquareQuote,
  MessageCircle,
  Ruler,
  Pill,
  LogOut,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BRAND } from '@config/brand';
import { useUnreadCount } from '@/hooks/useUnreadCount';

const navItems = [
  { href: '/dashboard',          labelKey: 'nav.home',      icon: LayoutDashboard, tourId: 'patient-nav-home' },
  { href: '/dashboard/profil',   labelKey: 'nav.profile',   icon: User,            tourId: 'patient-nav-profile' },
  { href: '/dashboard/wywiad',   labelKey: 'nav.interview', icon: ClipboardList,   tourId: 'patient-nav-interview' },
  { href: '/dashboard/plan',     labelKey: 'nav.plan',      icon: Leaf,            tourId: 'patient-nav-plan' },
  { href: '/dashboard/zakupy',  labelKey: 'nav.shopping',  icon: ShoppingCart,    tourId: 'patient-nav-shopping' },
  { href: '/dashboard/postep',       labelKey: 'nav.progress',      icon: ClipboardCheck, tourId: 'patient-nav-progress' },
  { href: '/dashboard/historia',    labelKey: 'nav.history',       icon: History,    tourId: 'patient-nav-history' },
  { href: '/dashboard/pomiary',     labelKey: 'nav.measurements',   icon: Ruler,              tourId: 'patient-nav-measurements' },
  { href: '/dashboard/suplementy',  labelKey: 'nav.supplements',   icon: Pill,               tourId: 'patient-nav-supplements' },
  { href: '/dashboard/wiadomosci',  labelKey: 'nav.messages',      icon: MessageCircle,      tourId: 'patient-nav-messages' },
  { href: '/dashboard/opinia',      labelKey: 'nav.testimonial',   icon: MessageSquareQuote, tourId: 'patient-nav-testimonial' },
  { href: '/dashboard/subskrypcja', labelKey: 'nav.subscription',  icon: CreditCard, tourId: 'patient-nav-subscription' },
] as const;

interface DashboardSidebarProps {
  email: string;
}

function NavLink({
  href,
  labelKey,
  icon: Icon,
  tourId,
  onClick,
  badge,
}: {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  tourId?: string;
  onClick?: () => void;
  badge?: number;
}) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  // Active if exact match for home, prefix match for subpages
  const isActive =
    href === '/dashboard'
      ? pathname.endsWith('/dashboard')
      : pathname.includes(href.replace('/dashboard/', ''));

  return (
    <Link
      href={href}
      onClick={onClick}
      data-tour={tourId}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sage-100 text-sage-800'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{t(labelKey)}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-green text-[10px] font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function SidebarContent({ email, onLinkClick }: { email: string; onLinkClick?: () => void }) {
  const t = useTranslations('dashboard');
  const unreadCount = useUnreadCount();

  return (
    <div className="flex h-full flex-col">
      {/* Nav links */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ href, labelKey, icon, tourId }) => (
          <NavLink
            key={href}
            href={href}
            labelKey={labelKey}
            icon={icon}
            tourId={tourId}
            onClick={onLinkClick}
            badge={href === '/dashboard/wiadomosci' ? unreadCount : undefined}
          />
        ))}
      </nav>

      {/* Footer: email + logout */}
      <div className="border-t border-border px-3 py-4 space-y-2">
        <p className="truncate text-xs text-muted-foreground px-1">{email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => performFullLogout('/')}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </div>
  );
}

export function DashboardSidebar({ email }: DashboardSidebarProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('dashboard');

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-background">
        <SidebarContent email={email} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center border-b border-border bg-background px-2 py-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={t('nav.menu')}>
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-64 p-0 overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>{BRAND.shortName}</SheetTitle>
            </SheetHeader>
            <SidebarContent email={email} onLinkClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
