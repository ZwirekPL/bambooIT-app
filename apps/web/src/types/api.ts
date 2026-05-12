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

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  userId: string;
  tenantId: string | null;
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

export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  ownerId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; email: string; role: UserRole } | null;
  _count: { patients: number };
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

export interface MonthlyReport {
  month: string;
  dietitianId: string;
  patients: {
    total: number;
    newThisMonth: number;
  };
  plans: {
    generated: number;
    reviewed: number;
    published: number;
    manualReviewRequired: number;
  };
  compliance: {
    averagePercent: number | null;
    checkInsCount: number;
    patientsWithCheckIns: number;
  };
  goalProgress: {
    patientsWithGoal: number;
    patientsReachedGoal: number;
  };
  patientSummaries: PatientReportSummary[];
}

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

export type ClinicalRuleType = 'POLICY' | 'RED_FLAG';
export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export interface ClinicalRuleSource {
  ref: string;
  url?: string;
  year?: number;
}

export interface ClinicalRule {
  id: string;
  name: string;
  description: string;
  type: ClinicalRuleType;
  severity: RuleSeverity;
  priority: number;
  conditions: Record<string, unknown>;
  effects: Record<string, unknown> | Array<Record<string, unknown>>;
  source: string | null;
  version: string;
  sources: ClinicalRuleSource[] | null;
  conflictsWith: string[];
  category: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalRuleHistory {
  id: string;
  ruleId: string;
  changedBy: string | null;
  changeSummary: string;
  previousData: Record<string, unknown>;
  createdAt: string;
}

// ─── Nutrition Protocols ──────────────────────────────────────────────────────

export interface MacroRatio {
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
}

export interface MacroRatios {
  REDUCE: MacroRatio;
  GAIN: MacroRatio;
  MAINTAIN: MacroRatio;
}

export interface CaloricAdjustments {
  REDUCE: number;
  GAIN: number;
  MAINTAIN: number;
}

export interface MealSlot {
  mealName: string;
  pct: number;
}

export interface FoodRestriction {
  category: string;
  keywords: string[];
  level: 'HARD_BLOCK' | 'STRONG' | 'SOFT';
  reason: string;
}

export interface AvoidCategory {
  category: string;
  reason: string;
}

export interface NutritionProtocol {
  id: string;
  name: string;
  description: string | null;
  version: number;
  scope: 'GLOBAL' | 'DIETITIAN';
  isDefault: boolean;
  isActive: boolean;
  macroRatios: MacroRatios;
  bmrFormula: 'MIFFLIN' | 'HARRIS_BENEDICT';
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg: number;
  maxProteinPerKg: number;
  defaultMealCount: number;
  mealDistribution: MealSlot[];
  foodRestrictions: FoodRestriction[];
  systemPromptAdditions: string | null;
  preferredCuisines: string[];
  recipeComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  avoidFoodCategories: AvoidCategory[];
}

export interface DietitianProtocolWithAccess extends NutritionProtocol {
  isActive: boolean;
  assignedAt: string;
  assignedBy: string;
}

export interface ProtocolAssignedDietitian {
  dietitianId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  assignedAt: string;
}

// ─── Protocol Trigger & Conflict (30.6) ──────────────────────────────────────

export interface ProtocolTrigger {
  id: string;
  interviewField: string;
  interviewValue: string;
  protocolId: string;
  priority: number;
  score: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  protocol: { id: string; name: string };
}

export interface ProtocolTriggerCreateData {
  interviewField: string;
  interviewValue: string;
  protocolId: string;
  priority?: number;
  score?: number;
  isActive?: boolean;
}

export interface ProtocolConflict {
  id: string;
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: 'A' | 'B';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolConflictCreateData {
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide?: 'A' | 'B';
  isActive?: boolean;
}

// ─── Matched protocols (30.7) ─────────────────────────────────────────────

export interface MatchedProtocolEntry {
  triggerId: string;
  protocolId: string;
  protocolName: string;
  interviewField: string;
  interviewValue: string;
  priority: number;
  score: number;
}

export interface DetectedConflictEntry {
  conflictId: string;
  triggerAField: string;
  triggerAValue: string;
  triggerBField: string;
  triggerBValue: string;
  severity: 'BLOCK' | 'WARN';
  messageKey: string;
  winnerSide: string;
}

export interface MergedProtocolSummary {
  name: string;
  macroRatios: MacroRatios;
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg: number;
  maxProteinPerKg: number;
  defaultMealCount: number;
  foodRestrictions: FoodRestriction[];
  avoidFoodCategories: AvoidCategory[];
  preferredCuisines: string[];
  sourceProtocols: Array<{
    id: string;
    name: string;
    priority: number;
    triggerField: string;
    triggerValue: string;
  }>;
  mergeExplanation: Record<string, string>;
}

export interface MatchedProtocolsResponse {
  ok: boolean;
  matchedProtocols: MatchedProtocolEntry[];
  conflicts: DetectedConflictEntry[];
  hasBlockingConflict?: boolean;
  mergedProtocol: MergedProtocolSummary | null;
  interviewId: string | null;
}

export interface NutritionProtocolCreateData {
  name: string;
  description?: string;
  scope?: 'GLOBAL' | 'DIETITIAN';
  isDefault?: boolean;
  macroRatios: MacroRatios;
  caloricAdjustments: CaloricAdjustments;
  minProteinPerKg?: number;
  maxProteinPerKg?: number;
  defaultMealCount?: number;
  mealDistribution: MealSlot[];
  foodRestrictions?: FoodRestriction[];
  systemPromptAdditions?: string;
  preferredCuisines?: string[];
  recipeComplexity?: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  avoidFoodCategories?: AvoidCategory[];
}

// ─── AI Cost Log (34.2) ──────────────────────────────────────────────────────

// ─── Dietitian Onboarding ─────────────────────────────────────────────────────

// ─── Diet Toolkit ────────────────────────────────────────────────────────────

// ── Supplement Prescriptions (79.6) ──────────────────────────────────────────
