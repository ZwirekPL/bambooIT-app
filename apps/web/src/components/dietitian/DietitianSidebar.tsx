'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { performFullLogout } from '@/lib/logout';
import { LayoutDashboard, Users, UserCircle, LogOut, PanelLeft, Apple, ChefHat, FileText, BarChart3, ClipboardList, MessageCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BRAND } from '@config/brand';
import { useUnreadCount } from '@/hooks/useUnreadCount';

const navItems = [
  { href: '/dietetyk', labelKey: 'nav.home', icon: LayoutDashboard, tourId: 'nav-home' },
  { href: '/dietetyk/pacjenci', labelKey: 'nav.patients', icon: Users, tourId: 'nav-patients' },
  { href: '/dietetyk/produkty', labelKey: 'nav.products', icon: Apple, tourId: 'nav-products' },
  { href: '/dietetyk/przepisy', labelKey: 'nav.recipes', icon: ChefHat, tourId: 'nav-recipes' },
  { href: '/dietetyk/szablony', labelKey: 'nav.templates', icon: FileText, tourId: 'nav-templates' },
  { href: '/dietetyk/raport', labelKey: 'nav.report', icon: BarChart3, tourId: 'nav-report' },
  { href: '/dietetyk/profil', labelKey: 'nav.profile', icon: UserCircle, tourId: 'nav-profile' },
  { href: '/dietetyk/protokol',    labelKey: 'nav.protocol',     icon: ClipboardList, tourId: 'nav-protocol' },
  { href: '/dietetyk/analityka',  labelKey: 'nav.analytics',    icon: TrendingUp,    tourId: 'nav-analytics' },
  { href: '/dietetyk/wiadomosci', labelKey: 'nav.messages',     icon: MessageCircle, tourId: 'nav-messages' },
] as const;

interface DietitianSidebarProps {
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
  const t = useTranslations('dietitian');
  const pathname = usePathname();
  const isActive =
    href === '/dietetyk'
      ? pathname.endsWith('/dietetyk')
      : pathname.includes(href.replace('/dietetyk/', ''));

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
  const t = useTranslations('dietitian');
  const unreadCount = useUnreadCount();

  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map(({ href, labelKey, icon, tourId }) => (
          <NavLink
            key={href}
            href={href}
            labelKey={labelKey}
            icon={icon}
            tourId={tourId}
            onClick={onLinkClick}
            badge={href === '/dietetyk/wiadomosci' ? unreadCount : undefined}
          />
        ))}
      </nav>

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

export function DietitianSidebar({ email }: DietitianSidebarProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('dietitian');

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
