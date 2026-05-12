export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type UserRole = 'ADMIN' | 'DIETITIAN' | 'PATIENT';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// TODO(5c-cleanup): Tenant interface dropped per D-025 (bambooIT is B2B, not SaaS multi-tenant).

export interface Patient {
  id: string;
  userId: string;
  // TODO(5c-cleanup): tenantId dropped per D-025
  // tenantId: string | null;
  firstName?: string;
  lastName?: string;
  sex?: string;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  createdAt: string;
  updatedAt: string;
  dietitian?: {
    id: string;
    email: string;
    dietitianProfile?: { code: string } | null;
  } | null;
}

export type ProductType =
  | 'FREE_7'
  | 'OPIEKA_MIESIECZNA'
  | 'OPIEKA_ROCZNA'
  | 'PLAN_2W'
  | 'PLAN_4W'
  | 'CONSULTATION'
  // Legacy values (backward compatibility with existing orders)
  | 'PREMIUM'
  | 'CONSULTATION_1W'
  | 'AI_2W'
  | 'AI_4W'
  | 'SUBSCRIPTION_1M'
  | 'CONSULTATION_2W'
  | 'CONSULTATION_4W';

/** Extends ProductType with checkout-only virtual types (not stored in DB). */
export type CheckoutProductType = ProductType | 'TRIAL' | 'TRIAL_YEARLY';

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  patientId: string;
  productType: ProductType;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccessStatus {
  paywallEnabled: boolean;
  hasAccess: boolean;
  activeOrder: {
    id: string;
    productType: string;
    status: string;
    createdAt: string;
  } | null;
  planLimits: {
    maxDietsPerWeek: number;
    maxSwapsPerWeek: number;
    durationWeeks: number;
    isSubscription: boolean;
    pricePln: number;
  } | null;
  weeklyUsage: {
    dietsGenerated: number;
    swapsUsed: number;
  } | null;
}

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
export type SubscriptionPlan = 'FREE' | 'PRO_MONTHLY' | 'PRO_YEARLY';

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientInvoice {
  id: string;
  date: string;
  productType: string;
  amount: number;
  stripeInvoiceId: string | null;
}

export interface AdminStats {
  users: { total: number; active: number; deleted: number };
  dietitians: number;
  patients: number;
  interviews: number;
  dietPlans: { total: number; byStatus: { GENERATED: number; REVIEWED: number; SENT: number } };
  recipes?: { total: number; needingWork: number };
}

export interface SubscriptionStats {
  mrr: number;
  activeSubscriptions: { total: number; monthly: number; yearly: number };
  trials: { active: number; expired: number };
  oneTime: { plan2w: number; plan4w: number; consultation: number };
  churnRate: number;
}

export interface SubscriptionItem {
  id: string;
  type: 'subscription' | 'order';
  userEmail: string;
  userName: string | null;
  productType: string;
  status: string;
  amount: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
}

// TODO(5c-cleanup): AdminTenant dropped per D-025

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  grantedAccessUntil?: string | null;
  subscriptionStatus?: string;
  subscriptionProductType?: string | null;
  subscriptionExpiresAt?: string | null;
  patient?: {
    firstName?: string | null;
    lastName?: string | null;
    sex?: string | null;
    birthYear?: number | null;
    heightCm?: number | null;
    weightKg?: number | null;
  } | null;
  dietitianProfile?: { code: string } | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string } | null;
}

/** AI processing report attached to diet plan after n8n callback (32.2) */
/** 76c: Plan comparison side metrics */
// ─── Slot Decision Audit Trail (Faza 72) ────────────────────────────────────

// ─── Plan Quality & Soft Validations (Faza 74) ─────────────────────────────

// ─── Notification Preferences (19.2) ────────────────────────────────────────

export interface NotificationPreferences {
  emailReminders: boolean;
  breakfastTime: string | null;
  lunchTime: string | null;
  dinnerTime: string | null;
  snackTime: string | null;
  reminderLeadMinutes: number;
  weeklySummary: boolean;
  timezone: string;
}

// ─── Micronutrient Analysis (38.7) ──────────────────────────────────────────

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  titleEn?: string | null;
  excerpt: string;
  excerptEn?: string | null;
  content: string;
  contentEn?: string | null;
  category: string;
  author: string;
  imageSrc?: string | null;
  imageAlt?: string | null;
  imageAltEn?: string | null;
  readTime: number;
  publishedAt: string;
  published: boolean;
  scheduledAt?: string | null;
  faq?: BlogFaqItem[] | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BlogListItem = Omit<BlogPost, 'content'>;

// ── Body Measurements (79.3) ─────────────────────────────────────────────────

// ─── Dietitian Alerts (20.1) ──────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'info';
export type AlertType = 'plans_awaiting_review' | 'red_flag_plans' | 'dropout_risk' | 'rapid_weight_loss' | 'micronutrient_deficiency';

export interface DietitianAlertPatient {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  detail?: string;
}

// ─── Dietitian Notes (20.2) ───────────────────────────────────────────────────

// ─── Monthly Report (20.4) ──────────────────────────────────────────────────

export interface PatientReportSummary {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  weightChangeKg: number | null;
  avgCompliance: number | null;
  checkInsCount: number;
  planCount: number;
  latestPlanStatus: string | null;
}

// ─── Note Templates (20.3) ──────────────────────────────────────────────────

export interface BlogCategoryConfig {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TestimonialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Testimonial {
  id: string;
  userId: string;
  content: string;
  rating: number;
  status: TestimonialStatus;
  adminReply: string | null;
  adminReplyAt: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface TestimonialWithUser extends Testimonial {
  user: {
    id: string;
    email?: string;
    patient?: { firstName: string | null; lastName: string | null } | null;
  };
}

export interface PublicTestimonial extends Testimonial {
  user: {
    id: string;
    patient?: { firstName: string | null; lastName: string | null } | null;
  };
}

// ─── NutritionTargets types ──────────────────────────────────────────────────


// ─── Clinical Rules ──────────────────────────────────────────────────────────

// ─── Nutrition Protocols ──────────────────────────────────────────────────────

// ─── Protocol Trigger & Conflict (30.6) ──────────────────────────────────────

// ─── Matched protocols (30.7) ─────────────────────────────────────────────

// ─── AI Cost Log (34.2) ──────────────────────────────────────────────────────

// ─── Dietitian Onboarding ─────────────────────────────────────────────────────

// ─── Diet Toolkit ────────────────────────────────────────────────────────────

// ── Supplement Prescriptions (79.6) ──────────────────────────────────────────
