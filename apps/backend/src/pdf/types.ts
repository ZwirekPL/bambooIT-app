// ─── Shared types for PDF generation ──────────────────────────────────────────

export interface MealItem {
  name: string;
  grams?: number;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  ingredients?: Array<{ name: string; grams: number }>;
}

export interface MealRecipeData {
  prepTimeMin?: number;
  steps: string[];
  tips?: string | null;
}

export interface Meal {
  name: string;
  items: (string | MealItem)[];
  recipe?: MealRecipeData;
  _type?: string;
}

export interface Day {
  day: string;
  meals: Meal[];
}

export interface ShoppingCategory {
  category: string;
  items: string[];
}

export interface Recipe {
  name: string;
  ingredients: string[];
  steps: string[];
}

export interface TenantBranding {
  name: string;
  logoUrl?: string | null;
}

export interface DietPlanData {
  id: string;
  kcal?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbsG?: number | null;
  content: Record<string, unknown>;
  createdAt: Date | string;
  source?: string;
  tenant?: TenantBranding | null;
  watermarkText?: string | null;
  micronutrients?: {
    overallScore: number;
    analyzedDays: number;
    assessments: Array<{
      label: string;
      unit: string;
      dailyAvgIntake: number;
      target: number | null;
      status: 'ADEQUATE' | 'SUBOPTIMAL' | 'DEFICIENT' | 'EXCESSIVE' | 'UNKNOWN';
      percentOfTarget: number | null;
    }>;
    supplementRecommendations: Array<{
      label: string;
      suggestedDose: string;
      reason: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
  } | null;
}

export interface ParsedContent {
  days: Day[];
  shoppingList: ShoppingCategory[];
  recipes: Recipe[];
  rules: string[];
  mealsPerDay: number;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

export const COLORS = {
  primary: '#2d6a4f',
  primaryLight: '#40916c',
  primaryBg: '#f0f7f4',
  primaryBorder: '#d0e4d8',
  dark: '#1a1a1a',
  text: '#333333',
  textLight: '#555555',
  muted: '#888888',
  mutedLight: '#aaaaaa',
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  white: '#ffffff',
  accentKcal: '#e76f51',
  accentProtein: '#2a9d8f',
  accentFat: '#e9c46a',
  accentCarbs: '#264653',
} as const;

export const LAYOUT = {
  margin: 50,
  pageWidth: 595.28, // A4
  pageHeight: 841.89,
  contentWidth: 495.28, // pageWidth - 2 * margin
  colGap: 12,
  headerHeight: 30,
  footerY: 815, // pageHeight - ~27
} as const;

// Legal disclaimer (shown on summary page + footer)
export const DISCLAIMER_TEXT = 'Jadłospis wygenerowany przy wsparciu AI, zweryfikowany przez dyplomowanego dietetyka. Nie stanowi porady medycznej. W przypadku chorób skonsultuj się z lekarzem.';
export const DISCLAIMER_SHORT = 'Nie stanowi porady medycznej.';

// Meal type display names (Polish)
export const MEAL_LABELS: Record<string, string> = {
  'snack': 'Przekąska',
  'breakfast': 'Śniadanie',
  'lunch': 'Obiad',
  'dinner': 'Kolacja',
  'supper': 'Kolacja',
  'second breakfast': 'Drugie śniadanie',
  'ii śniadanie': 'Drugie śniadanie',
  'drugie śniadanie': 'Drugie śniadanie',
  'śniadanie': 'Śniadanie',
  'obiad': 'Obiad',
  'kolacja': 'Kolacja',
  'przekąska': 'Przekąska',
};

// Meal type emoji icons
export const MEAL_ICONS: Record<string, string> = {
  'Śniadanie': 'Sniadanie',
  'Drugie śniadanie': 'II Sniadanie',
  'Obiad': 'Obiad',
  'Przekąska': 'Przekaska',
  'Kolacja': 'Kolacja',
};
