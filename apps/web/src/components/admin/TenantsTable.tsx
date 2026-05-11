'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { AdminTenant } from '@/types/api';

interface TenantsTableProps {
  initialTenants: AdminTenant[];
  initialTotal: number;
  initialPage: number;
  limit: number;
}

function TenantDetailDialog({
  tenant,
  open,
  onClose,
  t,
}: {
  tenant: AdminTenant | null;
  open: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('detailTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row label={t('fieldName')} value={tenant.name} />
          <Row label={t('fieldSlug')} value={tenant.slug} />
          <Row label={t('fieldOwner')} value={tenant.owner?.email ?? '—'} />
          <Row label={t('fieldPatients')} value={String(tenant._count.patients)} />
          <Row
            label={t('fieldStatus')}
            value={tenant.deletedAt ? t('statusDeleted') : t('statusActive')}
          />
          <Row
            label={t('fieldCreated')}
            value={new Date(tenant.createdAt).toLocaleDateString('pl-PL')}
          />
          {tenant.deletedAt && (
            <Row
              label={t('fieldDeleted')}
              value={new Date(tenant.deletedAt).toLocaleDateString('pl-PL')}
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
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

function EditTenantDialog({
  tenant,
  open,
  onClose,
  onSuccess,
  token,
  t,
}: {
  tenant: AdminTenant | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (updated: AdminTenant) => void;
  token: string;
  t: ReturnType<typeof useTranslations<string>>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setSlug(tenant.slug);
    }
  }, [tenant]);

  if (!tenant) return null;

  const hasChanges = name !== tenant.name || slug !== tenant.slug;

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await api.admin.updateTenant(
          tenant.id,
          { name: name !== tenant.name ? name : undefined, slug: slug !== tenant.slug ? slug : undefined },
          token
        );
        onSuccess(res.tenant);
        onClose();
      } catch {
        // silent
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-name">{t('fieldName')}</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tenant-slug">{t('fieldSlug')}</Label>
            <Input
              id="tenant-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isPending || !hasChanges || !name.trim()}>
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

export function TenantsTable({
  initialTenants,
  initialTotal,
  initialPage,
  limit,
}: TenantsTableProps) {
  const t = useTranslations('admin.tenants');
  const { data: session } = useSession();
  const token = '';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tenants, setTenants] = useState<AdminTenant[]>(initialTenants);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const [detailTenant, setDetailTenant] = useState<AdminTenant | null>(null);
  const [editTenant, setEditTenant] = useState<AdminTenant | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<AdminTenant | null>(null);
  const [restoreTenant, setRestoreTenant] = useState<AdminTenant | null>(null);

  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isRestorePending, startRestoreTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pushParams = useCallback(
    (nextSearch: string, nextPage: number) => {
      const params = new URLSearchParams();
      if (nextSearch) params.set('search', nextSearch);
      if (nextPage > 1) params.set('page', String(nextPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams(value, 1);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setTenants(initialTenants);
    setTotal(initialTotal);
    setPage(initialPage);
  }, [initialTenants, initialTotal, initialPage]);

  const handleUpdated = (updated: AdminTenant) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDelete = () => {
    if (!deleteTenant) return;
    startDeleteTransition(async () => {
      try {
        await api.admin.deleteTenant(deleteTenant.id, token);
        setTenants((prev) =>
          prev.map((t) =>
            t.id === deleteTenant.id ? { ...t, deletedAt: new Date().toISOString() } : t
          )
        );
        setDeleteTenant(null);
      } catch {
        setDeleteTenant(null);
      }
    });
  };

  const handleRestore = () => {
    if (!restoreTenant) return;
    startRestoreTransition(async () => {
      try {
        await api.admin.restoreTenant(restoreTenant.id, token);
        setTenants((prev) =>
          prev.map((t) => (t.id === restoreTenant.id ? { ...t, deletedAt: null } : t))
        );
        setRestoreTenant(null);
      } catch {
        setRestoreTenant(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t('colName')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                {t('colSlug')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                {t('colOwner')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t('colPatients')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                {t('colStatus')}
              </th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {tenants.map((tenant) => (
              <tr
                key={tenant.id}
                className={cn(
                  'transition-colors hover:bg-muted/30',
                  tenant.deletedAt && 'opacity-50'
                )}
              >
                <td className="px-4 py-3 font-medium max-w-[180px] truncate">
                  {tenant.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.slug}</code>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                  {tenant.owner?.email ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{tenant._count.patients}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {tenant.deletedAt ? (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                      {t('statusDeleted')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {t('statusActive')}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetailTenant(tenant)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('actionView')}
                      </DropdownMenuItem>
                      {!tenant.deletedAt && (
                        <DropdownMenuItem onClick={() => setEditTenant(tenant)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t('actionEdit')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {tenant.deletedAt ? (
                        <DropdownMenuItem onClick={() => setRestoreTenant(tenant)}>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          {t('actionRestore')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setDeleteTenant(tenant)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('actionDelete')}
                        </DropdownMenuItem>
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
            onClick={() => pushParams(search, page - 1)}
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
            onClick={() => pushParams(search, page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <TenantDetailDialog
        tenant={detailTenant}
        open={!!detailTenant}
        onClose={() => setDetailTenant(null)}
        t={t}
      />
      <EditTenantDialog
        tenant={editTenant}
        open={!!editTenant}
        onClose={() => setEditTenant(null)}
        onSuccess={handleUpdated}
        token={token}
        t={t}
      />
      <ConfirmDialog
        open={!!deleteTenant}
        title={t('deleteTitle')}
        description={t('deleteDescription', { name: deleteTenant?.name ?? '' })}
        confirmLabel={t('actionDelete')}
        confirmVariant="destructive"
        onClose={() => setDeleteTenant(null)}
        onConfirm={handleDelete}
        isPending={isDeletePending}
        t={t}
      />
      <ConfirmDialog
        open={!!restoreTenant}
        title={t('restoreTitle')}
        description={t('restoreDescription', { name: restoreTenant?.name ?? '' })}
        confirmLabel={t('actionRestore')}
        onClose={() => setRestoreTenant(null)}
        onConfirm={handleRestore}
        isPending={isRestorePending}
        t={t}
      />
    </div>
  );
}
