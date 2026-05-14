export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type UserRole = 'ADMIN' | 'CLIENT';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  userId: string;
  contactFirstName?: string;
  contactLastName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductType = 'START' | 'FIRMA' | 'FIRMA_PLUS';

/** Extends ProductType with checkout-only virtual types (not stored in DB). */
export type CheckoutProductType = ProductType | 'TRIAL';

// ─── Leads (BE-1 model + BE-4 admin UI) ──────────────────────────────────────

export type LeadType = 'AUDIT' | 'CONTACT';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'REJECTED';
export type LeadIndustry =
  | 'accounting'
  | 'law'
  | 'medical'
  | 'production'
  | 'hospitality'
  | 'other';

export interface LeadNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  type: LeadType;
  status: LeadStatus;
  firstName: string;
  lastName: string | null;
  company: string | null;
  nip: string | null;
  email: string;
  phone: string | null;
  industry: LeadIndustry | string | null;
  sizeRange: string | null;
  employeesCount: number | null;
  description: string;
  source: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  notes: LeadNote[] | null;
  rodoConsent: boolean;
  rodoConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadsStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  byType: Record<LeadType, number>;
  last7Days: number;
}

export interface LeadsListResponse {
  ok: boolean;
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  companyId: string;
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
export type SubscriptionPlan = 'START' | 'FIRMA' | 'FIRMA_PLUS';

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

export interface CompanyInvoice {
  id: string;
  date: string;
  productType: string;
  amount: number;
  stripeInvoiceId: string | null;
}

export interface AdminStats {
  users: { total: number; active: number; deleted: number };
  clients: number;
}

export interface SubscriptionStats {
  mrr: number;
  activeSubscriptions: { total: number; start: number; firma: number; firmaPlus: number };
  trials: { active: number; expired: number };
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
  company?: {
    contactFirstName?: string | null;
    contactLastName?: string | null;
  } | null;
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
    company?: { contactFirstName: string | null; contactLastName: string | null } | null;
  };
}

export interface PublicTestimonial extends Testimonial {
  user: {
    id: string;
    company?: { contactFirstName: string | null; contactLastName: string | null } | null;
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
