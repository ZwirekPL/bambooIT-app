'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Search, ChevronLeft, ChevronRight, Download, RotateCcw, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { AuditLog } from '@/types/api';

// ── Action labels (PL) ────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Logowanie',
  LOGOUT: 'Wylogowanie',
  VIEW_INTERVIEW: 'Podgląd wywiadu',
  CREATE_INTERVIEW: 'Utworzenie wywiadu',
  GENERATE_PLAN: 'Generowanie planu',
  VIEW_PLAN: 'Podgląd planu',
  APPROVE_PLAN: 'Zatwierdzenie planu',
  SEND_PLAN: 'Wysłanie planu',
  PUBLISH_PLAN: 'Publikacja planu',
  EDIT_PLAN: 'Edycja planu',
  EXPORT_PLAN: 'Eksport planu',
  CREATE_MANUAL_PLAN: 'Ręczne tworzenie planu',
  VIEW_PATIENT: 'Podgląd pacjenta',
  UPDATE_PATIENT: 'Aktualizacja pacjenta',
  DELETE_PATIENT: 'Usunięcie pacjenta',
  DELETE_USER: 'Usunięcie użytkownika',
  RESTORE_USER: 'Przywrócenie użytkownika',
  CHANGE_USER_ROLE: 'Zmiana roli',
  CREATE_USER: 'Utworzenie użytkownika',
  CREATE_DIETITIAN: 'Utworzenie dietetyka',
  UPDATE_DIETITIAN: 'Aktualizacja dietetyka',
  ROTATE_DIETITIAN_CODE: 'Rotacja kodu dietetyka',
  PASSWORD_RESET: 'Reset hasła',
  PASSWORD_CHANGE: 'Zmiana hasła',
  EMAIL_VERIFIED: 'Weryfikacja email',
  EMAIL_CHANGE: 'Zmiana email',
  ADMIN_VERIFY_EMAIL: 'Admin: weryfikacja email',
  ADMIN_RESEND_VERIFICATION: 'Admin: ponowna weryfikacja',
  ADMIN_FORCE_PASSWORD_RESET: 'Admin: reset hasła',
  BULK_USER_ACTION: 'Operacja masowa',
  REVOKE_USER_SESSIONS: 'Unieważnienie sesji',
  SUBSCRIPTION_CHECKOUT_STARTED: 'Rozpoczęcie płatności',
  SUBSCRIPTION_PORTAL_ACCESSED: 'Dostęp do portalu',
  STRIPE_CHECKOUT_COMPLETED: 'Płatność zakończona',
  STRIPE_INVOICE_PAID: 'Faktura opłacona',
  STRIPE_SUBSCRIPTION_DELETED: 'Subskrypcja usunięta',
  STRIPE_SUBSCRIPTION_UPDATED: 'Subskrypcja zaktualizowana',
  STRIPE_INVOICE_PAYMENT_FAILED: 'Płatność nieudana',
  STRIPE_REFUND: 'Zwrot Stripe',
  CHECKOUT_STARTED: 'Rozpoczęcie checkout',
  CHECKOUT_COMPLETED: 'Zakończenie checkout',
  CREATE_POST: 'Utworzenie wpisu',
  EDIT_POST: 'Edycja wpisu',
  DELETE_POST: 'Usunięcie wpisu',
  CREATE_RECIPE: 'Utworzenie przepisu',
  UPDATE_RECIPE: 'Aktualizacja przepisu',
  DELETE_RECIPE: 'Usunięcie przepisu',
  BULK_UPDATE_RECIPES: 'Masowa edycja przepisów',
  MERGE_RECIPES: 'Scalanie przepisów',
  CREATE_CLEAN_PRODUCT: 'Utworzenie produktu',
  UPDATE_CLEAN_PRODUCT: 'Aktualizacja produktu',
  DELETE_CLEAN_PRODUCT: 'Usunięcie produktu',
  BULK_UPDATE_CLEAN_PRODUCTS: 'Masowa edycja produktów',
  CREATE_PROTOCOL: 'Utworzenie protokołu',
  UPDATE_PROTOCOL: 'Aktualizacja protokołu',
  TOGGLE_PROTOCOL: 'Zmiana statusu protokołu',
  ASSIGN_PROTOCOL: 'Przypisanie protokołu',
  UNASSIGN_PROTOCOL: 'Odpisanie protokołu',
  PROTOCOL_AUTO_MATCHED: 'Auto-dopasowanie protokołu',
  PROTOCOL_CONFLICT_DETECTED: 'Wykryty konflikt protokołów',
  CREATE_PROTOCOL_TRIGGER: 'Utworzenie mapowania',
  UPDATE_PROTOCOL_TRIGGER: 'Aktualizacja mapowania',
  DELETE_PROTOCOL_TRIGGER: 'Usunięcie mapowania',
  CREATE_PROTOCOL_CONFLICT: 'Utworzenie konfliktu',
  UPDATE_PROTOCOL_CONFLICT: 'Aktualizacja konfliktu',
  DELETE_PROTOCOL_CONFLICT: 'Usunięcie konfliktu',
  AI_GENERATION_ENQUEUED: 'Generowanie AI zlecone',
  AI_REPAIR_ENQUEUED: 'Naprawa AI zlecona',
  AI_PARTIAL_REGEN_ENQUEUED: 'Częściowa regeneracja AI',
  REGENERATE_PARTIAL: 'Regeneracja częściowa',
  RED_FLAG_TRIGGERED: 'Red flag wyzwolony',
  GENERATION_BLOCKED: 'Generowanie zablokowane',
  CREATE_CHECKIN: 'Check-in',
  CHECKIN_ADAPTATION: 'Adaptacja z check-inu',
  CREATE_TESTIMONIAL: 'Dodanie opinii',
  DELETE_TESTIMONIAL: 'Usunięcie opinii',
  APPROVE_TESTIMONIAL: 'Zatwierdzenie opinii',
  REJECT_TESTIMONIAL: 'Odrzucenie opinii',
  REQUEST_MEAL_SWAP: 'Żądanie zamiany posiłku',
  CONFIRM_MEAL_SWAP: 'Potwierdzenie zamiany',
  CREATE_NOTE: 'Utworzenie notatki',
  REFERRAL_CODE_GENERATED: 'Wygenerowanie kodu polecającego',
  REFERRAL_USED: 'Użycie kodu polecającego',
  REFERRAL_DISCOUNT_APPLIED: 'Zastosowanie rabatu',
  UNLOCK_ACCOUNT: 'Odblokowanie konta',
  UNLOCK_PATIENT_PROFILE: 'Odblokowanie profilu pacjenta',
  DELETE_OWN_ACCOUNT: 'Usunięcie własnego konta',
  LOGIN_FAILED: 'Nieudane logowanie',
  ACCOUNT_LOCKED: 'Zablokowanie konta',
};

const RESOURCE_LABELS: Record<string, string> = {
  USER: 'Użytkownik',
  PATIENT: 'Klient',
  INTERVIEW: 'Wywiad',
  DIET_PLAN: 'Plan diety',
  TENANT: 'Tenant',
  SUBSCRIPTION: 'Subskrypcja',
  POST: 'Wpis blogowy',
  FOOD_PRODUCT: 'Produkt spożywczy',
  RECIPE: 'Przepis',
  CLEAN_PRODUCT: 'Produkt',
  ORDER: 'Zamówienie',
  CHECKIN: 'Check-in',
  TESTIMONIAL: 'Opinia',
  MEAL_SWAP: 'Zamiana posiłku',
  DIETITIAN_NOTE: 'Notatka',
  REFERRAL: 'Polecenie',
  NUTRITION_PROTOCOL: 'Protokół żywieniowy',
  PROTOCOL_TRIGGER: 'Mapowanie protokołu',
  PROTOCOL_CONFLICT: 'Konflikt protokołów',
  FEATURE_FLAG: 'Feature flag',
  DIET_TEMPLATE: 'Szablon diety',
};

// ── Action severity for coloring ──────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'normal';

function getActionSeverity(action: string): Severity {
  if (action.startsWith('DELETE_') || action === 'GENERATION_BLOCKED' || action === 'RED_FLAG_TRIGGERED' ||
      action === 'ACCOUNT_LOCKED' || action === 'LOGIN_FAILED') return 'critical';
  if (action.startsWith('EXPORT_') || action.startsWith('BULK_') || action === 'CHANGE_USER_ROLE' ||
      action === 'STRIPE_INVOICE_PAYMENT_FAILED' || action === 'STRIPE_REFUND' ||
      action === 'REVOKE_USER_SESSIONS' || action === 'ADMIN_FORCE_PASSWORD_RESET') return 'warning';
  return 'normal';
}

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-muted text-foreground',
};

// ── Grouped actions for dropdown ──────────────────────────────────────────

const ACTION_GROUPS: Array<{ label: string; actions: string[] }> = [
  { label: 'Auth', actions: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'EMAIL_VERIFIED', 'EMAIL_CHANGE'] },
  { label: 'Plany diety', actions: ['GENERATE_PLAN', 'VIEW_PLAN', 'APPROVE_PLAN', 'SEND_PLAN', 'PUBLISH_PLAN', 'EDIT_PLAN', 'EXPORT_PLAN', 'CREATE_MANUAL_PLAN', 'AI_GENERATION_ENQUEUED', 'AI_REPAIR_ENQUEUED', 'AI_PARTIAL_REGEN_ENQUEUED', 'REGENERATE_PARTIAL', 'RED_FLAG_TRIGGERED', 'GENERATION_BLOCKED'] },
  { label: 'Klienci', actions: ['VIEW_PATIENT', 'UPDATE_PATIENT', 'DELETE_PATIENT', 'CREATE_INTERVIEW', 'VIEW_INTERVIEW', 'CREATE_CHECKIN', 'CHECKIN_ADAPTATION', 'REQUEST_MEAL_SWAP', 'CONFIRM_MEAL_SWAP'] },
  { label: 'Użytkownicy', actions: ['CREATE_USER', 'DELETE_USER', 'RESTORE_USER', 'CHANGE_USER_ROLE', 'ADMIN_VERIFY_EMAIL', 'ADMIN_RESEND_VERIFICATION', 'ADMIN_FORCE_PASSWORD_RESET', 'BULK_USER_ACTION', 'REVOKE_USER_SESSIONS', 'DELETE_OWN_ACCOUNT', 'UNLOCK_ACCOUNT'] },
  { label: 'Dietetycy', actions: ['CREATE_DIETITIAN', 'UPDATE_DIETITIAN', 'ROTATE_DIETITIAN_CODE'] },
  { label: 'Stripe', actions: ['CHECKOUT_STARTED', 'CHECKOUT_COMPLETED', 'SUBSCRIPTION_CHECKOUT_STARTED', 'SUBSCRIPTION_PORTAL_ACCESSED', 'STRIPE_CHECKOUT_COMPLETED', 'STRIPE_INVOICE_PAID', 'STRIPE_SUBSCRIPTION_DELETED', 'STRIPE_SUBSCRIPTION_UPDATED', 'STRIPE_INVOICE_PAYMENT_FAILED', 'STRIPE_REFUND'] },
  { label: 'Przepisy & Produkty', actions: ['CREATE_RECIPE', 'UPDATE_RECIPE', 'DELETE_RECIPE', 'BULK_UPDATE_RECIPES', 'MERGE_RECIPES', 'CREATE_CLEAN_PRODUCT', 'UPDATE_CLEAN_PRODUCT', 'DELETE_CLEAN_PRODUCT', 'BULK_UPDATE_CLEAN_PRODUCTS'] },
  { label: 'Protokoły', actions: ['CREATE_PROTOCOL', 'UPDATE_PROTOCOL', 'TOGGLE_PROTOCOL', 'ASSIGN_PROTOCOL', 'UNASSIGN_PROTOCOL', 'PROTOCOL_AUTO_MATCHED', 'PROTOCOL_CONFLICT_DETECTED', 'CREATE_PROTOCOL_TRIGGER', 'UPDATE_PROTOCOL_TRIGGER', 'DELETE_PROTOCOL_TRIGGER', 'CREATE_PROTOCOL_CONFLICT', 'UPDATE_PROTOCOL_CONFLICT', 'DELETE_PROTOCOL_CONFLICT'] },
  { label: 'Blog & Opinie', actions: ['CREATE_POST', 'EDIT_POST', 'DELETE_POST', 'CREATE_TESTIMONIAL', 'DELETE_TESTIMONIAL', 'APPROVE_TESTIMONIAL', 'REJECT_TESTIMONIAL'] },
  { label: 'Inne', actions: ['CREATE_NOTE', 'REFERRAL_CODE_GENERATED', 'REFERRAL_USED', 'REFERRAL_DISCOUNT_APPLIED', 'UNLOCK_PATIENT_PROFILE'] },
];

const ALL_RESOURCE_TYPES = Object.keys(RESOURCE_LABELS);

// ── Component ─────────────────────────────────────────────────────────────

interface AuditLogTableProps {
  initialLogs: AuditLog[];
  initialTotal: number;
  initialPage: number;
  limit: number;
}

export function AuditLogTable({
  initialLogs,
  initialTotal,
  initialPage,
  limit,
}: AuditLogTableProps) {
  const t = useTranslations('admin.auditLog');
  const { data: session } = useSession();
  const token = '';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [action, setAction] = useState(searchParams.get('action') ?? '');
  const [resourceType, setResourceType] = useState(searchParams.get('resourceType') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');

  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, startExportTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const pushParams = useCallback(
    (params: {
      search: string;
      action: string;
      resourceType: string;
      dateFrom: string;
      dateTo: string;
      page: number;
    }) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.action) q.set('action', params.action);
      if (params.resourceType) q.set('resourceType', params.resourceType);
      if (params.dateFrom) q.set('dateFrom', params.dateFrom);
      if (params.dateTo) q.set('dateTo', params.dateTo);
      if (params.page > 1) q.set('page', String(params.page));
      router.push(`${pathname}?${q.toString()}`);
    },
    [router, pathname]
  );

  const currentFilters = useCallback(
    () => ({ search, action, resourceType, dateFrom, dateTo }),
    [search, action, resourceType, dateFrom, dateTo]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search: value, action, resourceType, dateFrom, dateTo, page: 1 });
    }, 300);
  };

  const handleActionChange = (value: string) => {
    const next = value === '__all__' ? '' : value;
    setAction(next);
    pushParams({ search, action: next, resourceType, dateFrom, dateTo, page: 1 });
  };

  const handleResourceTypeChange = (value: string) => {
    const next = value === '__all__' ? '' : value;
    setResourceType(next);
    pushParams({ search, action, resourceType: next, dateFrom, dateTo, page: 1 });
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search, action, resourceType, dateFrom: value, dateTo, page: 1 });
    }, 400);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ search, action, resourceType, dateFrom, dateTo: value, page: 1 });
    }, 400);
  };

  const handleReset = () => {
    setSearch('');
    setAction('');
    setResourceType('');
    setDateFrom('');
    setDateTo('');
    router.push(pathname);
  };

  const hasFilters = !!(search || action || resourceType || dateFrom || dateTo);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setLogs(initialLogs);
    setTotal(initialTotal);
    setPage(initialPage);
  }, [initialLogs, initialTotal, initialPage]);

  const handleExportCsv = () => {
    startExportTransition(async () => {
      try {
        const filters = currentFilters();
        const params: Record<string, string> = {};
        if (filters.search) params.search = filters.search;
        if (filters.action) params.action = filters.action;
        if (filters.resourceType) params.resourceType = filters.resourceType;
        if (filters.dateFrom) params.dateFrom = new Date(filters.dateFrom).toISOString();
        if (filters.dateTo) {
          const d = new Date(filters.dateTo);
          d.setHours(23, 59, 59, 999);
          params.dateTo = d.toISOString();
        }

        // URL is /api/proxy/* — auth is injected server-side by the proxy
        const res = await fetch(api.admin.exportAuditLogsCsvUrl(params));
        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // silent
      }
    });
  };

  const handleCopyMetadata = async (metadata: Record<string, unknown>) => {
    await navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;
  const resourceLabel = (r: string) => RESOURCE_LABELS[r] ?? r;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9"
            />
          </div>

          <Select value={action || '__all__'} onValueChange={handleActionChange}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={t('filterAction')} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="__all__">{t('filterAll')}</SelectItem>
              {ACTION_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                  {group.actions.map((a) => (
                    <SelectItem key={a} value={a} className="pl-4 text-xs">
                      {ACTION_LABELS[a] ?? a}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>

          <Select value={resourceType || '__all__'} onValueChange={handleResourceTypeChange}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder={t('filterResourceType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('filterAll')}</SelectItem>
              {ALL_RESOURCE_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {RESOURCE_LABELS[rt] ?? rt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-2 flex-1">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">{t('filterDateFrom')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">{t('filterDateTo')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 sm:mt-5">
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                {t('filterReset')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? t('exporting') : t('exportCsv')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                {t('colTimestamp')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                {t('colUser')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                {t('colAction')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                {t('colResourceType')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                {t('colIp')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t('empty')}
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const severity = getActionSeverity(log.action);
              return (
                <tr
                  key={log.id}
                  className="transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => setDetailLog(log)}
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString('pl-PL')}
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate">
                    {log.user?.email ?? <span className="text-muted-foreground">{t('noUser')}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', SEVERITY_CLASSES[severity])}
                      title={log.action}
                    >
                      {actionLabel(log.action)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {log.resourceType ? resourceLabel(log.resourceType) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                    {log.ip ?? '—'}
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
            from: total === 0 ? 0 : Math.min((page - 1) * limit + 1, total),
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
            onClick={() =>
              pushParams({ search, action, resourceType, dateFrom, dateTo, page: page - 1 })
            }
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
            onClick={() =>
              pushParams({ search, action, resourceType, dateFrom, dateTo, page: page + 1 })
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Total count (51.10) */}
      <div className="text-xs text-muted-foreground text-center py-1">
        {t('totalCount', { count: total })}
      </div>

      {/* Detail drawer (51.2) */}
      <Sheet open={!!detailLog} onOpenChange={(v) => !v && setDetailLog(null)}>
        <SheetContent className="w-full max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('detailTitle')}</SheetTitle>
          </SheetHeader>
          {detailLog && (
            <div className="mt-4 space-y-4">
              <div className="space-y-3 text-sm">
                <DetailRow label={t('colTimestamp')} value={new Date(detailLog.createdAt).toLocaleString('pl-PL')} />
                <DetailRow label={t('colUser')} value={detailLog.user?.email ?? '—'} />
                <DetailRow label="User ID" value={detailLog.userId ?? '—'} />
                <DetailRow label={t('colAction')}>
                  <Badge variant="outline" className={cn('text-xs', SEVERITY_CLASSES[getActionSeverity(detailLog.action)])}>
                    {actionLabel(detailLog.action)}
                  </Badge>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{detailLog.action}</span>
                </DetailRow>
                <DetailRow label={t('colResourceType')} value={detailLog.resourceType ? resourceLabel(detailLog.resourceType) : '—'} />
                <DetailRow label="Resource ID" value={detailLog.resourceId ?? '—'} />
                <DetailRow label={t('colIp')} value={detailLog.ip ?? '—'} />
              </div>

              {detailLog.metadata && Object.keys(detailLog.metadata).length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Metadata</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleCopyMetadata(detailLog.metadata!)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? t('copied') : t('copyJson')}
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-[300px]">
                    {JSON.stringify(detailLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children ?? <span className="font-medium text-right break-all">{value}</span>}
    </div>
  );
}
