'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  Search,
  MoreHorizontal,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Plus,
  Copy,
  Check,
  Pencil,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff,
  ScrollText,
  UserX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { actionLabel, resourceLabel, getActionSeverity, formatActivityDate } from './audit-labels';
import type { AdminDietitian, DietitianPatient, AuditLog } from '@/types/api';

interface DietitiansTableProps {
  initialDietitians: AdminDietitian[];
  initialTotal: number;
  initialPage: number;
  limit: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Row({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all flex items-center gap-1">
        {value}
        {copyable && <CopyButton text={value} />}
      </span>
    </div>
  );
}

function formatName(d: AdminDietitian): string {
  const parts = [d.firstName, d.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '';
}

function DietitianDetailDialog({
  dietitian,
  open,
  onClose,
  t,
}: {
  dietitian: AdminDietitian | null;
  open: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  if (!dietitian) return null;

  const name = formatName(dietitian);

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detailTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {name && <Row label={t('fieldName')} value={name} />}
          <Row label={t('fieldEmail')} value={dietitian.email} />
          <Row label={t('fieldCode')} value={dietitian.code} copyable />
          <Row label={t('fieldPatients')} value={String(dietitian.patientsCount)} />
          <Row
            label={t('fieldStatus')}
            value={dietitian.deletedAt ? t('statusDeleted') : t('statusActive')}
          />
          <Row
            label={t('fieldCreated')}
            value={new Date(dietitian.createdAt).toLocaleDateString('pl-PL')}
          />
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

function EditDietitianDialog({
  dietitian,
  open,
  onClose,
  onSuccess,
  token,
  t,
}: {
  dietitian: AdminDietitian | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: AdminDietitian) => void;
  token: string;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (dietitian && open) {
      setEmail(dietitian.email);
      setFirstName(dietitian.firstName ?? '');
      setLastName(dietitian.lastName ?? '');
      setError('');
    }
  }, [dietitian, open]);

  if (!dietitian) return null;

  const handleSubmit = () => {
    setError('');
    startTransition(async () => {
      try {
        const result = await api.admin.updateDietitian(
          dietitian.userId,
          {
            email: email.trim() || undefined,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
          token
        );
        onSuccess(result.dietitian);
        onClose();
      } catch (err) {
        if (err instanceof ApiError && err.fields?.length) {
          const messages = err.fields.map(f => {
            if (f.field === 'email') return t('validationEmail');

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
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">{t('fieldEmail')}</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">{t('fieldFirstName')}</Label>
              <Input
                id="edit-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">{t('fieldLastName')}</Label>
              <Input
                id="edit-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientsDialog({
  dietitian,
  open,
  onClose,
  token,
  t,
}: {
  dietitian: AdminDietitian | null;
  open: boolean;
  onClose: () => void;
  token: string;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  const [patients, setPatients] = useState<DietitianPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (dietitian && open && token) {
      setLoading(true);
      setError('');
      api.admin
        .getDietitianPatients(dietitian.userId, token)
        .then((res) => setPatients(res.patients))
        .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
        .finally(() => setLoading(false));
    }
  }, [dietitian, open, token]);

  if (!dietitian) return null;

  const dietitianName = formatName(dietitian) || dietitian.email;

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('patientsTitle')}</DialogTitle>
          <DialogDescription>
            {t('patientsDescription', { name: dietitianName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive py-4">{error}</p>
          )}
          {!loading && !error && patients.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('patientsEmpty')}
            </p>
          )}
          {!loading && !error && patients.length > 0 && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {t('patientName')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {t('patientEmail')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      {t('patientGoal')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">
                      {t('patientLastLogin')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {patients.map((p) => {
                    const pName = [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          'transition-colors hover:bg-muted/30',
                          p.user.deletedAt && 'opacity-50'
                        )}
                      >
                        <td className="px-3 py-2 font-medium">{pName}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">
                          {p.user.email}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                          {'—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                          {p.user.lastLoginAt
                            ? new Date(p.user.lastLoginAt).toLocaleDateString('pl-PL')
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

function CreateDietitianDialog({
  open,
  onClose,
  onSuccess,
  token,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (dietitian: AdminDietitian) => void;
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

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!email.trim()) return;
    if (password && password !== confirmPassword) {
      setError(t('validationPasswordMismatch'));
      return;
    }
    setError('');

    startTransition(async () => {
      try {
        const result = await api.admin.createDietitian(
          {
            email: email.trim(),
            password: password || undefined,
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
          },
          token
        );

        const newDietitian: AdminDietitian = {
          userId: result.dietitianUserId,
          code: result.code,
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          role: 'DIETITIAN',
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          deletedAt: null,
          patientsCount: 0,
        };

        onSuccess(newDietitian);
        handleClose();
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
    <Dialog open={open} onOpenChange={(v: boolean) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="diet-email">{t('fieldEmail')} *</Label>
            <Input
              id="diet-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dietetyk@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diet-password">{t('fieldPassword')}</Label>
            <div className="relative">
              <Input
                id="diet-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diet-confirmPassword">{t('confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="diet-confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirmPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="diet-first">{t('fieldFirstName')}</Label>
              <Input
                id="diet-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diet-last">{t('fieldLastName')}</Label>
              <Input
                id="diet-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !email.trim()}>
            {isPending ? t('saving') : t('create')}
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

export function DietitiansTable({
  initialDietitians,
  initialTotal,
  initialPage,
  limit,
}: DietitiansTableProps) {
  const t = useTranslations('admin.dietitians');
  const { data: session } = useSession();
  const token = '';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dietitians, setDietitians] = useState<AdminDietitian[]>(initialDietitians);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') ?? 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') ?? 'desc');
  const [hideDeleted, setHideDeleted] = useState(searchParams.get('hideDeleted') === 'true');

  const [detailDietitian, setDetailDietitian] = useState<AdminDietitian | null>(null);
  const [editDietitian, setEditDietitian] = useState<AdminDietitian | null>(null);
  const [patientsDietitian, setPatientsDietitian] = useState<AdminDietitian | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<AdminDietitian | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<AdminDietitian | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminDietitian | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isRotatePending, startRotateTransition] = useTransition();
  const [isToggleActivePending, startToggleActiveTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pushParams = useCallback(
    (overrides?: Record<string, string | undefined>) => {
      const state: Record<string, string | undefined> = {
        search, sortBy, sortOrder, hideDeleted: hideDeleted ? 'true' : undefined,
        page: page > 1 ? String(page) : undefined,
        ...overrides,
      };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) {
        if (v) params.set(k, v);
      }
      if (params.get('sortBy') === 'createdAt') params.delete('sortBy');
      if (params.get('sortOrder') === 'desc') params.delete('sortOrder');
      if (params.get('page') === '1') params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, search, sortBy, sortOrder, hideDeleted, page]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search: value, page: '1' });
    }, 300);
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    pushParams({ sortBy: field, sortOrder: newOrder, page: '1' });
  };

  const handleHideDeletedToggle = () => {
    const next = !hideDeleted;
    setHideDeleted(next);
    pushParams({ hideDeleted: next ? 'true' : undefined, page: '1' });
  };

  const handleToggleActive = () => {
    if (!toggleActiveTarget) return;
    startToggleActiveTransition(async () => {
      try {
        const res = await api.admin.toggleDietitianActive(toggleActiveTarget.userId, token);
        setDietitians((prev) =>
          prev.map((d) =>
            d.userId === toggleActiveTarget.userId
              ? { ...d, deletedAt: res.active ? null : new Date().toISOString() }
              : d
          )
        );
        setToggleActiveTarget(null);
      } catch {
        setToggleActiveTarget(null);
      }
    });
  };

  const openHistory = async (d: AdminDietitian) => {
    setHistoryTarget(d);
    setHistoryLoading(true);
    try {
      const res = await api.admin.listAuditLogs({ search: d.email, limit: 50 }, token);
      setHistoryLogs(res.logs);
    } catch {
      setHistoryLogs([]);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setDietitians(initialDietitians);
    setTotal(initialTotal);
    setPage(initialPage);
  }, [initialDietitians, initialTotal, initialPage]);

  const handleCreated = (newDietitian: AdminDietitian) => {
    setDietitians((prev) => [newDietitian, ...prev]);
    setTotal((prev) => prev + 1);
  };

  const handleUpdated = (updated: AdminDietitian) => {
    setDietitians((prev) =>
      prev.map((d) => (d.userId === updated.userId ? updated : d))
    );
  };

  const handleRotateCode = () => {
    if (!rotateTarget) return;
    startRotateTransition(async () => {
      try {
        const result = await api.admin.rotateDietitianCode(rotateTarget.userId, token);
        setDietitians((prev) =>
          prev.map((d) =>
            d.userId === rotateTarget.userId ? { ...d, code: result.newCode } : d
          )
        );
        setRotateTarget(null);
      } catch {
        setRotateTarget(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {t('addDietitian')}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          size="sm"
          variant="outline"
          onClick={handleHideDeletedToggle}
          className={cn('text-xs gap-1.5', hideDeleted && 'bg-sage-100 border-sage-300 text-sage-800')}
        >
          <UserX className="h-3.5 w-3.5" />
          {t('filterHideDeleted')}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                <button onClick={() => handleSort('email')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  {t('colName')}
                  {sortBy === 'email' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                {t('colCode')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                <button onClick={() => handleSort('patientsCount')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  {t('colPatients')}
                  {sortBy === 'patientsCount' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                {t('colStatus')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                <button onClick={() => handleSort('lastLoginAt')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  {t('colLastLogin')}
                  {sortBy === 'lastLoginAt' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                <button onClick={() => handleSort('createdAt')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                  {t('colCreated')}
                  {sortBy === 'createdAt' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dietitians.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {dietitians.map((d) => {
              const name = formatName(d);
              return (
                <tr
                  key={d.userId}
                  className={cn(
                    'transition-colors hover:bg-muted/30',
                    d.deletedAt && 'opacity-50'
                  )}
                >
                  <td className="px-4 py-3 max-w-[250px]">
                    <div className="flex flex-col">
                      {name && (
                        <span className="font-medium truncate">{name}</span>
                      )}
                      <span className={cn(
                        'truncate',
                        name ? 'text-xs text-muted-foreground' : 'font-medium'
                      )}>
                        {d.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.code}</code>
                      <CopyButton text={d.code} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPatientsDietitian(d)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title={t('actionViewPatients')}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="underline decoration-dotted underline-offset-2">
                        {d.patientsCount}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {d.deletedAt ? (
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                        {t('statusDeleted')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {t('statusActive')}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {d.lastLoginAt ? (() => {
                      const days = Math.floor((Date.now() - new Date(d.lastLoginAt).getTime()) / 86400000);
                      if (days === 0) return t('today');
                      if (days < 30) return t('daysAgo', { count: days });
                      return <span className="text-red-500">{t('daysAgo', { count: days })}</span>;
                    })() : <span className="text-xs italic">{t('neverLoggedIn')}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(d.createdAt).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailDietitian(d)}>
                          <Eye className="mr-2 h-4 w-4" />
                          {t('actionView')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditDietitian(d)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('actionEdit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPatientsDietitian(d)}>
                          <Users className="mr-2 h-4 w-4" />
                          {t('actionViewPatients')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openHistory(d)}>
                          <ScrollText className="mr-2 h-4 w-4" />
                          {t('actionHistory')}
                        </DropdownMenuItem>
                        {!d.deletedAt && (
                          <DropdownMenuItem onClick={() => setRotateTarget(d)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t('actionRotateCode')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setToggleActiveTarget(d)}>
                          {d.deletedAt
                            ? <><Power className="mr-2 h-4 w-4" />{t('actionActivate')}</>
                            : <><PowerOff className="mr-2 h-4 w-4 text-destructive" /><span className="text-destructive">{t('actionDeactivate')}</span></>
                          }
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t('paginationInfo', {
            from: Math.min((page - 1) * limit + 1, total),
            to: Math.min(page * limit, total),
            total,
          })}
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

      {/* Dialogs */}
      <DietitianDetailDialog
        dietitian={detailDietitian}
        open={!!detailDietitian}
        onClose={() => setDetailDietitian(null)}
        t={t}
      />
      <EditDietitianDialog
        dietitian={editDietitian}
        open={!!editDietitian}
        onClose={() => setEditDietitian(null)}
        onSuccess={handleUpdated}
        token={token}
        t={t}
      />
      <PatientsDialog
        dietitian={patientsDietitian}
        open={!!patientsDietitian}
        onClose={() => setPatientsDietitian(null)}
        token={token}
        t={t}
      />
      <CreateDietitianDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={handleCreated}
        token={token}
        t={t}
      />
      <ConfirmDialog
        open={!!rotateTarget}
        title={t('rotateCodeTitle')}
        description={t('rotateCodeDescription', { email: rotateTarget?.email ?? '' })}
        confirmLabel={t('actionRotateCode')}
        onClose={() => setRotateTarget(null)}
        onConfirm={handleRotateCode}
        isPending={isRotatePending}
        t={t}
      />
      <ConfirmDialog
        open={!!toggleActiveTarget}
        title={toggleActiveTarget?.deletedAt ? t('activateTitle') : t('deactivateTitle')}
        description={toggleActiveTarget?.deletedAt
          ? t('activateDescription', { email: toggleActiveTarget?.email ?? '' })
          : t('deactivateDescription', { email: toggleActiveTarget?.email ?? '', count: toggleActiveTarget?.patientsCount ?? 0 })}
        confirmLabel={toggleActiveTarget?.deletedAt ? t('actionActivate') : t('actionDeactivate')}
        confirmVariant={toggleActiveTarget?.deletedAt ? undefined : 'destructive'}
        onClose={() => setToggleActiveTarget(null)}
        onConfirm={handleToggleActive}
        isPending={isToggleActivePending}
        t={t}
      />

      {/* Total count (52.5) */}
      <div className="text-xs text-muted-foreground text-center py-1">
        {t('totalCount', { count: total })}
      </div>

      {/* History drawer (52.4) */}
      <Sheet open={!!historyTarget} onOpenChange={(v) => !v && setHistoryTarget(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('historyTitle')}</SheetTitle>
            {historyTarget && <p className="text-sm text-muted-foreground break-all">{historyTarget.email}</p>}
          </SheetHeader>
          <div className="mt-4 px-1 space-y-1">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('loading')}</p>
            ) : historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('historyEmpty')}</p>
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
                          <span className="text-xs text-muted-foreground">
                            {resourceLabel(log.resourceType)}
                            {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}…` : ''}
                          </span>
                        )}
                        {log.ip && (
                          <span className="text-xs text-muted-foreground/60">IP: {log.ip}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-1 tabular-nums">
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
