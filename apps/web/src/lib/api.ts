/**
 * Typed API client for the bambooIT backend.
 * Uses NEXT_PUBLIC_API_URL (client + server) for all requests.
 * Server-only auth requests use API_URL env variable.
 */
import type { Company, Order, ProductType, CheckoutProductType, Subscription, AdminStats, UserRole, User, AdminUser, AuditLog, BlogPost, BlogListItem, BlogCategoryConfig, AccessStatus, Testimonial, TestimonialWithUser, PublicTestimonial, NotificationPreferences, SubscriptionStats, SubscriptionItem, CompanyInvoice, Lead, LeadStatus, LeadType, LeadsStats, LeadsListResponse, EmailCampaign, EmailCampaignAudience, AudienceCounts } from '@/types/api';
import type { Plan, ServicePackage, OpsClientSummary, OpsHoursView, OpsPeriod, OpsOnboarding, OpsTimeEntry, AccessEntry, AccessKind } from '@/types/ops';
import type {
  MyTicketSummary,
  MyTicketDetail,
  AdminTicketRow,
  AdminTicketDetail,
  TicketMessage,
  TicketStats,
  TicketStatus,
  TicketPriority,
  TicketChannel,
} from '@/types/tickets';
import { getApiBaseUrl } from './api-url';

/** Tracks whether a 401 auto-logout is already in progress to prevent multiple redirects */
let logoutInProgress = false;

export class ApiError extends Error {
  public fields?: Array<{ field: string; code: string; minimum?: number }>;
  public code?: string;

  constructor(
    public status: number,
    message: string,
    fields?: Array<{ field: string; code: string; minimum?: number }>,
    code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const { token, ...fetchOptions } = options ?? {};

  // In the browser, route everything through the Next.js proxy at /api/proxy/*.
  // The proxy injects the backend Bearer token server-side from the NextAuth
  // JWT (httpOnly cookie), so the token is never exposed to client JS.
  // The `token` param is intentionally ignored on the client — kept only for
  // compatibility with existing call-sites; server-side calls still use it.
  const isBrowser = typeof window !== 'undefined';
  const url = isBrowser
    ? `/api/proxy${path.startsWith('/') ? path : '/' + path}`
    : `${getApiBaseUrl()}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // Only attach Bearer token on server-side calls (SSR / Server Components).
      // The browser never sends it — proxy injects it from the JWT.
      ...(!isBrowser && token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions?.headers,
    },
    ...fetchOptions,
  });

  if (!res.ok) {
    let message = `API ${res.status}: ${path}`;
    let fields: Array<{ field: string; code: string; minimum?: number }> | undefined;
    let errorCode: string | undefined;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
      if (body?.error?.code) errorCode = body.error.code;
      if (body?.error?.fields) fields = body.error.fields;
    } catch { /* ignore parse errors */ }

    // Auto-logout on 401 (expired/revoked token) — client-side only.
    // Note: after the proxy migration, client calls don't carry a `token` arg
    // anymore — we trigger on any 401 from the browser instead.
    if (res.status === 401 && isBrowser && !logoutInProgress) {
      logoutInProgress = true;
      const locale = window.location.pathname.split('/')[1] || 'pl';
      // Pass a query param so the login page can show a tailored message,
      // e.g. "you were logged out because someone signed in elsewhere".
      const reason = errorCode === 'SESSION_SUPERSEDED' ? '?reason=superseded' : '';
      const loginPath = `/${locale}/zaloguj${reason}`;
      // Return the logout promise so any rejection chains into .catch() below
      // instead of floating as an unhandled rejection (which fails CI test runs).
      import('./logout').then(({ performFullLogout }) => performFullLogout(loginPath)).catch(() => {
        // Fallback: hard redirect
        window.location.href = loginPath;
      });
    }

    throw new ApiError(res.status, message, fields, errorCode);
  }

  return res.json() as Promise<T>;
}

export const api = {
  health: {
    check: () => apiFetch<{ status: string }>('/health'),
    db: () => apiFetch<{ ok: boolean; usersCount: number }>('/health/db'),
  },
  auth: {
    register: (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName: string;
      nip: string;
      industry: 'accounting' | 'law' | 'medical' | 'production' | 'hospitality' | 'other';
      phone: string;
      employeesCount?: number;
      website?: string;
      consents: {
        termsAccepted: boolean;
        privacyPolicy: boolean;
        emailNotifications: boolean;
      };
      deviceFingerprint?: string;
    }) =>
      apiFetch<{ ok: boolean; user: { id: string; email: string; role: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    forgotPassword: (data: { email: string }) =>
      apiFetch<{ ok: boolean }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resetPassword: (data: { token: string; password: string }) =>
      apiFetch<{ ok: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verifyEmail: (data: { token: string }) =>
      apiFetch<{ ok: boolean }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resendVerification: (data: { email: string }) =>
      apiFetch<{ ok: boolean }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  orders: {
    createMy: (
      data: { productType: CheckoutProductType },
      token: string
    ) =>
      apiFetch<{ ok: boolean; order: Order; companyId: string }>('/orders/my', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    listMy: (token: string) =>
      apiFetch<{
        ok: boolean;
        orders: Order[];
        subscription: Subscription | null;
        stripeConfigured: boolean;
      }>('/orders/my', { token }),
    getMyPortal: (token: string) =>
      apiFetch<{ ok: boolean; url: string }>('/orders/my/portal', { token }),
    getInvoice: (orderId: string, token: string) =>
      apiFetch<{ ok: boolean; invoiceUrl: string | null }>(`/orders/${orderId}/invoice`, { token }),
    cancelSubscription: (token: string) =>
      apiFetch<{ ok: boolean; subscription: Subscription }>('/orders/my/cancel-subscription', {
        method: 'POST',
        token,
      }),
    resumeSubscription: (token: string) =>
      apiFetch<{ ok: boolean; subscription: Subscription }>('/orders/my/resume-subscription', {
        method: 'POST',
        token,
      }),
    listMyInvoices: (token: string) =>
      apiFetch<{ ok: boolean; invoices: CompanyInvoice[] }>('/orders/my/invoices', { token }),
    canWithdraw: (token: string) =>
      apiFetch<{ ok: boolean; eligible: boolean; orderId?: string; daysLeft?: number }>('/orders/my/can-withdraw', { token }),
    withdraw: (token: string) =>
      apiFetch<{ ok: boolean; orderId: string; productType: string }>('/orders/my/withdraw', {
        method: 'POST',
        token,
      }),
    getMyHours: (params?: { year?: number; month?: number }, token?: string) => {
      const qs = new URLSearchParams();
      if (params?.year) qs.set('year', String(params.year));
      if (params?.month) qs.set('month', String(params.month));
      const q = qs.toString();
      return apiFetch<{ ok: boolean; hours: OpsHoursView | null }>(
        `/orders/my/hours${q ? `?${q}` : ''}`,
        { token },
      );
    },
  },
  tickets: {
    listMy: (status?: TicketStatus, token?: string) => {
      const q = status ? `?status=${status}` : '';
      return apiFetch<{ ok: boolean; tickets: MyTicketSummary[] }>(`/tickets/my${q}`, { token });
    },
    create: (
      data: { title: string; body: string; priority?: TicketPriority; category?: string | null },
      token?: string,
    ) =>
      apiFetch<{ ok: boolean; ticket: MyTicketDetail }>('/tickets/my', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    getMy: (id: string, token?: string) =>
      apiFetch<{ ok: boolean; ticket: MyTicketDetail }>(`/tickets/my/${id}`, { token }),
    addMessage: (id: string, body: string, token?: string) =>
      apiFetch<{ ok: boolean; message: TicketMessage }>(`/tickets/my/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
        token,
      }),
  },
  profile: {
    getCompany: (token?: string) =>
      apiFetch<{ ok: boolean; company: Company }>('/profile/company', { token }),
    updateCompany: (
      data: Partial<
        Pick<
          Company,
          | 'contactFirstName'
          | 'contactLastName'
          | 'companyName'
          | 'nip'
          | 'industry'
          | 'employeesCount'
          | 'city'
          | 'address'
          | 'postalCode'
          | 'phone'
          | 'website'
        >
      >,
      token?: string,
    ) =>
      apiFetch<{ ok: boolean; company: Company }>('/profile/company', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    changePassword: (
      data: { oldPassword: string; newPassword: string },
      token: string
    ) =>
      apiFetch<{ ok: boolean }>('/profile/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    changeEmail: (
      data: { newEmail: string; password: string },
      token: string
    ) =>
      apiFetch<{ ok: boolean }>('/profile/email', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    getNotifications: (token: string) =>
      apiFetch<{ ok: boolean; preferences: NotificationPreferences }>('/profile/notifications', { token }),
    updateNotifications: (
      data: Partial<NotificationPreferences>,
      token: string
    ) =>
      apiFetch<{ ok: boolean; preferences: NotificationPreferences }>('/profile/notifications', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    deleteAccount: (password: string, token: string) =>
      apiFetch<{ ok: boolean }>('/profile/account', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
        token,
      }),
    exportData: (token: string) =>
      apiFetch<Record<string, unknown>>('/profile/data-export', { token }),
    getConsents: (token: string) =>
      apiFetch<{ ok: boolean; consents: Array<{ type: string; granted: boolean; grantedAt: string; version?: string }> }>('/profile/consents', { token }),
    getConsentHistory: (token: string) =>
      apiFetch<{ ok: boolean; history: Array<{ type: string; granted: boolean; grantedAt: string; revokedAt?: string; version?: string }> }>('/profile/consents/history', { token }),
    revokeConsent: (type: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/profile/consents/${type}/revoke`, {
        method: 'POST',
        token,
      }),
  },
  checkout: {
    createSession: (
      data: { productType: CheckoutProductType },
      token?: string
    ) =>
      apiFetch<{ ok: boolean; url: string }>('/checkout/create-session', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
  },
  subscription: {
    getMy: (token: string) =>
      apiFetch<{ ok: boolean; subscription: Subscription; stripeConfigured: boolean }>(
        '/subscriptions/my',
        { token }
      ),
    createCheckout: (plan: 'START' | 'FIRMA' | 'FIRMA_PLUS', token: string) =>
      apiFetch<{ ok: boolean; url: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
        token,
      }),
    getPortal: (token: string) =>
      apiFetch<{ ok: boolean; url: string }>('/subscriptions/portal', { token }),
  },
  admin: {
    leads: {
      list: (
        params: {
          page?: number;
          pageSize?: number;
          status?: LeadStatus;
          type?: LeadType;
          source?: string;
          search?: string;
          dateFrom?: string;
          dateTo?: string;
        },
        token?: string,
      ) => {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.pageSize) query.set('pageSize', String(params.pageSize));
        if (params.status) query.set('status', params.status);
        if (params.type) query.set('type', params.type);
        if (params.source) query.set('source', params.source);
        if (params.search) query.set('search', params.search);
        if (params.dateFrom) query.set('dateFrom', params.dateFrom);
        if (params.dateTo) query.set('dateTo', params.dateTo);
        const qs = query.toString();
        return apiFetch<LeadsListResponse>(`/admin/leads${qs ? `?${qs}` : ''}`, { token });
      },
      getStats: (token?: string) =>
        apiFetch<{ ok: boolean; stats: LeadsStats }>('/admin/leads/stats', { token }),
      getById: (id: string, token?: string) =>
        apiFetch<{ ok: boolean; lead: Lead }>(`/admin/leads/${id}`, { token }),
      updateStatus: (id: string, status: LeadStatus, token?: string) =>
        apiFetch<{ ok: boolean; lead: Lead }>(`/admin/leads/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
          token,
        }),
      addNote: (id: string, text: string, token?: string) =>
        apiFetch<{ ok: boolean; lead: Lead; note: { id: string } }>(`/admin/leads/${id}/notes`, {
          method: 'POST',
          body: JSON.stringify({ text }),
          token,
        }),
      deleteNote: (id: string, noteId: string, token?: string) =>
        apiFetch<{ ok: boolean; lead: Lead }>(`/admin/leads/${id}/notes/${noteId}`, {
          method: 'DELETE',
          token,
        }),
      exportCsvUrl: (params: { status?: LeadStatus; type?: LeadType; search?: string }) => {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.type) query.set('type', params.type);
        if (params.search) query.set('search', params.search);
        const qs = query.toString();
        return `/api/proxy/admin/leads/export.csv${qs ? `?${qs}` : ''}`;
      },
    },
    emailCampaigns: {
      list: (token?: string) =>
        apiFetch<{ ok: boolean; campaigns: EmailCampaign[]; audienceCounts: AudienceCounts }>(
          '/admin/email-campaigns',
          { token },
        ),
      audienceCounts: (token?: string) =>
        apiFetch<{ ok: boolean; audienceCounts: AudienceCounts }>(
          '/admin/email-campaigns/audience-counts',
          { token },
        ),
      get: (id: string, token?: string) =>
        apiFetch<{ ok: boolean; campaign: EmailCampaign }>(`/admin/email-campaigns/${id}`, {
          token,
        }),
      create: (
        input: { subject: string; body: string; audience: EmailCampaignAudience },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; campaign: EmailCampaign }>('/admin/email-campaigns', {
          method: 'POST',
          body: JSON.stringify(input),
          token,
        }),
      update: (
        id: string,
        input: { subject?: string; body?: string; audience?: EmailCampaignAudience },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; campaign: EmailCampaign }>(`/admin/email-campaigns/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
          token,
        }),
      remove: (id: string, token?: string) =>
        apiFetch<{ ok: boolean }>(`/admin/email-campaigns/${id}`, { method: 'DELETE', token }),
      send: (id: string, token?: string) =>
        apiFetch<{ ok: boolean; campaign: EmailCampaign; transportConfigured: boolean }>(
          `/admin/email-campaigns/${id}/send`,
          { method: 'POST', token },
        ),
    },
    ops: {
      listPackages: (token?: string) =>
        apiFetch<{ ok: boolean; packages: ServicePackage[] }>('/admin/ops/packages', { token }),
      listClients: (token?: string) =>
        apiFetch<{ ok: boolean; clients: OpsClientSummary[] }>('/admin/ops/clients', { token }),
      setServicePlan: (
        companyId: string,
        data: { plan: Plan | null; serviceSince?: string | null },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; company: { id: string; servicePlan: Plan | null; serviceSince: string | null } }>(
          `/admin/ops/clients/${companyId}/service-plan`,
          { method: 'PATCH', body: JSON.stringify(data), token },
        ),
      getHours: (
        companyId: string,
        params?: { year?: number; month?: number },
        token?: string,
      ) => {
        const qs = new URLSearchParams();
        if (params?.year) qs.set('year', String(params.year));
        if (params?.month) qs.set('month', String(params.month));
        const q = qs.toString();
        return apiFetch<{ ok: boolean; hours: OpsHoursView | null }>(
          `/admin/ops/clients/${companyId}/hours${q ? `?${q}` : ''}`,
          { token },
        );
      },
      addTimeEntry: (
        companyId: string,
        data: { date: string; minutes: number; description: string; billable?: boolean; ticketId?: string | null },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; entry: OpsTimeEntry }>(
          `/admin/ops/clients/${companyId}/time-entries`,
          { method: 'POST', body: JSON.stringify(data), token },
        ),
      deleteTimeEntry: (id: string, token?: string) =>
        apiFetch<{ ok: boolean }>(`/admin/ops/time-entries/${id}`, { method: 'DELETE', token }),
      listPeriods: (companyId: string, token?: string) =>
        apiFetch<{ ok: boolean; periods: OpsPeriod[] }>(
          `/admin/ops/clients/${companyId}/periods`,
          { token },
        ),
      settlePeriod: (id: string, token?: string) =>
        apiFetch<{ ok: boolean; period: OpsPeriod }>(`/admin/ops/periods/${id}/settle`, {
          method: 'PATCH',
          token,
        }),
      sendReport: (id: string, token?: string) =>
        apiFetch<{ ok: boolean }>(`/admin/ops/periods/${id}/report`, { method: 'POST', token }),
      getOnboarding: (companyId: string, token?: string) =>
        apiFetch<{ ok: boolean; onboarding: OpsOnboarding }>(
          `/admin/ops/clients/${companyId}/onboarding`,
          { token },
        ),
      updateOnboarding: (
        companyId: string,
        data: Partial<{
          accessCollected: boolean;
          remoteToolReady: boolean;
          monitoringSet: boolean;
          backupSet: boolean;
          docsCreated: boolean;
          completed: boolean;
          notes: string;
        }>,
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; onboarding: OpsOnboarding }>(
          `/admin/ops/clients/${companyId}/onboarding`,
          { method: 'PATCH', body: JSON.stringify(data), token },
        ),
      listAccess: (companyId: string, token?: string) =>
        apiFetch<{ ok: boolean; entries: AccessEntry[] }>(
          `/admin/ops/clients/${companyId}/access`,
          { token },
        ),
      addAccess: (
        companyId: string,
        data: { kind: AccessKind; label: string; identifier?: string | null; secret?: string | null; notes?: string | null },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; entry: AccessEntry }>(
          `/admin/ops/clients/${companyId}/access`,
          { method: 'POST', body: JSON.stringify(data), token },
        ),
      updateAccess: (
        id: string,
        data: Partial<{ kind: AccessKind; label: string; identifier: string | null; secret: string | null; notes: string | null }>,
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; entry: AccessEntry }>(`/admin/ops/access/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      deleteAccess: (id: string, token?: string) =>
        apiFetch<{ ok: boolean }>(`/admin/ops/access/${id}`, { method: 'DELETE', token }),
    },
    tickets: {
      list: (
        params?: {
          status?: TicketStatus;
          priority?: TicketPriority;
          companyId?: string;
          assigneeId?: string;
          slaBreached?: boolean;
          page?: number;
          pageSize?: number;
        },
        token?: string,
      ) => {
        const qs = new URLSearchParams();
        if (params?.status) qs.set('status', params.status);
        if (params?.priority) qs.set('priority', params.priority);
        if (params?.companyId) qs.set('companyId', params.companyId);
        if (params?.assigneeId) qs.set('assigneeId', params.assigneeId);
        if (params?.slaBreached) qs.set('slaBreached', 'true');
        if (params?.page) qs.set('page', String(params.page));
        if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
        const q = qs.toString();
        return apiFetch<{
          ok: boolean;
          tickets: AdminTicketRow[];
          total: number;
          page: number;
          pageSize: number;
        }>(`/admin/tickets${q ? `?${q}` : ''}`, { token });
      },
      stats: (token?: string) =>
        apiFetch<{ ok: boolean; stats: TicketStats }>('/admin/tickets/stats', { token }),
      get: (id: string, token?: string) =>
        apiFetch<{ ok: boolean; ticket: AdminTicketDetail }>(`/admin/tickets/${id}`, { token }),
      create: (
        data: {
          companyId: string;
          title: string;
          body: string;
          priority?: TicketPriority;
          category?: string | null;
          channel?: Extract<TicketChannel, 'PHONE' | 'MANUAL'>;
        },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; ticket: AdminTicketDetail }>('/admin/tickets', {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
      patch: (
        id: string,
        data: Partial<{
          status: TicketStatus;
          priority: TicketPriority;
          category: string | null;
          assigneeId: string | null;
        }>,
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; ticket: AdminTicketDetail }>(`/admin/tickets/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      addMessage: (
        id: string,
        data: { body: string; internal?: boolean },
        token?: string,
      ) =>
        apiFetch<{ ok: boolean; message: TicketMessage }>(`/admin/tickets/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
    },
    getStats: (token: string) =>
      apiFetch<{ ok: boolean; stats: AdminStats }>('/admin/stats', { token }),
    getActionItems: (token: string) =>
      apiFetch<{ ok: boolean; pendingTestimonials: number; pendingConsultations: number; recipesNeedingWork: number; lockedAccounts: number }>('/admin/dashboard/action-items', { token }),
    getSecurityStats: (token: string) =>
      apiFetch<{ ok: boolean; failedLogins24h: number; lockedAccounts: number; suspiciousDevices: number; recentRegistrations24h: number }>('/admin/security/stats', { token }),
    getSubscriptionStats: (token: string) =>
      apiFetch<{ ok: boolean; stats: SubscriptionStats }>('/admin/subscriptions/stats', { token }),
    listSubscriptions: (params: { page?: number; limit?: number; status?: string; productType?: string; dateFrom?: string; dateTo?: string }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.status) query.set('status', params.status);
      if (params.productType) query.set('productType', params.productType);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      return apiFetch<{ ok: boolean; items: SubscriptionItem[]; total: number; page: number; limit: number }>(`/admin/subscriptions?${query}`, { token });
    },
    listUsers: (params: { page?: number; limit?: number; search?: string; role?: UserRole; excludeRole?: UserRole; hideDeleted?: boolean; inactiveMonths?: number; sortBy?: string; sortOrder?: string; createdFrom?: string; createdTo?: string; subscriptionStatus?: string }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.role) query.set('role', params.role);
      if (params.excludeRole) query.set('excludeRole', params.excludeRole);
      if (params.hideDeleted) query.set('hideDeleted', 'true');
      if (params.inactiveMonths) query.set('inactiveMonths', String(params.inactiveMonths));
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.createdFrom) query.set('createdFrom', params.createdFrom);
      if (params.createdTo) query.set('createdTo', params.createdTo);
      if (params.subscriptionStatus) query.set('subscriptionStatus', params.subscriptionStatus);
      return apiFetch<{ ok: boolean; users: AdminUser[]; total: number; page: number; limit: number }>(
        `/admin/users?${query.toString()}`,
        { token }
      );
    },
    getUserById: (id: string, token: string) =>
      apiFetch<{ ok: boolean; user: AdminUser }>(`/admin/users/${id}`, { token }),
    changeRole: (id: string, role: UserRole, token: string) =>
      apiFetch<{ ok: boolean; user: Pick<User, 'id' | 'email' | 'role'> }>(`/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
        token,
      }),
    deleteUser: (id: string, token: string) =>
      apiFetch<{ ok: boolean; user: { id: string; email: string; deletedAt: string } }>(`/admin/users/${id}`, {
        method: 'DELETE',
        token,
      }),
    restoreUser: (id: string, token: string) =>
      apiFetch<{ ok: boolean; user: { id: string; email: string; deletedAt: null } }>(`/admin/users/${id}/restore`, {
        method: 'PATCH',
        token,
      }),
    createUser: (data: { email: string; password?: string; firstName?: string; lastName?: string }, token: string) =>
      apiFetch<{ ok: boolean; userId: string; email: string; role: string; firstName: string | null; lastName: string | null }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    verifyUserEmail: (id: string, token: string) =>
      apiFetch<{ ok: boolean; user: { id: string; email: string; emailVerified: string } }>(`/admin/users/${id}/verify-email`, {
        method: 'POST',
        token,
      }),
    resendVerification: (id: string, token: string) =>
      apiFetch<{ ok: boolean; id: string; email: string }>(`/admin/users/${id}/resend-verification`, {
        method: 'POST',
        token,
      }),
    getSettings: (token: string) =>
      apiFetch<{ ok: boolean; settings: Record<string, unknown> }>('/admin/settings', { token }),
    patchSettings: (data: Record<string, unknown>, token: string) =>
      apiFetch<{ ok: boolean; settings: Record<string, unknown> }>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    forcePasswordReset: (userId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/users/${userId}/force-password-reset`, {
        method: 'POST',
        token,
      }),
    bulkUserAction: (ids: string[], action: string, token: string) =>
      apiFetch<{ ok: boolean; affected: number }>('/admin/users/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, action }),
        token,
      }),
    revokeUserSessions: (userId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/users/${userId}/revoke-sessions`, {
        method: 'POST',
        token,
      }),
    listAuditLogs: (
      params: {
        page?: number;
        limit?: number;
        search?: string;
        action?: string;
        resourceType?: string;
        dateFrom?: string;
        dateTo?: string;
      },
      token: string
    ) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.action) query.set('action', params.action);
      if (params.resourceType) query.set('resourceType', params.resourceType);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      return apiFetch<{ ok: boolean; logs: AuditLog[]; total: number; page: number; limit: number }>(
        `/admin/audit-logs?${query.toString()}`,
        { token }
      );
    },
    getAuditLogStats: (token: string) =>
      apiFetch<{ ok: boolean; stats: { totalToday: number; totalThisWeek: number; totalAll: number; topActions: Array<{ action: string; count: number }>; topUsers: Array<{ userId: string; email: string; count: number }> } }>('/admin/audit-logs/stats', { token }),
    exportAuditLogsCsvUrl: (
      params: {
        search?: string;
        action?: string;
        resourceType?: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ): string => {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.action) query.set('action', params.action);
      if (params.resourceType) query.set('resourceType', params.resourceType);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      return `/api/proxy/admin/audit-logs/export?${query.toString()}`;
    },
    blogCategories: {
      list: (token: string) =>
        apiFetch<{ ok: boolean; categories: BlogCategoryConfig[] }>('/admin/blog/categories', { token }),
      create: (data: { name: string; slug: string; isActive?: boolean }, token: string) =>
        apiFetch<{ ok: boolean; category: BlogCategoryConfig }>('/admin/blog/categories', {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
      update: (id: string, data: Partial<{ name: string; slug: string; isActive: boolean }>, token: string) =>
        apiFetch<{ ok: boolean; category: BlogCategoryConfig }>(`/admin/blog/categories/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      delete: (id: string, token: string) =>
        apiFetch<{ ok: boolean }>(`/admin/blog/categories/${id}`, { method: 'DELETE', token }),
    },
    blog: {
      list: (params: { page?: number; limit?: number }, token: string) => {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.limit) query.set('limit', String(params.limit));
        return apiFetch<{ ok: boolean; posts: BlogPost[]; total: number; page: number; limit: number }>(
          `/admin/posts?${query.toString()}`,
          { token }
        );
      },
      getById: (id: string, token: string) =>
        apiFetch<{ ok: boolean; post: BlogPost }>(`/admin/posts/${id}`, { token }),
      uploadImage: async (file: File, _token?: string) => {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`/api/proxy/admin/blog/upload-image`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          let message = `Upload failed: ${res.status}`;
          try { const body = await res.json(); if (body?.error?.message) message = body.error.message; } catch { /* ignore */ }
          throw new ApiError(res.status, message);
        }
        return res.json() as Promise<{ ok: boolean; url: string }>;
      },
      create: (
        data: {
          slug: string; title: string; titleEn?: string; excerpt: string; excerptEn?: string;
          content: string; contentEn?: string; category: string; author: string; imageSrc?: string;
          imageAlt?: string; imageAltEn?: string; readTime: number; publishedAt: string; published?: boolean;
          faq?: { question: string; answer: string }[];
        },
        token: string
      ) =>
        apiFetch<{ ok: boolean; post: BlogPost }>('/admin/posts', {
          method: 'POST',
          body: JSON.stringify(data),
          token,
        }),
      update: (id: string, data: Partial<{
        slug: string; title: string; titleEn?: string; excerpt: string; excerptEn?: string;
        content: string; contentEn?: string; category: string; author: string; imageSrc?: string;
        imageAlt?: string; imageAltEn?: string; readTime: number; publishedAt: string; published: boolean;
        faq: { question: string; answer: string }[];
      }>, token: string) =>
        apiFetch<{ ok: boolean; post: BlogPost }>(`/admin/posts/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
          token,
        }),
      delete: (id: string, token: string) =>
        apiFetch<{ ok: boolean }>(`/admin/posts/${id}`, {
          method: 'DELETE',
          token,
        }),
    },
  },
  stripeAdmin: {
    getDashboard: (token: string) =>
      apiFetch<{ ok: boolean; dashboard: { balanceAvailable: number; balancePending: number; mrr: number; todayTransactions: number; todayRevenue: number; failedPayments7d: number; currency: string } }>('/admin/stripe/dashboard', { token }),
    listTransactions: (params: { limit?: number; startingAfter?: string; status?: string; dateFrom?: number; dateTo?: number }, token: string) => {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', String(params.limit));
      if (params.startingAfter) query.set('startingAfter', params.startingAfter);
      if (params.status) query.set('status', params.status);
      if (params.dateFrom) query.set('dateFrom', String(params.dateFrom));
      if (params.dateTo) query.set('dateTo', String(params.dateTo));
      return apiFetch<{ ok: boolean; transactions: Array<{ id: string; amount: number; currency: string; status: string; created: string; customerEmail: string | null; description: string | null; paymentIntentId: string | null; refunded: boolean; refundedAmount: number }>; hasMore: boolean }>(`/admin/stripe/transactions?${query.toString()}`, { token });
    },
    createRefund: (data: { paymentIntentId: string; amount?: number; reason?: string }, token: string) =>
      apiFetch<{ ok: boolean; refund: { id: string; amount: number; status: string } }>('/admin/stripe/refund', { method: 'POST', body: JSON.stringify(data), token }),
    listFailedPayments: (token: string) =>
      apiFetch<{ ok: boolean; payments: Array<{ id: string; amount: number; currency: string; created: string; customerEmail: string | null; failureMessage: string | null; daysPastDue: number }> }>('/admin/stripe/failed-payments', { token }),
    listCoupons: (token: string) =>
      apiFetch<{ ok: boolean; coupons: Array<{ id: string; name: string | null; percentOff: number | null; amountOff: number | null; currency: string | null; duration: string; durationInMonths: number | null; maxRedemptions: number | null; timesRedeemed: number; redeemBy: string | null; valid: boolean }> }>('/admin/stripe/coupons', { token }),
    createCoupon: (data: { name: string; percentOff?: number; amountOff?: number; duration: string; durationInMonths?: number; maxRedemptions?: number; redeemBy?: number }, token: string) =>
      apiFetch<{ ok: boolean }>('/admin/stripe/coupons', { method: 'POST', body: JSON.stringify(data), token }),
    deleteCoupon: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/stripe/coupons/${id}`, { method: 'DELETE', token }),
  },
  accounting: {
    getRevenue: (month: string, token: string) =>
      apiFetch<{ ok: boolean; report: { month: string; vatEnabled: boolean; vatRate: number; rows: Array<{ productType: string; count: number; brutto: number; netto: number | null; vat: number | null }>; totalBrutto: number; totalNetto: number | null; totalVat: number | null; previousMonthBrutto: number; changePercent: number | null } }>(`/admin/accounting/revenue?month=${month}`, { token }),
    getCosts: (month: string, token: string) =>
      apiFetch<{ ok: boolean; report: { month: string; revenue: number; aiCosts: number; stripeFees: number; netProfit: number; aiCostsPercent: number; stripeFeesPercent: number; marginPercent: number } }>(`/admin/accounting/costs?month=${month}`, { token }),
    getChurn: (month: string, token: string) =>
      apiFetch<{ ok: boolean; report: { month: string; activeStart: number; newSubscriptions: number; cancelled: number; activeEnd: number; churnRate: number; retentionRate: number; netChange: number } }>(`/admin/accounting/churn?month=${month}`, { token }),
    getInvoices: (month: string, token: string) =>
      apiFetch<{ ok: boolean; invoices: Array<{ url: string; filename: string }>; count: number }>(`/admin/accounting/invoices-export?month=${month}`, { token }),
  },
  access: {
    status: (token: string) =>
      apiFetch<{ ok: boolean } & AccessStatus>('/access/status', { token }),
  },
  blog: {
    list: (params?: { page?: number; limit?: number; category?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.category) query.set('category', params.category);
      return apiFetch<{ ok: boolean; posts: BlogListItem[]; total: number; page: number; limit: number }>(
        `/posts?${query.toString()}`
      );
    },
    getBySlug: (slug: string) =>
      apiFetch<{ ok: boolean; post: BlogPost }>(`/posts/${slug}`),
    categories: () =>
      apiFetch<{ ok: boolean; categories: BlogCategoryConfig[] }>('/posts/categories'),
  },
  testimonials: {
    getApproved: () =>
      apiFetch<{ ok: boolean; testimonials: PublicTestimonial[] }>('/testimonials'),
    getMy: (token: string) =>
      apiFetch<{ ok: boolean; testimonial: Testimonial | null }>('/testimonials/my', { token }),
    create: (data: { content: string; rating: number }, token: string) =>
      apiFetch<{ ok: boolean; testimonial: Testimonial }>('/testimonials', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    deleteMy: (token: string) =>
      apiFetch<{ ok: boolean }>('/testimonials/my', { method: 'DELETE', token }),
    adminList: (params: { page?: number; limit?: number; status?: string; search?: string; sortBy?: string; sortOrder?: string; ratingMin?: number; ratingMax?: number }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.ratingMin) query.set('ratingMin', String(params.ratingMin));
      if (params.ratingMax) query.set('ratingMax', String(params.ratingMax));
      return apiFetch<{ ok: boolean; testimonials: TestimonialWithUser[]; total: number; page: number; limit: number }>(
        `/testimonials/admin?${query.toString()}`,
        { token }
      );
    },
    adminUpdateStatus: (id: string, status: 'APPROVED' | 'REJECTED', token: string) =>
      apiFetch<{ ok: boolean; testimonial: Testimonial }>(`/testimonials/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        token,
      }),
    adminGetStats: (token: string) =>
      apiFetch<{ ok: boolean; stats: { total: number; pending: number; approved: number; rejected: number; avgRating: number } }>('/testimonials/admin/stats', { token }),
    adminBulkStatus: (ids: string[], status: 'APPROVED' | 'REJECTED', token: string) =>
      apiFetch<{ ok: boolean; affected: number }>('/testimonials/admin/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids, status }),
        token,
      }),
    editMy: (data: { content: string; rating: number }, token: string) =>
      apiFetch<{ ok: boolean; testimonial: Testimonial }>('/testimonials/my', {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    adminReply: (id: string, reply: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/testimonials/admin/${id}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({ reply }),
        token,
      }),
    adminTogglePin: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/testimonials/admin/${id}/pin`, {
        method: 'PATCH',
        token,
      }),
  },
  // ── Measurements (79.3) ──────────────────────────────────────────────────

  // ── Supplements (79.6) ──────────────────────────────────────────────────

  // ── Messages (79.1) ──────────────────────────────────────────────────────
};
