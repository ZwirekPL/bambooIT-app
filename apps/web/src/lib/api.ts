/**
 * Typed API client for the e-dietetyk.com backend (port 4000).
 * Uses NEXT_PUBLIC_API_URL (client + server) for all requests.
 * Server-only auth requests use API_URL env variable.
 */
import type { Interview, DietPlan, Patient, PatientWithLatestPlan, PatientDetail, DietitianStats, DietitianAlert, DietitianNote, Order, ProductType, CheckoutProductType, InterviewSummary, DietPlanSummary, Subscription, AdminStats, DietCacheStats, UserRole, User, AdminUser, AdminDietitian, DietitianPatient, AdminTenant, AuditLog, BlogPost, BlogListItem, BlogCategoryConfig, DietPlanRevision, DietPlanRevisionDetail, AccessStatus, CheckIn, CheckInTrends, ProgressData, Testimonial, TestimonialWithUser, PublicTestimonial, NotificationPreferences, NoteTemplate, MonthlyReport, ClinicalRule, ClinicalRuleHistory, ClinicalRuleType, RuleSeverity, NutritionProtocol, NutritionProtocolCreateData, DietitianProtocolWithAccess, ProtocolAssignedDietitian, ProtocolTrigger, ProtocolTriggerCreateData, ProtocolConflict, ProtocolConflictCreateData, MatchedProtocolsResponse, OnboardingStatus, AiCostsListResponse, AiCostPlanDetailResponse, MicronutrientReport, SubscriptionStats, SubscriptionItem, PatientInvoice, NutritionTargets, DietToolkitData, DietitianOnboardingStatus, SlotDecision, PlanQualityData, PlanComparisonSide, BodyMeasurement, MeasurementTrends, SupplementPrescription, SupplementCompliance, SupplementFrequency } from '@/types/api';
import { getApiBaseUrl } from './api-url';

/** Tracks whether a 401 auto-logout is already in progress to prevent multiple redirects */
let logoutInProgress = false;

export class ApiError extends Error {
  public fields?: Array<{ field: string; code: string; minimum?: number }>;

  constructor(
    public status: number,
    message: string,
    fields?: Array<{ field: string; code: string; minimum?: number }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields;
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
      import('./logout').then(({ performFullLogout }) => {
        performFullLogout(loginPath);
      }).catch(() => {
        // Fallback: hard redirect
        window.location.href = loginPath;
      });
    }

    throw new ApiError(res.status, message, fields);
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
      firstName?: string;
      lastName?: string;
      dietitianCode?: string;
      referralCode?: string;
      consents: {
        healthDataProcessing: boolean;
        aiDisclaimer: boolean;
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
  interviews: {
    create: (
      data: {
        answers: Record<string, unknown>;
        medicalFlags?: Record<string, unknown>;
      },
      token: string
    ) =>
      apiFetch<{ ok: boolean; patientId: string; interviewId: string; blocked?: boolean }>('/interviews', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    getLatest: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; interview: Interview }>(`/interviews/latest/${patientId}`, { token }),
    listByPatient: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; interviews: InterviewSummary[] }>(`/interviews/patient/${patientId}`, { token }),
    diff: (id1: string, id2: string, token: string) =>
      apiFetch<{ ok: boolean; fields: Array<{ field: string; old: unknown; new: unknown }>; interviewOldId: string; interviewNewId: string }>(
        `/interviews/diff/${id1}/${id2}`, { token }
      ),
    requestUpdate: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/interviews/request-update/${patientId}`, { method: 'POST', token }),
    preCheck: (answers: Record<string, unknown>) =>
      apiFetch<{
        ok: boolean;
        matchedProtocols: Array<{
          protocolId: string;
          protocolName: string;
          interviewField: string;
          interviewValue: string;
          priority: number;
        }>;
        conflicts: Array<{
          conflictId: string;
          description: string;
          severity: 'BLOCK' | 'WARN';
          messageKey: string;
          winnerSide: string;
          triggerA: { field: string; value: string };
          triggerB: { field: string; value: string };
          safeOption: { label: string; action: string };
          consultOption: { label: string; price: number; action: string };
          cancelOption: { label: string; action: string; email: string };
        }>;
        hasBlockingConflict: boolean;
      }>('/interviews/pre-check', {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
  },
  orders: {
    createMy: (
      data: { productType: CheckoutProductType },
      token: string
    ) =>
      apiFetch<{ ok: boolean; order: Order; patientId: string }>('/orders/my', {
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
    setConsultationPhone: (orderId: string, phone: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/orders/${orderId}/consultation-phone`, {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
        token,
      }),
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
      apiFetch<{ ok: boolean; invoices: PatientInvoice[] }>('/orders/my/invoices', { token }),
    canWithdraw: (token: string) =>
      apiFetch<{ ok: boolean; eligible: boolean; orderId?: string; daysLeft?: number }>('/orders/my/can-withdraw', { token }),
    withdraw: (token: string) =>
      apiFetch<{ ok: boolean; orderId: string; productType: string }>('/orders/my/withdraw', {
        method: 'POST',
        token,
      }),
  },
  dietPlans: {
    getLatest: (patientId: string, token?: string) =>
      apiFetch<{ ok: boolean; dietPlan: DietPlan }>(`/diet-plans/latest/${patientId}`, { token }),
    getToday: (token: string) =>
      apiFetch<{ ok: boolean; today: { dayName: string; meals: Array<Record<string, unknown>> } | null }>('/diet-plans/today', { token }),
    listByPatient: (patientId: string, token: string) => {
      const query = new URLSearchParams({ patientId, limit: '50' });
      return apiFetch<{ ok: boolean; dietPlans: DietPlanSummary[]; total: number; page: number; limit: number }>(
        `/diet-plans?${query.toString()}`,
        { token }
      );
    },
    getById: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; plan: DietPlan }>(`/diet-plans/${planId}`, { token }),
    /** Lightweight status check (no content decryption) */
    getStatus: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; id: string; status: string; phase: string; elapsedMs: number }>(`/diet-plans/${planId}/status`, { token }),
    updateContent: (
      planId: string,
      data: { kcal?: number; proteinG?: number; fatG?: number; carbsG?: number; content: Record<string, unknown> },
      token: string
    ) =>
      apiFetch<{ ok: boolean; plan: DietPlan }>(`/diet-plans/${planId}/content`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    updateStatus: (planId: string, status: 'REVIEWED' | 'SENT', token: string) =>
      apiFetch<{ ok: boolean; plan: DietPlan }>(`/diet-plans/${planId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        token,
      }),
    createManual: (
      patientId: string,
      data: { kcal?: number; proteinG?: number; fatG?: number; carbsG?: number; content: Record<string, unknown> },
      token: string
    ) =>
      apiFetch<{ ok: boolean; plan: DietPlan }>(`/diet-plans/${patientId}/manual`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    getRevisions: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; revisions: DietPlanRevision[] }>(`/diet-plans/${planId}/revisions`, { token }),
    getPlanQuality: (planId: string, token: string) =>
      apiFetch<{
        ok: boolean;
        planQuality: PlanQualityData | null;
      }>(`/diet-plans/${planId}/quality`, { token }),
    getSlotDecisions: (planId: string, token: string) =>
      apiFetch<{
        ok: boolean;
        slotDecisions: SlotDecision[];
        inputHash: string | null;
        generationMethod: string | null;
        coverageReport: Record<string, unknown> | null;
      }>(`/diet-plans/${planId}/decisions`, { token }),
    giReport: (planId: string, token: string) =>
      apiFetch<{
        ok: boolean;
        giReport: {
          weekAvgGi: number | null;
          weekAvgGL: number;
          totalHighGiMeals: number;
          daily: Array<{ day: number; avgGi: number | null; dailyGL: number; highGiCount: number }>;
        } | null;
      }>(`/diet-plans/${planId}/gi-report`, { token }),
    getRevision: (revisionId: string, token: string) =>
      apiFetch<{ ok: boolean; revision: DietPlanRevisionDetail }>(`/diet-plans/revisions/${revisionId}`, { token }),
    exportPdf: (planId: string, _token?: string): Promise<Blob> =>
      // Routed through Next.js proxy — token injected server-side from JWT
      fetch(`/api/proxy/diet-plans/${planId}/export`).then(res => {
        if (!res.ok) throw new ApiError(res.status, `/diet-plans/${planId}/export`);
        return res.blob();
      }),
    requestSwap: (planId: string, dayIndex: number, mealIndex: number, token: string) =>
      apiFetch<{ ok: boolean; swap: import('@/types/api').MealSwap }>(`/diet-plans/${planId}/swap`, {
        method: 'POST',
        body: JSON.stringify({ dayIndex, mealIndex }),
        token,
      }),
    confirmSwap: (planId: string, swapId: string, chosenIndex: number, token: string) =>
      apiFetch<{ ok: boolean; swap: import('@/types/api').MealSwap }>(`/diet-plans/${planId}/swap/${swapId}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({ chosenIndex }),
        token,
      }),
    listSwaps: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; swaps: import('@/types/api').MealSwap[] }>(`/diet-plans/${planId}/swaps`, { token }),
    // TODO(5a.5-cleanup): ShoppingList* types + ShoppingListCheck model removed in K5a — fetch methods dropped.
    exportCalendar: (planId: string, _token?: string, startDate?: string): Promise<Blob> =>
      fetch(`/api/proxy/diet-plans/${planId}/calendar${startDate ? `?startDate=${startDate}` : ''}`).then(res => {
        if (!res.ok) throw new ApiError(res.status, `/diet-plans/${planId}/calendar`);
        return res.blob();
      }),
    /** Cost estimate */
    getCostEstimate: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; estimate: { weeklyTotalPln: number; dailyAveragePln: number; confidencePct: number; breakdown: Array<{ ingredientName: string; totalGrams: number; pricePer100g: number | null; estimatedCostPln: number; source: string }>; categoryBreakdown: Array<{ category: string; totalPln: number; pct: number }> } }>(
        `/diet-plans/${planId}/cost-estimate`, { token }
      ),
    /** Meal prep planner */
    getMealPrep: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; mealPrep: { batchRecipes: Array<{ recipeId: string | null; title: string; servingsNeeded: number; totalPrepTimeMin: number; storageInfo: string; daysUsed: string[] }>; totalPrepTimeMin: number; shoppingList: Array<{ name: string; totalGrams: number; unit: string }>; prepOrder: string[]; freshDaily: string[] } }>(
        `/diet-plans/${planId}/meal-prep`, { token }
      ),
    /** 38.11: Micronutrient analysis */
    getMicronutrients: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; report: MicronutrientReport; medicationInteractions?: Array<{ medication: string; nutrientKey: string; effect: string; description: string }> }>(
        `/diet-plans/${planId}/micronutrients`, { token }
      ),
    getMicronutrientSuggestions: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; suggestions: Array<{ nutrient: string; label: string; products: Array<{ name: string; valuePer100g: number; unit: string }> }> }>(
        `/diet-plans/${planId}/micronutrients/suggestions`, { token }
      ),
    /** 76c: Plan comparison */
    comparePlans: (planAId: string, planBId: string, token: string) =>
      apiFetch<{
        ok: boolean;
        planA: PlanComparisonSide;
        planB: PlanComparisonSide;
        diff: {
          kcalDiff: number;
          proteinDiff: number;
          fatDiff: number;
          carbsDiff: number;
          diversityDiff: number;
          commonRecipes: number;
          onlyInA: number;
          onlyInB: number;
          recipeOverlap: string[];
          uniqueToA: string[];
          uniqueToB: string[];
        };
      }>(`/diet-plans/compare?planA=${planAId}&planB=${planBId}`, { token }),
    /** 76b: Proactive swap suggestions for weak slots */
    getSwapSuggestions: (planId: string, token: string) =>
      apiFetch<{
        ok: boolean;
        totalSlots: number;
        weakSlots: number;
        suggestions: Array<{
          dayIndex: number;
          slotIndex: number;
          dayName: string;
          mealType: string;
          currentRecipe: { recipeId: string; title: string; adjustedScore: number };
          confidence: string;
          reasons: string[];
          alternatives: Array<{
            recipeId: string;
            title: string;
            adjustedScore: number;
            rejectionReason: string;
            scoreDiff: number;
          }>;
        }>;
        softWarnings: string[];
      }>(`/diet-plans/${planId}/swap-suggestions`, { token }),
    /** 79: One-click slot repair via solver */
    repairSlot: (planId: string, data: { dayIndex: number; slotIndex: number; targetRecipeId?: string }, token: string) =>
      apiFetch<{
        ok: boolean;
        dayIndex: number;
        slotIndex: number;
        previousRecipe: { recipeId: string; title: string; score: number } | null;
        newRecipe: { recipeId: string; title: string; score: number };
        solverStatus?: string;
        durationMs: number;
      }>(`/diet-plans/${planId}/repair-slot`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    /** 32.2.5: Regenerate entire plan via AI pipeline */
    triggerGenerate: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; dietPlanId: string; source: string; validationStatus: string; n8nTriggered: boolean; aiTriggered: boolean; generationMethod?: 'database' | 'ai' | 'database_ai_hybrid'; coveragePct?: number }>(`/diet-plans/generate/${patientId}`, {
        method: 'POST',
        token,
      }),
    /** 32.2.6: Auto-adjust calories to match target */
    autoAdjust: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; validationStatus: string }>(`/diet-plans/${planId}/auto-adjust`, {
        method: 'POST',
        token,
      }),
    /** 32.2.7: Partial regeneration of specific days/meals */
    regeneratePartial: (planId: string, targets: { days?: string[]; meals?: Array<{ day: string; meal: string }> }, token: string) =>
      apiFetch<{ ok: boolean; triggered: boolean; message: string }>(`/diet-plans/${planId}/regenerate-partial`, {
        method: 'POST',
        body: JSON.stringify(targets),
        token,
      }),
    /** Patient day regeneration */
    regenDay: (planId: string, body: { dayName: string; reason: 'DONT_LIKE' | 'TOO_COMPLEX' | 'NO_INGREDIENTS'; keepSimilar: boolean }, token: string) =>
      apiFetch<{ ok: boolean; triggered: boolean; message: string; regenId?: string; remaining?: number }>(`/diet-plans/${planId}/regen-day`, {
        method: 'POST',
        body: JSON.stringify(body),
        token,
      }),
    regenDayUndo: (planId: string, regenId: string, token: string) =>
      apiFetch<{ ok: boolean; success: boolean; message: string }>(`/diet-plans/${planId}/regen-day/undo`, {
        method: 'POST',
        body: JSON.stringify({ regenId }),
        token,
      }),
    regenDayStatus: (planId: string, token: string) =>
      apiFetch<{ ok: boolean; remaining: number; regens: Array<{ id: string; dayName: string; reason: string; status: string }>; inProgress: boolean }>(`/diet-plans/${planId}/regen-day/status`, {
        token,
      }),
  },
  patients: {
    list: (
      params: { page?: number; limit?: number; search?: string; planStatus?: string; scope?: 'mine' | 'unassigned'; sortBy?: string; sortOrder?: string; interviewFilter?: string },
      token: string
    ) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.planStatus) query.set('planStatus', params.planStatus);
      if (params.scope) query.set('scope', params.scope);
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.interviewFilter) query.set('interviewFilter', params.interviewFilter);
      return apiFetch<{ ok: boolean; patients: PatientWithLatestPlan[]; total: number; page: number; limit: number }>(
        `/patients?${query.toString()}`,
        { token }
      );
    },
    getById: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; patient: PatientDetail }>(`/patients/${patientId}`, { token }),
    assignToMe: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/patients/${patientId}/assign`, { method: 'PATCH', token }),
    update: (
      patientId: string,
      data: Partial<Pick<Patient, 'firstName' | 'lastName' | 'sex' | 'birthYear' | 'heightCm' | 'weightKg'>>,
      token: string
    ) =>
      apiFetch<{ ok: boolean; patient: PatientDetail }>(`/patients/${patientId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    stats: (token: string) =>
      apiFetch<{ ok: boolean } & DietitianStats>('/patients/stats', { token }),
    alerts: (token: string) =>
      apiFetch<{ ok: boolean; alerts: DietitianAlert[] }>('/patients/alerts', { token }),
  },
  notes: {
    list: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; notes: DietitianNote[] }>(`/notes/${patientId}`, { token }),
    create: (patientId: string, data: { content: string; dietPlanId?: string }, token: string) =>
      apiFetch<{ ok: boolean; note: DietitianNote }>(`/notes/${patientId}`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    listMy: (token: string) =>
      apiFetch<{ ok: boolean; notes: DietitianNote[] }>('/profile/notes', { token }),
  },
  noteTemplates: {
    list: (token: string) =>
      apiFetch<{ ok: boolean; templates: NoteTemplate[] }>('/note-templates', { token }),
    create: (data: { title: string; content: string; category?: string }, token: string) =>
      apiFetch<{ ok: boolean; template: NoteTemplate }>('/note-templates', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    update: (id: string, data: { title?: string; content?: string; category?: string | null }, token: string) =>
      apiFetch<{ ok: boolean; template: NoteTemplate }>(`/note-templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/note-templates/${id}`, {
        method: 'DELETE',
        token,
      }),
  },
  report: {
    get: (month: string, token: string) =>
      apiFetch<{ ok: boolean; report: MonthlyReport }>(`/dietitian/report?month=${month}`, { token }),
    exportPdfUrl: (month: string) =>
      `/api/proxy/dietitian/report/export?month=${month}`,
  },
  profile: {
    get: (token: string) =>
      apiFetch<{ ok: boolean; patient: Patient }>('/profile', { token }),
    update: (
      data: Partial<Pick<Patient, 'firstName' | 'lastName' | 'sex' | 'birthYear' | 'heightCm' | 'weightKg'>> & { dietitianCode?: string; unlinkDietitian?: boolean },
      token: string
    ) =>
      apiFetch<{ ok: boolean; patient: Patient }>('/profile', {
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
    getDietitian: (token: string) =>
      apiFetch<{ ok: boolean; profile: { code: string; firstName: string | null; lastName: string | null; email: string } }>('/profile/dietitian', { token }),
    updateDietitian: (
      data: { firstName?: string; lastName?: string },
      token: string
    ) =>
      apiFetch<{ ok: boolean; profile: { code: string; firstName: string | null; lastName: string | null; email: string } }>('/profile/dietitian', {
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
      data: { productType: CheckoutProductType; referralCode?: string },
      token: string
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
    createCheckout: (plan: 'PRO_MONTHLY' | 'PRO_YEARLY', token: string) =>
      apiFetch<{ ok: boolean; url: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
        token,
      }),
    getPortal: (token: string) =>
      apiFetch<{ ok: boolean; url: string }>('/subscriptions/portal', { token }),
  },
  admin: {
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
    getDietCacheStats: (token: string) =>
      apiFetch<DietCacheStats>('/admin/diet-cache/stats', { token }),
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
    createUser: (data: { email: string; password?: string; firstName?: string; lastName?: string; dietitianCode?: string }, token: string) =>
      apiFetch<{ ok: boolean; userId: string; email: string; role: string; firstName: string | null; lastName: string | null }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    listDietitians: (params: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string; hideDeleted?: boolean }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      if (params.hideDeleted) query.set('hideDeleted', 'true');
      return apiFetch<{ ok: boolean; dietitians: AdminDietitian[]; total: number; page: number; limit: number }>(
        `/admin/dietitians?${query.toString()}`,
        { token }
      );
    },
    toggleDietitianActive: (userId: string, token: string) =>
      apiFetch<{ ok: boolean; active: boolean; patientsAffected: number }>(`/admin/dietitians/${userId}/toggle-active`, {
        method: 'PATCH',
        token,
      }),
    createDietitian: (data: { email: string; password?: string; firstName?: string; lastName?: string }, token: string) =>
      apiFetch<{ ok: boolean; dietitianUserId: string; email: string; code: string; firstName: string | null; lastName: string | null }>('/admin/dietitians', {
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
    rotateDietitianCode: (userId: string, token: string) =>
      apiFetch<{ ok: boolean; userId: string; oldCode: string; newCode: string }>(`/admin/dietitians/${userId}/rotate-code`, {
        method: 'POST',
        token,
      }),
    getDietitianPatients: (userId: string, token: string) =>
      apiFetch<{ ok: boolean; patients: DietitianPatient[]; total: number }>(`/admin/dietitians/${userId}/patients`, { token }),
    updateDietitian: (userId: string, data: { firstName?: string; lastName?: string; email?: string }, token: string) =>
      apiFetch<{ ok: boolean; dietitian: AdminDietitian }>(`/admin/dietitians/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
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
    grantAccess: (userId: string, grantedAccessUntil: string | null, token: string) =>
      apiFetch<{ ok: boolean; user: { id: string; email: string; grantedAccessUntil: string | null } }>(`/admin/users/${userId}/grant-access`, {
        method: 'PATCH',
        body: JSON.stringify({ grantedAccessUntil }),
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
    listTenants: (params: { page?: number; limit?: number; search?: string }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      return apiFetch<{ ok: boolean; tenants: AdminTenant[]; total: number; page: number; limit: number }>(
        `/admin/tenants?${query.toString()}`,
        { token }
      );
    },
    getTenantById: (id: string, token: string) =>
      apiFetch<{ ok: boolean; tenant: AdminTenant }>(`/admin/tenants/${id}`, { token }),
    updateTenant: (id: string, data: { name?: string; slug?: string }, token: string) =>
      apiFetch<{ ok: boolean; tenant: AdminTenant }>(`/admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    deleteTenant: (id: string, token: string) =>
      apiFetch<{ ok: boolean; tenant: { id: string; slug: string; name: string; deletedAt: string } }>(`/admin/tenants/${id}`, {
        method: 'DELETE',
        token,
      }),
    restoreTenant: (id: string, token: string) =>
      apiFetch<{ ok: boolean; tenant: { id: string; slug: string; name: string; deletedAt: null } }>(`/admin/tenants/${id}/restore`, {
        method: 'PATCH',
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
  adminAiCosts: {
    list: (params: { page?: number; limit?: number; dateFrom?: string; dateTo?: string; model?: string }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      if (params.model) query.set('model', params.model);
      return apiFetch<AiCostsListResponse>(
        `/admin/ai-costs?${query.toString()}`,
        { token }
      );
    },
    getForPlan: (dietPlanId: string, token: string) =>
      apiFetch<AiCostPlanDetailResponse>(`/admin/ai-costs/${dietPlanId}`, { token }),
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
  dietitian: {
    getActionItems: (token: string) =>
      apiFetch<{ ok: boolean; actionItems: { plansAwaitingReview: number; patientsWithoutPlan: number; redFlagPlans: number } }>('/dietitian/dashboard/action-items', { token }),
    getNutritionTargets: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; targets: NutritionTargets }>(`/dietitian/patients/${patientId}/nutrition-targets`, { token }),
    getGreyListWindow: (token: string) =>
      apiFetch<{ ok: boolean; override: number | null; effective: number; default: number; min: number; max: number }>(
        '/dietitian/grey-list-window',
        { token },
      ),
    setGreyListWindow: (greyListWindow: number, token: string) =>
      apiFetch<{ ok: boolean; override: number; effective: number; default: number; min: number; max: number }>(
        '/dietitian/grey-list-window',
        { method: 'PATCH', body: JSON.stringify({ greyListWindow }), token },
      ),
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
  adminConsultations: {
    list: (params: { page?: number; limit?: number; status?: string }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.status) query.set('status', params.status);
      return apiFetch<{
        ok: boolean;
        consultations: Array<{
          id: string;
          createdAt: string;
          status: string;
          consultationPhone: string | null;
          patientFirstName: string | null;
          patientLastName: string | null;
          patientEmail: string;
        }>;
        total: number;
        page: number;
        limit: number;
      }>(`/admin/consultations?${query.toString()}`, { token });
    },
    updateStatus: (id: string, status: 'COMPLETED' | 'CANCELLED', token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/consultations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        token,
      }),
  },
  access: {
    status: (token: string) =>
      apiFetch<{ ok: boolean } & AccessStatus>('/access/status', { token }),
  },
  checkIns: {
    create: (
      data: {
        weightKg?: number;
        compliance?: number;
        hunger?: number;
        energy?: number;
        sleep?: number;
        activity?: number;
        notes?: string;
        // 79.2: GI fields
        digestion?: number;
        bloating?: boolean;
        stoolBristol?: number;
      },
      token: string
    ) =>
      apiFetch<{ ok: boolean; checkIn: CheckIn }>('/check-ins', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    list: (params: { page?: number; limit?: number }, token: string) => {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      return apiFetch<{ ok: boolean; checkIns: CheckIn[]; total: number; page: number; limit: number }>(
        `/check-ins?${query.toString()}`,
        { token }
      );
    },
    latest: (token: string) =>
      apiFetch<{ ok: boolean; checkIn: CheckIn | null }>('/check-ins/latest', { token }),
    trends: (token: string) =>
      apiFetch<{ ok: boolean } & CheckInTrends>('/check-ins/trends', { token }),
    progress: (token: string) =>
      apiFetch<{ ok: boolean } & ProgressData>('/check-ins/progress', { token }),
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
  referrals: {
    getMy: (token: string) =>
      apiFetch<{
        ok: boolean;
        referral: {
          id: string;
          code: string;
          discountPercent: number;
          usageCount: number;
          createdAt: string;
        };
      }>('/referrals/my', { token }),
    getAdminStats: (token: string) =>
      apiFetch<{
        ok: boolean;
        stats: {
          totalCodes: number;
          totalUsages: number;
          totalRedeemed: number;
          conversionRate: number;
          topReferrers: Array<{
            userId: string;
            email: string;
            code: string;
            usageCount: number;
          }>;
        };
      }>('/referrals/admin/stats', { token }),
  },

  protocols: {
    list: (token: string, scope?: 'GLOBAL' | 'DIETITIAN') => {
      const qs = scope ? `?scope=${scope}` : '';
      return apiFetch<{ ok: boolean; protocols: NutritionProtocol[] }>(`/admin/protocols${qs}`, { token });
    },
    getById: (id: string, token: string) =>
      apiFetch<{ ok: boolean; protocol: NutritionProtocol }>(`/admin/protocols/${id}`, { token }),
    create: (data: NutritionProtocolCreateData, token: string) =>
      apiFetch<{ ok: boolean; protocol: NutritionProtocol }>('/admin/protocols', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),
    update: (id: string, data: Partial<NutritionProtocolCreateData> & { isActive?: boolean; isDefault?: boolean }, token: string) =>
      apiFetch<{ ok: boolean; protocol: NutritionProtocol }>(`/admin/protocols/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),
    toggle: (id: string, isActive: boolean, token: string) =>
      apiFetch<{ ok: boolean; protocol: NutritionProtocol }>(`/admin/protocols/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
        token,
      }),
    listAssigned: (id: string, token: string) =>
      apiFetch<{ ok: boolean; assigned: ProtocolAssignedDietitian[] }>(`/admin/protocols/${id}/dietitians`, { token }),
    assign: (id: string, dietitianId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/protocols/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ dietitianId }),
        token,
      }),
    unassign: (id: string, dietitianId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/protocols/${id}/assign/${dietitianId}`, {
        method: 'DELETE',
        token,
      }),
  },
  dietitianProtocol: {
    listMy: (token: string) =>
      apiFetch<{ ok: boolean; protocols: DietitianProtocolWithAccess[] }>('/dietitian/protocol', { token }),
    setActive: (protocolId: string, token: string) =>
      apiFetch<{ ok: boolean }>('/dietitian/protocol/active', {
        method: 'PATCH',
        body: JSON.stringify({ protocolId }),
        token,
      }),
    matchedProtocols: (patientId: string, token: string) =>
      apiFetch<MatchedProtocolsResponse>(`/interviews/matched-protocols/${patientId}`, { token }),
  },
  protocolTriggers: {
    list: (params: { field?: string; protocolId?: string; priority?: number; active?: boolean }, token: string) => {
      const qs = new URLSearchParams();
      if (params.field) qs.set('field', params.field);
      if (params.protocolId) qs.set('protocolId', params.protocolId);
      if (params.priority !== undefined) qs.set('priority', String(params.priority));
      if (params.active !== undefined) qs.set('active', String(params.active));
      const q = qs.toString();
      return apiFetch<{ ok: boolean; triggers: ProtocolTrigger[] }>(`/admin/protocol-triggers${q ? `?${q}` : ''}`, { token });
    },
    create: (data: ProtocolTriggerCreateData, token: string) =>
      apiFetch<{ ok: boolean; trigger: ProtocolTrigger }>('/admin/protocol-triggers', { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, data: Partial<ProtocolTriggerCreateData>, token: string) =>
      apiFetch<{ ok: boolean; trigger: ProtocolTrigger }>(`/admin/protocol-triggers/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    toggle: (id: string, isActive: boolean, token: string) =>
      apiFetch<{ ok: boolean; trigger: ProtocolTrigger }>(`/admin/protocol-triggers/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/protocol-triggers/${id}`, { method: 'DELETE', token }),
  },
  protocolConflicts: {
    list: (params: { severity?: 'BLOCK' | 'WARN'; active?: boolean }, token: string) => {
      const qs = new URLSearchParams();
      if (params.severity) qs.set('severity', params.severity);
      if (params.active !== undefined) qs.set('active', String(params.active));
      const q = qs.toString();
      return apiFetch<{ ok: boolean; conflicts: ProtocolConflict[] }>(`/admin/protocol-conflicts${q ? `?${q}` : ''}`, { token });
    },
    create: (data: ProtocolConflictCreateData, token: string) =>
      apiFetch<{ ok: boolean; conflict: ProtocolConflict }>('/admin/protocol-conflicts', { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, data: Partial<ProtocolConflictCreateData>, token: string) =>
      apiFetch<{ ok: boolean; conflict: ProtocolConflict }>(`/admin/protocol-conflicts/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    toggle: (id: string, isActive: boolean, token: string) =>
      apiFetch<{ ok: boolean; conflict: ProtocolConflict }>(`/admin/protocol-conflicts/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/protocol-conflicts/${id}`, { method: 'DELETE', token }),
  },
  onboarding: {
    getStatus: (token: string) =>
      apiFetch<OnboardingStatus>('/onboarding/status', { token }),
    getDietitianStatus: (token: string) =>
      apiFetch<DietitianOnboardingStatus>('/onboarding/dietitian-status', { token }),
  },
  clinicalRules: {
    list: (params: { type?: ClinicalRuleType; severity?: RuleSeverity; isActive?: boolean; category?: string; search?: string; page?: number; limit?: number }, token: string) => {
      const qs = new URLSearchParams();
      if (params.type) qs.set('type', params.type);
      if (params.severity) qs.set('severity', params.severity);
      if (params.isActive !== undefined) qs.set('isActive', String(params.isActive));
      if (params.category) qs.set('category', params.category);
      if (params.search) qs.set('search', params.search);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      return apiFetch<{ rules: ClinicalRule[]; total: number; page: number; limit: number }>(`/admin/clinical-rules?${qs}`, { token });
    },
    getById: (id: string, token: string) =>
      apiFetch<ClinicalRule>(`/admin/clinical-rules/${id}`, { token }),
    create: (data: Record<string, unknown>, token: string) =>
      apiFetch<ClinicalRule>('/admin/clinical-rules', { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, data: Record<string, unknown>, token: string) =>
      apiFetch<ClinicalRule>(`/admin/clinical-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data), token }),
    toggleActive: (id: string, isActive: boolean, token: string) =>
      apiFetch<ClinicalRule>(`/admin/clinical-rules/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ isActive }), token }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/admin/clinical-rules/${id}`, { method: 'DELETE', token }),
    getHistory: (id: string, token: string) =>
      apiFetch<ClinicalRuleHistory[]>(`/admin/clinical-rules/${id}/history`, { token }),
  },
  dietToolkit: {
    get: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; toolkit: DietToolkitData }>(
        `/dietitian/patients/${patientId}/diet-toolkit`,
        { token }
      ),
  },

  // ── Measurements (79.3) ──────────────────────────────────────────────────
  measurements: {
    create: (body: Omit<BodyMeasurement, 'id' | 'patientId'>, token: string) =>
      apiFetch<{ ok: boolean; measurement: BodyMeasurement }>('/measurements', { method: 'POST', body: JSON.stringify(body), token }),
    list: (token: string, page = 1) =>
      apiFetch<{ ok: boolean; items: BodyMeasurement[]; total: number }>(`/measurements?page=${page}`, { token }),
    trends: (token: string) =>
      apiFetch<{ ok: boolean } & MeasurementTrends>('/measurements/trends', { token }),
    remove: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/measurements/${id}`, { method: 'DELETE', token }),
    // Dietitian: view patient measurements
    listByPatient: (patientId: string, token: string, page = 1) =>
      apiFetch<{ ok: boolean; items: BodyMeasurement[]; total: number }>(`/measurements/patient/${patientId}?page=${page}`, { token }),
    trendsByPatient: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean } & MeasurementTrends>(`/measurements/patient/${patientId}/trends`, { token }),
  },

  // ── Supplements (79.6) ──────────────────────────────────────────────────
  supplements: {
    // Patient
    list: (token: string) =>
      apiFetch<{ ok: boolean; supplements: SupplementPrescription[] }>('/supplements', { token }),
    compliance: (token: string) =>
      apiFetch<{ ok: boolean; compliance: SupplementCompliance[] }>('/supplements/compliance', { token }),
    // Dietitian
    listByPatient: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; supplements: SupplementPrescription[] }>(`/supplements/patient/${patientId}`, { token }),
    complianceByPatient: (patientId: string, token: string) =>
      apiFetch<{ ok: boolean; compliance: SupplementCompliance[] }>(`/supplements/patient/${patientId}/compliance`, { token }),
    create: (patientId: string, data: { nutrientKey: string; label: string; dose: string; unit: string; frequency: SupplementFrequency; notes?: string }, token: string) =>
      apiFetch<{ ok: boolean; supplement: SupplementPrescription }>(`/supplements/patient/${patientId}`, { method: 'POST', body: JSON.stringify(data), token }),
    update: (id: string, patientId: string, data: Partial<{ label: string; dose: string; unit: string; frequency: SupplementFrequency; active: boolean; notes: string }>, token: string) =>
      apiFetch<{ ok: boolean; supplement: SupplementPrescription }>(`/supplements/${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, patientId }), token }),
  },

  // ── Messages (79.1) ──────────────────────────────────────────────────────
  messages: {
    listConversations: (token: string) =>
      apiFetch<{ ok: boolean; conversations: Array<{
        id: string; patientId: string; dietitianId: string;
        lastMessageAt: string | null; unreadCount: number; otherName: string;
        lastMessage: { preview: string; senderRole: string; createdAt: string } | null;
      }> }>('/messages/conversations', { token }),

    getUnreadCount: (token: string) =>
      apiFetch<{ ok: boolean; unreadCount: number }>('/messages/unread-count', { token }),

    listMessages: (conversationId: string, token: string, page = 1) =>
      apiFetch<{ ok: boolean; messages: Array<{
        id: string; senderId: string; senderRole: string;
        content: string; readAt: string | null; createdAt: string;
      }>; total: number; page: number; limit: number }>(
        `/messages/${conversationId}?page=${page}`, { token }
      ),

    send: (body: { conversationId?: string; patientId?: string; dietitianId?: string; content: string }, token: string) =>
      apiFetch<{ ok: boolean; message: {
        id: string; conversationId: string; senderId: string;
        senderRole: string; content: string; createdAt: string;
      } }>('/messages', { method: 'POST', body: JSON.stringify(body), token }),

    markAsRead: (conversationId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/messages/${conversationId}/read`, { method: 'PATCH', token }),

    findOrCreateConversation: (params: { patientId?: string; dietitianId?: string }, token: string) => {
      const qs = new URLSearchParams();
      if (params.patientId) qs.set('patientId', params.patientId);
      if (params.dietitianId) qs.set('dietitianId', params.dietitianId);
      return apiFetch<{ ok: boolean; conversationId: string; patientId: string; dietitianId: string }>(
        `/messages/find-or-create?${qs.toString()}`, { token },
      );
    },
  },
};
