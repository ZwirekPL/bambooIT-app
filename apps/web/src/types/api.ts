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

export interface Interview {
  id: string;
  patientId: string;
  tenantId: string | null;
  answers: Record<string, unknown>;
  medicalFlags?: Record<string, unknown> | null;
  createdAt: string;
}

export type DietPlanSource = 'AI' | 'MANUAL';
export type DietPlanStatus = 'AI_DRAFT' | 'GENERATED' | 'REVIEWED' | 'SENT' | 'PUBLISHED' | 'MANUAL_REVIEW_REQUIRED' | 'GENERATION_FAILED';

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

export interface PatientWithLatestPlan extends Patient {
  user: { id: string; email: string; role: UserRole; createdAt: string };
  dietPlans: Array<{ id: string; status: DietPlanStatus; createdAt: string }>;
}

export interface PatientDetail extends Patient {
  user: { id: string; email: string; role: UserRole; createdAt: string };
}

export interface InterviewSummary {
  id: string;
  patientId: string;
  createdAt: string;
}

export interface DietPlanSummary {
  id: string;
  patientId: string;
  tenantId: string | null;
  source: DietPlanSource;
  status: DietPlanStatus;
  kcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  validated: boolean;
  createdAt: string;
}

export interface DietitianStats {
  totalPatients: number;
  awaitingReview: number;
  aiDraft: number;
  published: number;
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

export interface DietCacheStats {
  totalTemplates: number;
  activeTemplates: number;
  totalLookups: number;
  exactHits: number;
  similarHits: number;
  misses: number;
  hitRate: number;
  exactHitRate: number;
  estimatedSavingsUsd: number;
  topSegments: Array<{
    id: string;
    segmentHash: string;
    goal: string;
    kcalBucket: number;
    dietType: string;
    usageCount: number;
  }>;
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

export interface DietitianPatient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  sex: string | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    lastLoginAt: string | null;
    deletedAt: string | null;
  };
}

export interface AdminDietitian {
  userId: string;
  code: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  patientsCount: number;
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
export interface AiProcessingIssue {
  type: 'MISSING_RECIPES' | 'UNMATCHED_PRODUCTS' | 'KCAL_DEVIATION' | 'MACRO_DEVIATION' | 'VIOLATIONS' | 'HARD_FLOOR' | 'COOKING_TIME';
  count: number;
  details: string[];
}

export interface AiProcessingReport {
  receivedAt: string;
  aiProvider: string;
  aiModel: string;
  issues: AiProcessingIssue[];
  autoAdjusted: boolean;
  recipesExtracted: number;
  recipesGenerated: number;
  validationStatus: string;
  productStandardization: {
    totalItems: number;
    matched: number;
    unmatched: number;
    unmatchedNames: string[];
  };
}

/** 76c: Plan comparison side metrics */
export interface PlanComparisonSide {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  generationMethod: string | null;
  metrics: {
    days: number;
    totalMeals: number;
    uniqueRecipes: number;
    diversityScore: number;
    avgKcal: number;
    avgProtein: number;
    avgFat: number;
    avgCarbs: number;
    dailyMetrics: Array<{ kcal: number; proteinG: number; fatG: number; carbsG: number; mealCount: number }>;
  };
  quality: {
    grade: string | null;
    qualityScore: number | null;
    softViolations: number;
    coveragePct: number | null;
    avgFitScore: number | null;
    avgTotalScore: number | null;
    diversityScore: number | null;
  };
}

export interface SolverReport {
  status: string;
  objectiveValue?: number;
  variables?: number;
  constraints?: number;
  durationMs?: number;
  composeMeals?: boolean;
  composeSlotsCount?: number;
  multiItemSlotCount?: number;
  // Faza D D1 (revisited): cuisine soft-constraint telemetry. Both null when
  // patient cuisinePreferences are inactive (empty / "any") so SC22 was
  // disabled in the solver.
  cuisineMatchCount?: number | null;
  cuisineMainTotal?: number | null;
}

export interface PolicyMetadata {
  appliedRules?: Array<{ id: string; name: string }>;
  redFlags?: Array<{ id: string; name: string; severity: string }>;
  solverReport?: SolverReport | null;
  [key: string]: unknown;
}

export interface DietPlan {
  id: string;
  patientId: string;
  tenantId: string | null;
  source: DietPlanSource;
  status: DietPlanStatus;
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  content: Record<string, unknown>;
  aiProvider?: string;
  aiModel?: string;
  rawResponse?: Record<string, unknown> | null;
  validated: boolean;
  createdAt: string;
  aiProcessingReport?: AiProcessingReport | null;
  dayRegenLimit?: number;
  policyMetadata?: PolicyMetadata | null;
}

export type DietPlanRevisionReason = 'AI_GENERATED' | 'AUTO_ADJUST' | 'DIETITIAN_EDIT' | 'PUBLISHED';

export interface DietPlanRevision {
  id: string;
  dietPlanId?: string;
  revisionNumber: number;
  reason: DietPlanRevisionReason;
  createdBy: string | null;
  createdAt: string;
}

export interface DietPlanRevisionDetail extends DietPlanRevision {
  contentJson: Record<string, unknown>;
}

export interface MealSwapAlternative {
  name: string;
  items: Array<{
    name: string;
    grams: number;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
  }>;
  recipe?: {
    prepTimeMin: number;
    steps: string[];
    tips?: string;
  };
  reason: string;
}

export interface MealSwap {
  id: string;
  dietPlanId: string;
  dayIndex: number;
  mealIndex: number;
  originalMeal: Record<string, unknown>;
  alternatives: MealSwapAlternative[];
  chosenIndex: number | null;
  newMeal: Record<string, unknown> | null;
  confirmed: boolean;
  createdAt: string;
  remaining?: number;
}

// ─── Slot Decision Audit Trail (Faza 72) ────────────────────────────────────

export type DecisionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface SlotDecisionScores {
  nutritionFit: number;
  quality: number;
  patientRating: number;
  cuisine: number;
  season: number;
  diversity: number;
  cost: number;
  microFit: number;
  practicalFit: number;
  satietyProxy: number;
  interaction: number;
  compliance: number;
}

export interface RunnerUp {
  recipeId: string;
  title: string;
  totalScore: number;
  adjustedScore: number;
  rejectionReason: string;
}

export interface SlotDecision {
  dayIndex: number;
  slotIndex: number;
  dayName: string;
  mealType: string;
  candidatesCount: number;
  chosen: {
    recipeId: string;
    title: string;
    totalScore: number;
    adjustedScore: number;
    scores: SlotDecisionScores;
  } | null;
  runnersUp: RunnerUp[];
  rulesApplied: string[];
  confidence: DecisionConfidence;
  scalingFailed: boolean;
}

// ─── Plan Quality & Soft Validations (Faza 74) ─────────────────────────────

export type SoftValidationStatus = 'OK' | 'WARNING' | 'FAIL';

export interface SoftValidation {
  metric: string;
  label: string;
  target: number;
  actual: number;
  unit: string;
  status: SoftValidationStatus;
}

export type PlanQualityGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface WeeklyMetrics {
  avgKcalPerDay: number;
  proteinSourceCount: number;
  fishMealsCount: number;
  legumeMealsCount: number;
  recipeRepeatCount: number;
  avgSodiumMg: number;
  avgFiberG: number;
  avgVegetablesG: number;
  avgFruitsG: number;
}

export interface PlanQualityData {
  grade: PlanQualityGrade;
  score: number;
  softValidations: SoftValidation[][];
  weeklyMetrics: WeeklyMetrics;
}

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

// ─── Shopping list (19.1) ──────────────────────────────────────────────────────

export interface ShoppingListUsage {
  day: string;
  meal: string;
  grams: number;
}

export interface ShoppingListDetailItem {
  name: string;
  totalGrams: number;
  category: string;
  usedIn: ShoppingListUsage[];
  /** Human-friendly piece conversion, e.g. "2 szt.", "3 kromki" (24.7.4) */
  pieces?: string;
}

export interface ShoppingListCategory {
  category: string;
  items: ShoppingListDetailItem[];
}

// ─── Micronutrient Analysis (38.7) ──────────────────────────────────────────

export type NutrientStatus = 'DEFICIENT' | 'SUBOPTIMAL' | 'ADEQUATE' | 'EXCESSIVE';

export interface NutrientAssessment {
  nutrientKey: string;
  label: string;
  unit: string;
  dailyAvgIntake?: number;
  target?: number | null;
  status: NutrientStatus;
  percentOfTarget: number | null;
}

export interface SupplementRecommendation {
  nutrientKey: string;
  label: string;
  suggestedDose: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MicronutrientReport {
  assessments: NutrientAssessment[];
  deficiencies: NutrientAssessment[];
  suboptimal: NutrientAssessment[];
  excessive: NutrientAssessment[];
  supplementRecommendations: SupplementRecommendation[];
  overallScore: number;
  analyzedDays: number;
  unmatchedIngredients?: string[];
  deficiencyCount?: number;
}

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

export interface CheckIn {
  id: string;
  patientId: string;
  weightKg: number | null;
  compliance: number | null;
  hunger: number | null;
  energy: number | null;
  sleep: number | null;
  activity: number | null;
  notes: string | null;
  // 79.2: GI/digestion fields (visible only for IBS/reflux patients)
  digestion: number | null;
  bloating: boolean | null;
  stoolBristol: number | null;
  createdAt: string;
}

// ── Body Measurements (79.3) ─────────────────────────────────────────────────

export interface BodyMeasurement {
  id: string;
  patientId: string;
  date: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  armCm: number | null;
  bodyFatPct: number | null;
  notes: string | null;
}

export interface MeasurementSummary {
  field: string;
  first: number | null;
  last: number | null;
  change: number | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'stable' | 'insufficient';
}

export interface WhrInterpretation {
  whr: number;
  level: 'healthy' | 'moderate' | 'high';
  label: string;
}

export interface MeasurementTrends {
  points: BodyMeasurement[];
  summaries: MeasurementSummary[];
  whrInterpretation: WhrInterpretation | null;
}

export interface WeightTrend {
  direction: 'losing' | 'gaining' | 'stable' | 'insufficient_data';
  weeklyRateKg: number | null;
  totalChangeKg: number | null;
  currentKg: number | null;
  startKg: number | null;
  dataPoints: number;
}

export interface PlateauInfo {
  isPlateauDetected: boolean;
  plateauWeeks: number;
}

export interface RapidLossAlert {
  isRapidLoss: boolean;
  weeklyLossKg: number | null;
  threshold: number;
}

export interface MetricAverages {
  compliance: number | null;
  hunger: number | null;
  energy: number | null;
  sleep: number | null;
  activity: number | null;
}

export interface WeightDataPoint {
  date: string;
  weightKg: number;
}

export interface CheckInTrends {
  weightTrend: WeightTrend;
  plateau: PlateauInfo;
  rapidLoss: RapidLossAlert;
  averages: MetricAverages;
  recentAverages: MetricAverages;
  weightHistory: WeightDataPoint[];
  totalCheckIns: number;
}

export interface Milestone {
  id: string;
  label: string;
  achieved: boolean;
  achievedAt: string | null;
  params?: Record<string, string | number>;
}

export interface ProgressData {
  startWeightKg: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  totalChangeKg: number | null;
  progressPercent: number | null;
  milestones: Milestone[];
}

// ─── Dietitian Alerts (20.1) ──────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'info';
export type AlertType = 'plans_awaiting_review' | 'red_flag_plans' | 'dropout_risk' | 'rapid_weight_loss' | 'micronutrient_deficiency';

export interface DietitianAlertPatient {
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  detail?: string;
}

export interface DietitianAlert {
  type: AlertType;
  severity: AlertSeverity;
  count: number;
  patients: DietitianAlertPatient[];
}

// ─── Dietitian Notes (20.2) ───────────────────────────────────────────────────

export interface DietitianNote {
  id: string;
  patientId: string;
  dietitianId: string;
  dietPlanId: string | null;
  content: string;
  createdAt: string;
  dietitian: {
    id: string;
    email?: string;
    dietitianProfile?: { code: string } | null;
  };
}

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

export interface NoteTemplate {
  id: string;
  dietitianId: string;
  title: string;
  content: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

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

// ─── Food Products & Recipes ─────────────────────────────────────────────────

export interface FoodProductNutrients {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number | null;
  sugars_g?: number | null;
  salt_g?: number | null;
  saturatedFat_g?: number | null;
  [key: string]: number | null | undefined;
}

export interface FoodProductAllergen {
  id: string;
  allergenCode: string;
  presence: string;
  source?: string | null;
  confidence?: number | null;
  notes?: string | null;
}

export interface FoodProductMeasure {
  id: string;
  name: string;
  nameEn?: string | null;
  grams: number;
  source?: string | null;
}

export interface FoodProductCategory {
  id: string;
  name: string;
  nameEn?: string | null;
  parentId?: string | null;
  _count?: { products: number };
}

export interface FoodProduct {
  id: string;
  name: string;
  nameEn?: string | null;
  source?: string | null;
  categoryId?: string | null;
  category?: FoodProductCategory | null;
  description?: string | null;
  isActive: boolean;
  verificationStatus?: string | null;
  nutrients?: FoodProductNutrients | null;
  allergens?: FoodProductAllergen[];
  measures?: FoodProductMeasure[];
  createdAt: string;
  updatedAt: string;
}

export interface FoodProductCreateData {
  name: string;
  nameEn?: string;
  source?: string;
  categoryId?: string;
  description?: string;
  state?: string;
  defaultServingGrams?: number;
  glycemicIndex?: number;
  notesClinical?: string;
  notesDietitian?: string;
  nutrients: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    [key: string]: number | undefined;
  };
  allergens?: Array<{
    allergenCode: string;
    presence: string;
    source?: string;
    confidence?: number;
    notes?: string;
  }>;
}

export interface RecipeIngredient {
  id: string;
  foodProductId?: string | null;
  cleanProductId?: string | null;
  foodProduct?: { id: string; name: string; nameEn?: string | null; slug?: string; nutrients?: { kcal?: number; protein_g?: number; fat_g?: number; carbs_g?: number } | null };
  cleanProduct?: { id: string; name: string; nameEn?: string | null; slug?: string; type?: string; nutrients?: { kcalPer100g?: number; proteinPer100g?: number; fatPer100g?: number; carbsPer100g?: number } | null; portions?: CleanProductPortion[] };
  sortOrder?: number;
  quantity: number;
  unit?: string | null;
  grams: number;
  displayName?: string | null;
  isOptional: boolean;
  groupName?: string | null;
  notes?: string | null;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  durationMinutes?: number | null;
  phase?: string | null; // "prep" or "cook"
}

export interface Recipe {
  id: string;
  name: string;
  nameEn?: string | null;
  description?: string | null;
  category?: string | null;
  mealType?: string | null;
  difficulty?: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  servings?: number | null;
  tags?: string[];
  isActive: boolean;
  qualityScore?: number;
  averageRating?: number | null;
  ratingCount?: number;
  verificationStatus?: string;
  source?: string;
  servingWeightG?: number | null;
  mealPrepFriendly?: boolean;
  seasons?: string[];
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  nutritionSnapshot?: FoodProductNutrients | null;
  allergens?: Array<{ id: string; allergenCode: string; presence: string }>;
  dietFlags?: Array<{ id: string; flagCode: string; value: boolean }>;
  createdAt: string;
  updatedAt: string;
}


export interface RecipeCreateData {
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  mealType?: string;
  difficulty?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  tags?: string[];
  ingredients: Array<{
    cleanProductId?: string;
    foodProductId?: string;
    sortOrder?: number;
    quantity: number;
    unit?: string;
    grams: number;
    displayName?: string;
    isOptional?: boolean;
    groupName?: string;
    notes?: string;
  }>;
  steps?: Array<{
    stepNumber: number;
    instruction: string;
    durationMinutes?: number;
  }>;
}

// ─── NutritionTargets types ──────────────────────────────────────────────────

export interface NutritionTargets {
  id: string;
  patientId: string;
  targetKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  createdAt: string;
  updatedAt: string;
}

// ─── CleanProduct types ─────────────────────────────────────────────────────

export type CleanProductType = 'BASE' | 'RETAIL' | 'MANUAL';

export interface CleanProductNutrients {
  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g?: number | null;
  sugarsPer100g?: number | null;
  saltPer100g?: number | null;
  saturatedFatPer100g?: number | null;
  // Fat fractions (26.B)
  monounsaturatedFatPer100g?: number | null;
  polyunsaturatedFatPer100g?: number | null;
  transFatPer100g?: number | null;
  omega3Per100g?: number | null;
  omega6Per100g?: number | null;
  epaPer100g?: number | null;
  dhaPer100g?: number | null;
  alaPer100g?: number | null;
  // Carb fractions (26.C)
  starchPer100g?: number | null;
  addedSugarsPer100g?: number | null;
  // Minerals
  sodiumMg?: number | null;
  potassiumMg?: number | null;
  calciumMg?: number | null;
  magnesiumMg?: number | null;
  phosphorusMg?: number | null;
  ironMg?: number | null;
  zincMg?: number | null;
  copperMg?: number | null;
  manganeseMg?: number | null;
  iodineUg?: number | null;
  seleniumUg?: number | null;
  chromiumUg?: number | null;
  molybdenumUg?: number | null;
  fluorideUg?: number | null;
  chlorideMg?: number | null;
  // Fat-soluble vitamins
  vitaminAUg?: number | null;
  vitaminDUg?: number | null;
  vitaminEMg?: number | null;
  vitaminKUg?: number | null;
  // Water-soluble vitamins
  vitaminCMg?: number | null;
  vitaminB1Mg?: number | null;
  vitaminB2Mg?: number | null;
  vitaminB3Mg?: number | null;
  vitaminB5Mg?: number | null;
  vitaminB6Mg?: number | null;
  folateUg?: number | null;
  vitaminB12Ug?: number | null;
  biotinUg?: number | null;
  cholineMg?: number | null;
  // Other
  cholesterolMg?: number | null;
}

export interface CleanProductAminoAcids {
  tryptophanPer100g?: number | null;
  threoninePer100g?: number | null;
  isoleucinePer100g?: number | null;
  leucinePer100g?: number | null;
  lysinePer100g?: number | null;
  methioninePer100g?: number | null;
  phenylalaninePer100g?: number | null;
  valinePer100g?: number | null;
  histidinePer100g?: number | null;
}

export interface CleanProductBioactives {
  purinesMg?: number | null;
  oxalateMg?: number | null;
  caffeineMg?: number | null;
  polyphenolsMg?: number | null;
  betaCaroteneUg?: number | null;
  lycopeneUg?: number | null;
  luteinZeaxanthinUg?: number | null;
}

export interface CleanProductPortion {
  id: string;
  portionName: string;
  weightG: number;
  source?: string;
}

export interface CleanProduct {
  id: string;
  name: string;
  nameEn?: string | null;
  slug: string;
  type: CleanProductType;
  brand?: string | null;
  barcode?: string | null;
  category: string;
  subcategory?: string | null;
  packageWeightG?: number | null;
  servingWeightG?: number | null;
  qualityScore: number;
  verificationStatus: string;
  hasMicronutrients: boolean;
  glycemicIndex?: number | null;
  glycemicLoadPer100g?: number | null;
  fodmapLevel?: string | null;
  nutrients?: CleanProductNutrients | null;
  aminoAcids?: CleanProductAminoAcids | null;
  bioactives?: CleanProductBioactives | null;
  portions?: CleanProductPortion[];
}

export interface DuplicateGroupProduct {
  id: string;
  name: string;
  nameEn: string | null;
  type: string;
  brand: string | null;
  category: string;
  qualityScore: number;
  verificationStatus: string;
  sourcePrimary: string;
  hasMicronutrients: boolean;
  nutrients: { kcalPer100g: number; proteinPer100g: number; fatPer100g: number; carbsPer100g: number } | null;
}

export interface DuplicateGroup {
  normalizedName: string;
  products: DuplicateGroupProduct[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  createdAt: string;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
  user?: { id: string; email: string; role: string } | null;
}

export interface NutritionPreview {
  total: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sugars?: number;
    salt?: number;
    saturatedFat?: number;
  };
  perServing: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
    sugars?: number;
    salt?: number;
    saturatedFat?: number;
  };
  servings: number;
  breakdown: Array<{
    cleanProductId: string;
    name: string;
    grams: number;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    hasMicronutrients?: boolean;
  }>;
  warnings: string[];
}

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

export interface OnboardingStatus {
  ok: boolean;
  profileComplete: boolean;
  trialActive: boolean;
  interviewComplete: boolean;
  onboardingDone: boolean;
}

// ─── AI Cost Log (34.2) ──────────────────────────────────────────────────────

export interface AiCostLog {
  id: string;
  dietPlanId: string;
  patientId: string;
  planStatus: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  jobType: string;
  createdAt: string;
}

export interface AiCostSummary {
  totalCostUsd: number;
  totalPlans: number;
  avgCostPerPlan: number;
  totalTokens: number;
  byModel: Array<{
    model: string;
    count: number;
    totalCostUsd: number;
    totalTokens: number;
  }>;
}

export interface AiCostsListResponse {
  ok: boolean;
  logs: AiCostLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: AiCostSummary;
}

export interface AiCostPlanDetailResponse {
  ok: boolean;
  dietPlanId: string;
  logs: AiCostLog[];
  totalCostUsd: number;
  totalTokens: number;
  attempts: number;
}

// ─── Dietitian Onboarding ─────────────────────────────────────────────────────

export interface DietitianOnboardingStatus {
  profileComplete: boolean;
  hasPatients: boolean;
  onboardingDone: boolean;
}

// ─── Diet Toolkit ────────────────────────────────────────────────────────────

export interface DietToolkitData {
  patient: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    sex: string | null;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    bmi: number | null;
  };
  dietType: string | null;
  mainGoal: string | null;
  nutritionTargets: {
    targetKcal: number;
    targetProteinG: number;
    targetFatG: number;
    targetCarbsG: number;
    bmr: number;
    tdee: number;
    activityLevel: string;
    goal: string;
  } | null;
  chronicDiseases: Array<{
    code: string;
    name: string;
    severity: 'critical' | 'high' | 'moderate';
    guidelines: string[];
  }>;
  allergens: Array<{
    code: string;
    name: string;
  }>;
  medicalFlags: Record<string, unknown> | null;
  recentNotes: Array<{
    id: string;
    content: string;
    createdAt: string;
    dietitianEmail: string;
  }>;
  policyEngine: {
    totalPolicies: number;
    matchedPolicies: number;
    matchedPolicyNames: string[];
    totalRedFlags: number;
    matchedRedFlags: number;
    matchedRedFlagDetails: Array<{
      name: string;
      severity: string;
      description: string;
    }>;
  };
}

// ── Supplement Prescriptions (79.6) ──────────────────────────────────────────

export type SupplementFrequency = 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'as_needed';

export interface SupplementPrescription {
  id: string;
  patientId: string;
  dietitianId: string | null;
  nutrientKey: string;
  label: string;
  dose: string;
  unit: string;
  frequency: SupplementFrequency;
  startDate: string;
  endDate: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplementCompliance {
  supplementId: string;
  label: string;
  nutrientKey: string;
  totalCheckIns: number;
  takenCount: number;
  compliancePct: number;
  streak: number;
  lastTaken: string | null;
}

export interface SupplementTaken {
  supplementId: string;
  taken: boolean;
}
