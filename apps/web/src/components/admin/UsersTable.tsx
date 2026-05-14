'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  Search,
  MoreHorizontal,
  ShieldCheck,
  UserX,
  UserCheck,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  MailCheck,
  Send,
  Clock,
  KeyRound,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  ScrollText,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import type { AdminUser, UserRole, AuditLog } from '@/types/api';
import { actionLabel, resourceLabel, getActionSeverity, formatActivityDate } from './audit-labels';

const ROLE_FILTERS: Array<{ key: string; value: UserRole | '' }> = [
  { key: 'filterAll', value: '' },
  { key: 'filterAdmin', value: 'ADMIN' },
  { key: 'filterClient', value: 'CLIENT' },
];

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700 border-red-200',
  CLIENT: 'bg-blue-100 text-blue-700 border-blue-200',
};

interface UsersTableProps {
  initialUsers: AdminUser[];
  initialTotal: number;
  initialPage: number;
  limit: number;
  currentUserId: string;
}

function UserDetailDialog({
  user,
  open,
  onClose,
  t,
}: {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  if (!user) return null;

  const name =
    [user.company?.contactFirstName, user.company?.contactLastName].filter(Boolean).join(' ') || '—';

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detailTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row label={t('fieldEmail')} value={user.email} />
          <Row label={t('fieldRole')} value={user.role} />
          <Row label={t('fieldName')} value={name} />
          <Row
            label={t('fieldVerified')}
            value={user.emailVerified ? t('yes') : t('no')}
          />
          <Row
            label={t('colLastLogin')}
            value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('pl-PL') : t('neverLoggedIn')}
          />
          <Row
            label={t('fieldCreated')}
            value={new Date(user.createdAt).toLocaleDateString('pl-PL')}
          />
          {user.deletedAt && (
            <Row
              label={t('fieldDeleted')}
              value={new Date(user.deletedAt).toLocaleDateString('pl-PL')}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-navy-soft shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

function ChangeRoleDialog({
  user,
  open,
  onClose,
  onSuccess,
  token,
  t,
}: {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: AdminUser) => void;
  token: string;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  const [role, setRole] = useState<UserRole>('CLIENT');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  if (!user) return null;

  const handleSave = () => {
    startTransition(async () => {
      try {
        await api.admin.changeRole(user.id, role, token);
        onSuccess({ ...user, role });
        onClose();
      } catch {
        // silent — user stays
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('changeRoleTitle')}</DialogTitle>
          <DialogDescription className="break-all">{user.email}</DialogDescription>
        </DialogHeader>
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
            <SelectItem value="CLIENT">{t('roleClient')}</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isPending || role === user.role}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant,
  onClose,
  onConfirm,
  isPending,
  t,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'destructive' | 'default';
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button variant={confirmVariant ?? 'default'} onClick={onConfirm} disabled={isPending}>
            {isPending ? t('saving') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onSuccess,
  token,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFirstName('');
    setLastName('');
    setError('');
  };

  const handleSubmit = () => {
    if (!email) return;
    if (password && password !== confirmPassword) {
      setError(t('validationPasswordMismatch'));
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await api.admin.createUser(
          {
            email,
            password: password || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          },
          token
        );
        resetForm();
        onSuccess();
        onClose();
      } catch (err) {
        if (err instanceof ApiError && err.fields?.length) {
          const messages = err.fields.map(f => {
            if (f.field === 'email') return t('validationEmail');
            if (f.field === 'password' && f.minimum) return t('validationPasswordMin', { min: f.minimum });
            return t('validationFieldRequired', { field: f.field });
          });
          setError(messages.join('. '));
        } else if (err instanceof Error) {
          setError(err.message);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-email">{t('fieldEmail')} *</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-firstName">{t('createFirstName')}</Label>
              <Input
                id="create-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-lastName">{t('createLastName')}</Label>
              <Input
                id="create-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password">{t('createPassword')}</Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('createPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-soft hover:text-navy-deep"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-confirmPassword">{t('createConfirmPassword')}</Label>
            <div className="relative">
              <Input
                id="create-confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('createConfirmPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-soft hover:text-navy-deep"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !email}>
            {isPending ? t('saving') : t('createSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GrantAccessDialog({
  user,
  open,
  onClose,
  onSuccess,
  token,
}: {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: AdminUser) => void;
  token: string;
}) {
  const t = useTranslations('admin.grantAccess');
  const [mode, setMode] = useState<'indefinite' | 'until'>('indefinite');
  const [date, setDate] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.grantedAccessUntil) {
      const d = new Date(user.grantedAccessUntil);
      if (d.getFullYear() > 2099) {
        setMode('indefinite');
        setDate('');
      } else {
        setMode('until');
        setDate(d.toISOString().split('T')[0]);
      }
    } else {
      setMode('indefinite');
      setDate('');
    }
  }, [user]);

  if (!user) return null;

  const hasAccess = user.grantedAccessUntil && new Date(user.grantedAccessUntil) > new Date();

  const handleGrant = () => {
    setError('');
    const value = mode === 'indefinite'
      ? new Date('2099-12-31T23:59:59Z').toISOString()
      : date ? new Date(date + 'T23:59:59Z').toISOString() : null;

    if (!value) {
      setError('Wybierz datę');
      return;
    }

    startTransition(async () => {
      try {
        const res = await api.admin.grantAccess(user.id, value, token);
        onSuccess({ ...user, grantedAccessUntil: res.user.grantedAccessUntil });
        onClose();
      } catch {
        setError(t('error'));
      }
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      try {
        await api.admin.grantAccess(user.id, null, token);
        onSuccess({ ...user, grantedAccessUntil: null });
        onClose();
      } catch {
        setError(t('error'));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="break-all">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {hasAccess && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {new Date(user.grantedAccessUntil!).getFullYear() > 2099
                ? t('grantedIndefinite')
                : t('granted', { date: new Date(user.grantedAccessUntil!).toLocaleDateString('pl-PL') })}
            </Badge>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'indefinite' ? 'default' : 'outline'}
              onClick={() => setMode('indefinite')}
              className="text-xs"
            >
              {t('indefinite')}
            </Button>
            <Button
              size="sm"
              variant={mode === 'until' ? 'default' : 'outline'}
              onClick={() => setMode('until')}
              className="text-xs"
            >
              {t('until')}
            </Button>
          </div>

          {mode === 'until' && (
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          {hasAccess && (
            <Button variant="destructive" size="sm" onClick={handleRevoke} disabled={isPending}>
              {t('revoke')}
            </Button>
          )}
          <Button onClick={handleGrant} disabled={isPending}>
            {isPending ? '...' : t('title')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersTable({
  initialUsers,
  initialTotal,
  initialPage,
  limit,
  currentUserId,
}: UsersTableProps) {
  const t = useTranslations('admin.users');
  const { data: session } = useSession();
  const token = '';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>(
    (searchParams.get('role') as UserRole) ?? ''
  );
  const [hideDeleted, setHideDeleted] = useState(searchParams.get('hideDeleted') === 'true');
  const [inactiveMonths, setInactiveMonths] = useState(searchParams.get('inactiveMonths') ?? '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') ?? 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') ?? 'desc');
  const [createdFrom, setCreatedFrom] = useState(searchParams.get('createdFrom') ?? '');
  const [createdTo, setCreatedTo] = useState(searchParams.get('createdTo') ?? '');
  const [subStatusFilter, setSubStatusFilter] = useState(searchParams.get('subscriptionStatus') ?? '');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [restoreUser, setRestoreUser] = useState<AdminUser | null>(null);
  const [verifyEmailUser, setVerifyEmailUser] = useState<AdminUser | null>(null);
  const [resendVerificationUser, setResendVerificationUser] = useState<AdminUser | null>(null);
  const [grantAccessUser, setGrantAccessUser] = useState<AdminUser | null>(null);
  const [historyUser, setHistoryUser] = useState<AdminUser | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isRestorePending, startRestoreTransition] = useTransition();
  const [isVerifyPending, startVerifyTransition] = useTransition();
  const [isResendPending, startResendTransition] = useTransition();
  const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
  const [isResetPasswordPending, startResetPasswordTransition] = useTransition();
  const [revokeSessionsUser, setRevokeSessionsUser] = useState<AdminUser | null>(null);
  const [isRevokePending, startRevokeTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pushParams = useCallback(
    (overrides?: Record<string, string | undefined>) => {
      const state: Record<string, string | undefined> = {
        search, role: roleFilter, hideDeleted: hideDeleted ? 'true' : undefined,
        inactiveMonths: inactiveMonths || undefined, sortBy, sortOrder,
        createdFrom: createdFrom || undefined, createdTo: createdTo || undefined,
        subscriptionStatus: subStatusFilter || undefined,
        page: page > 1 ? String(page) : undefined,
        ...overrides,
      };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) {
        if (v && v !== 'false') params.set(k, v);
      }
      // Remove defaults
      if (params.get('sortBy') === 'createdAt') params.delete('sortBy');
      if (params.get('sortOrder') === 'desc') params.delete('sortOrder');
      if (params.get('page') === '1') params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, search, roleFilter, hideDeleted, inactiveMonths, sortBy, sortOrder, createdFrom, createdTo, subStatusFilter, page]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search: value, page: '1' });
    }, 300);
  };

  const handleRoleFilter = (value: UserRole | '') => {
    setRoleFilter(value);
    pushParams({ role: value || undefined, page: '1' });
  };

  const handleHideDeletedToggle = () => {
    const next = !hideDeleted;
    setHideDeleted(next);
    pushParams({ hideDeleted: next ? 'true' : undefined, page: '1' });
  };

  const handleInactiveFilter = (value: string) => {
    setInactiveMonths(value);
    pushParams({ inactiveMonths: value || undefined, page: '1' });
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    pushParams({ sortBy: field, sortOrder: newOrder, page: '1' });
  };

  const handleDateFilter = (from: string, to: string) => {
    setCreatedFrom(from);
    setCreatedTo(to);
    pushParams({ createdFrom: from || undefined, createdTo: to || undefined, page: '1' });
  };

  const openHistory = async (user: AdminUser) => {
    setHistoryUser(user);
    setHistoryLoading(true);
    try {
      const res = await api.admin.listAuditLogs({ search: user.email, limit: 50 }, token);
      setHistoryLogs(res.logs);
    } catch {
      setHistoryLogs([]);
    }
    setHistoryLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.filter((u) => u.id !== currentUserId).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.filter((u) => u.id !== currentUserId).map((u) => u.id)));
    }
  };

  const executeBulk = (action: string) => {
    if (selectedIds.size === 0) return;
    startBulkTransition(async () => {
      try {
        await api.admin.bulkUserAction(Array.from(selectedIds), action, token);
        setSelectedIds(new Set());
        router.refresh();
      } catch {
        // silent
      }
    });
  };

  const handleSubStatusFilter = (value: string) => {
    setSubStatusFilter(value);
    pushParams({ subscriptionStatus: value || undefined, page: '1' });
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Sync props changes (after router navigation re-renders server component)
  useEffect(() => {
    setUsers(initialUsers);
    setTotal(initialTotal);
    setPage(initialPage);
  }, [initialUsers, initialTotal, initialPage]);

  const handleRoleChanged = (updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleDelete = () => {
    if (!deleteUser) return;
    startDeleteTransition(async () => {
      try {
        await api.admin.deleteUser(deleteUser.id, token);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === deleteUser.id ? { ...u, deletedAt: new Date().toISOString() } : u
          )
        );
        setDeleteUser(null);
      } catch {
        setDeleteUser(null);
      }
    });
  };

  const handleRestore = () => {
    if (!restoreUser) return;
    startRestoreTransition(async () => {
      try {
        await api.admin.restoreUser(restoreUser.id, token);
        setUsers((prev) =>
          prev.map((u) => (u.id === restoreUser.id ? { ...u, deletedAt: null } : u))
        );
        setRestoreUser(null);
      } catch {
        setRestoreUser(null);
      }
    });
  };

  const handleVerifyEmail = () => {
    if (!verifyEmailUser) return;
    startVerifyTransition(async () => {
      try {
        await api.admin.verifyUserEmail(verifyEmailUser.id, token);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === verifyEmailUser.id
              ? { ...u, emailVerified: new Date().toISOString() }
              : u
          )
        );
        setVerifyEmailUser(null);
      } catch {
        setVerifyEmailUser(null);
      }
    });
  };

  const handleRevokeSessions = () => {
    if (!revokeSessionsUser) return;
    startRevokeTransition(async () => {
      try {
        await api.admin.revokeUserSessions(revokeSessionsUser.id, token);
        setRevokeSessionsUser(null);
      } catch {
        setRevokeSessionsUser(null);
      }
    });
  };

  const handleResetPassword = () => {
    if (!resetPasswordUser) return;
    startResetPasswordTransition(async () => {
      try {
        await api.admin.forcePasswordReset(resetPasswordUser.id, token);
        setResetPasswordUser(null);
      } catch {
        setResetPasswordUser(null);
      }
    });
  };

  const handleResendVerification = () => {
    if (!resendVerificationUser) return;
    startResendTransition(async () => {
      try {
        await api.admin.resendVerification(resendVerificationUser.id, token);
        setResendVerificationUser(null);
      } catch {
        setResendVerificationUser(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search + role filter + add button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-soft" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          className="gap-1.5"
        >
          <UserPlus className="h-4 w-4" />
          {t('createButton')}
        </Button>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map(({ key, value }) => (
            <Button
              key={key}
              size="sm"
              variant="outline"
              onClick={() => handleRoleFilter(value)}
              className={cn(
                'text-xs',
                roleFilter === value && 'bg-sage-100 border-sage-300 text-sage-800'
              )}
            >
              {t(key)}
            </Button>
          ))}
        </div>
      </div>

      {/* Additional filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          size="sm"
          variant="outline"
          onClick={handleHideDeletedToggle}
          className={cn(
            'text-xs gap-1.5',
            hideDeleted && 'bg-sage-100 border-sage-300 text-sage-800'
          )}
        >
          <UserX className="h-3.5 w-3.5" />
          {t('filterHideDeleted')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleInactiveFilter(inactiveMonths === '3' ? '' : '3')}
          className={cn(
            'text-xs gap-1.5',
            inactiveMonths === '3' && 'bg-amber-100 border-amber-300 text-amber-800'
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {t('filterInactive3Months')}
        </Button>

        <span className="text-xs text-navy-soft hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-navy-soft" />
          <Input
            type="date"
            value={createdFrom}
            onChange={(e) => handleDateFilter(e.target.value, createdTo)}
            className="h-8 w-[140px] text-xs px-2"
            placeholder={t('dateFrom')}
          />
          <span className="text-xs text-navy-soft">–</span>
          <Input
            type="date"
            value={createdTo}
            onChange={(e) => handleDateFilter(createdFrom, e.target.value)}
            className="h-8 w-[140px] text-xs px-2"
            placeholder={t('dateTo')}
          />
          {(createdFrom || createdTo) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDateFilter('', '')}
              className="text-xs h-8 px-2"
            >
              ✕
            </Button>
          )}
        </div>

        <span className="text-xs text-navy-soft hidden sm:inline">|</span>

        <Select value={subStatusFilter || '__all__'} onValueChange={(v) => handleSubStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder={t('filterSubscription')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('filterSubAll')}</SelectItem>
            <SelectItem value="TRIALING">{t('filterSubTrial')}</SelectItem>
            <SelectItem value="ACTIVE">{t('filterSubActive')}</SelectItem>
            <SelectItem value="PAST_DUE">{t('filterSubPastDue')}</SelectItem>
            <SelectItem value="CANCELED">{t('filterSubCancelled')}</SelectItem>
            <SelectItem value="NONE">{t('filterSubNone')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{t('bulkSelected', { count: selectedIds.size })}</span>
          <Button size="sm" variant="outline" onClick={() => executeBulk('deactivate')} disabled={isBulkPending} className="text-xs">
            {t('bulkDeactivate')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => executeBulk('restore')} disabled={isBulkPending} className="text-xs">
            {t('bulkRestore')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => executeBulk('forcePasswordReset')} disabled={isBulkPending} className="text-xs">
            {t('bulkResetPassword')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs ml-auto">
            {t('bulkClear')}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-2 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === users.filter((u) => u.id !== currentUserId).length}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft">
                <button onClick={() => handleSort('email')} className="inline-flex items-center gap-1 hover:text-navy-deep transition-colors">
                  {t('colEmail')}
                  {sortBy === 'email' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft">
                <button onClick={() => handleSort('role')} className="inline-flex items-center gap-1 hover:text-navy-deep transition-colors">
                  {t('colRole')}
                  {sortBy === 'role' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft hidden sm:table-cell">
                {t('colStatus')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft hidden md:table-cell">
                {t('colSubscription')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft hidden md:table-cell">
                <button onClick={() => handleSort('lastLoginAt')} className="inline-flex items-center gap-1 hover:text-navy-deep transition-colors">
                  {t('colLastLogin')}
                  {sortBy === 'lastLoginAt' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-navy-soft hidden lg:table-cell">
                <button onClick={() => handleSort('createdAt')} className="inline-flex items-center gap-1 hover:text-navy-deep transition-colors">
                  {t('colCreated')}
                  {sortBy === 'createdAt' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-soft">
                  {t('empty')}
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr
                key={user.id}
                className={cn(
                  'transition-colors hover:bg-muted/30',
                  user.deletedAt && 'opacity-50'
                )}
              >
                <td className="px-2 py-3 w-10">
                  {user.id !== currentUserId && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      className="rounded"
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                  {user.email}
                  {user.id === currentUserId && (
                    <span className="ml-2 text-xs text-navy-soft">({t('you')})</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', ROLE_BADGE_CLASS[user.role])}
                  >
                    {t(`role${user.role.charAt(0) + user.role.slice(1).toLowerCase()}` as Parameters<typeof t>[0])}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {user.deletedAt ? (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                      {t('statusDeleted')}
                    </Badge>
                  ) : user.emailVerified ? (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {t('statusActive')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      {t('statusUnverified')}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(() => {
                    const s = user.subscriptionStatus;
                    if (!s || s === 'NONE') return <span className="text-xs text-navy-soft">—</span>;
                    const badgeClasses: Record<string, string> = {
                      ACTIVE: 'bg-green-100 text-green-700 border-green-200',
                      TRIALING: 'bg-blue-100 text-blue-700 border-blue-200',
                      PAST_DUE: 'bg-amber-100 text-amber-700 border-amber-200',
                      CANCELED: 'bg-gray-100 text-gray-600 border-gray-200',
                      ONE_TIME: 'bg-violet-100 text-violet-700 border-violet-200',
                    };
                    const labels: Record<string, string> = {
                      ACTIVE: t('subActive'), TRIALING: t('subTrial'),
                      PAST_DUE: t('subPastDue'), CANCELED: t('subCancelled'),
                      ONE_TIME: t('subOneTime'), INCOMPLETE: t('subIncomplete'),
                    };
                    return (
                      <Badge variant="outline" className={cn('text-xs', badgeClasses[s] ?? 'bg-gray-50')}>
                        {labels[s] ?? s}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-navy-soft hidden md:table-cell">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString('pl-PL')
                    : <span className="text-xs italic">{t('neverLoggedIn')}</span>}
                </td>
                <td className="px-4 py-3 text-navy-soft hidden lg:table-cell">
                  {new Date(user.createdAt).toLocaleDateString('pl-PL')}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailUser(user)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('actionView')}
                      </DropdownMenuItem>
                      {user.id !== currentUserId && (
                        <>
                          <DropdownMenuItem onClick={() => setChangeRoleUser(user)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {t('actionChangeRole')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGrantAccessUser(user)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            {t('actionGrantAccess')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openHistory(user)}>
                            <ScrollText className="mr-2 h-4 w-4" />
                            {t('actionHistory')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetPasswordUser(user)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            {t('actionForcePasswordReset')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRevokeSessionsUser(user)}>
                            <UserX className="mr-2 h-4 w-4" />
                            {t('actionRevokeSessions')}
                          </DropdownMenuItem>
                          {!user.emailVerified && !user.deletedAt && (
                            <>
                              <DropdownMenuItem onClick={() => setVerifyEmailUser(user)}>
                                <MailCheck className="mr-2 h-4 w-4" />
                                {t('actionVerifyEmail')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResendVerificationUser(user)}>
                                <Send className="mr-2 h-4 w-4" />
                                {t('actionResendVerification')}
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          {user.deletedAt ? (
                            <DropdownMenuItem onClick={() => setRestoreUser(user)}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              {t('actionRestore')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setDeleteUser(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              {t('actionDelete')}
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-navy-soft">
        <span>
          {t('paginationInfo', { from: Math.min((page - 1) * limit + 1, total), to: Math.min(page * limit, total), total })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => pushParams({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => pushParams({ page: String(page + 1) })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Total count */}
      <div className="text-xs text-navy-soft text-center py-1">
        {t('totalCount', { count: total })}
      </div>

      {/* Dialogs */}
      <UserDetailDialog
        user={detailUser}
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        t={t}
      />
      <ChangeRoleDialog
        user={changeRoleUser}
        open={!!changeRoleUser}
        onClose={() => setChangeRoleUser(null)}
        onSuccess={handleRoleChanged}
        token={token}
        t={t}
      />
      <ConfirmDialog
        open={!!deleteUser}
        title={t('deleteTitle')}
        description={t('deleteDescription', { email: deleteUser?.email ?? '' })}
        confirmLabel={t('actionDelete')}
        confirmVariant="destructive"
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        isPending={isDeletePending}
        t={t}
      />
      <ConfirmDialog
        open={!!restoreUser}
        title={t('restoreTitle')}
        description={t('restoreDescription', { email: restoreUser?.email ?? '' })}
        confirmLabel={t('actionRestore')}
        onClose={() => setRestoreUser(null)}
        onConfirm={handleRestore}
        isPending={isRestorePending}
        t={t}
      />
      <ConfirmDialog
        open={!!verifyEmailUser}
        title={t('verifyEmailTitle')}
        description={t('verifyEmailDescription', { email: verifyEmailUser?.email ?? '' })}
        confirmLabel={t('actionVerifyEmail')}
        onClose={() => setVerifyEmailUser(null)}
        onConfirm={handleVerifyEmail}
        isPending={isVerifyPending}
        t={t}
      />
      <ConfirmDialog
        open={!!resendVerificationUser}
        title={t('resendVerificationTitle')}
        description={t('resendVerificationDescription', { email: resendVerificationUser?.email ?? '' })}
        confirmLabel={t('actionResendVerification')}
        onClose={() => setResendVerificationUser(null)}
        onConfirm={handleResendVerification}
        isPending={isResendPending}
        t={t}
      />
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => router.refresh()}
        token={token}
        t={t}
      />
      <GrantAccessDialog
        user={grantAccessUser}
        open={!!grantAccessUser}
        onClose={() => setGrantAccessUser(null)}
        onSuccess={(updated) => {
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        }}
        token={token}
      />

      <ConfirmDialog
        open={!!revokeSessionsUser}
        title={t('revokeSessionsTitle')}
        description={t('revokeSessionsDescription', { email: revokeSessionsUser?.email ?? '' })}
        confirmLabel={t('actionRevokeSessions')}
        confirmVariant="destructive"
        onClose={() => setRevokeSessionsUser(null)}
        onConfirm={handleRevokeSessions}
        isPending={isRevokePending}
        t={t}
      />
      <ConfirmDialog
        open={!!resetPasswordUser}
        title={t('resetPasswordTitle')}
        description={t('resetPasswordDescription', { email: resetPasswordUser?.email ?? '' })}
        confirmLabel={t('actionForcePasswordReset')}
        onClose={() => setResetPasswordUser(null)}
        onConfirm={handleResetPassword}
        isPending={isResetPasswordPending}
        t={t}
      />

      {/* History drawer (53.7) */}
      <Sheet open={!!historyUser} onOpenChange={(v) => !v && setHistoryUser(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('historyTitle')}</SheetTitle>
            {historyUser && (
              <p className="text-sm text-navy-soft break-all">{historyUser.email}</p>
            )}
          </SheetHeader>
          <div className="mt-4 px-1 space-y-1">
            {historyLoading ? (
              <p className="text-sm text-navy-soft py-8 text-center">{t('loading')}</p>
            ) : historyLogs.length === 0 ? (
              <p className="text-sm text-navy-soft py-8 text-center">{t('historyEmpty')}</p>
            ) : (
              historyLogs.map((log) => {
                const severity = getActionSeverity(log.action);
                const dotColor = severity === 'critical' ? 'bg-red-500' : severity === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground/40';
                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className={cn('h-2 w-2 mt-2 rounded-full shrink-0', dotColor)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{actionLabel(log.action)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {log.resourceType && (
                          <span className="text-xs text-navy-soft">
                            {resourceLabel(log.resourceType)}
                            {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ''}
                          </span>
                        )}
                        {log.ip && (
                          <span className="text-xs text-navy-soft/60">IP: {log.ip}</span>
                        )}
                      </div>
                      <p className="text-xs text-navy-soft/70 mt-1 tabular-nums">
                        {formatActivityDate(log.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
