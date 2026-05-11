/**
 * Shared types for the recipe scraping & import pipeline.
 */

// ─── Raw scraped data ──────────────────────────────────────────────────────────

export interface RawRecipe {
  sourceId: string;         // unique ID from source (slug or URL path)
  sourceUrl: string;        // full URL
  sourceSite: SiteName;
  title: string;
  rawIngredients: string[]; // original strings: "1 duża cebula", "200g piersi z kurczaka"
  steps: string[];          // original instruction steps
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  servings?: number;
  rating?: number;          // 1-5 scale
  ratingCount?: number;
  imageUrl?: string;
  category?: string;        // original category from site
  tags?: string[];
}

export type SiteName =
  | 'aniagotuje'
  | 'kwestiasmaku'
  | 'dietetykpowszechny'
  | 'jadlonomia'
  | 'paleosmak';

// ─── Normalized ingredient ─────────────────────────────────────────────────────

export interface NormalizedIngredient {
  originalText: string;
  name: string;             // canonical Polish name: "Cebula", "Oliwa z oliwek"
  grams: number;
  unit?: string;            // "szt", "łyżka", "szklanka"
  notes?: string;           // "duża", "do smaku"
  isSpice?: boolean;        // true for spices/seasonings
}

// ─── Mapped ingredient (linked to CleanProduct) ────────────────────────────────

export interface MappedIngredient extends NormalizedIngredient {
  cleanProductId: string | null;
  cleanProductName: string | null;
  matchConfidence: number;  // 0.0 - 1.0
}

// ─── Processed recipe (ready for DB save) ──────────────────────────────────────

export interface ProcessedRecipe {
  // Core
  sourceId: string;
  sourceUrl: string;
  sourceSite: SiteName;
  title: string;
  slug: string;
  description: string;      // AI-generated short description

  // Classification
  category: string | null;
  cuisineType: string;       // "polska", "włoska", "azjatycka", etc.
  mealType: string;          // BREAKFAST, LUNCH, DINNER, etc.
  difficulty: string;        // EASY, MEDIUM, HARD

  // Time & servings
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  servings: number;

  // Metadata
  estimatedCost: 'BUDGET' | 'STANDARD' | 'PREMIUM';
  mealPrepFriendly: boolean;
  mealPrepTip: string | null;
  seasons: number[];         // months 1-12
  tags: string[];
  tips: string | null;
  imageUrl: string | null;
  sourceRating: number | null;
  sourceRatingCount: number | null;

  // Ingredients (mapped)
  ingredients: MappedIngredient[];

  // Steps
  steps: string[];

  // Nutrition (calculated from CleanProductNutrients)
  nutrition: RecipeNutrition | null;

  // Flags
  allergens: AllergenFlag[];
  dietFlags: DietFlagEntry[];

  // Quality
  qualityScore: number;      // 0-100
  ingredientMatchRate: number; // 0.0-1.0: % of ingredients mapped to CleanProduct
}

// ─── Nutrition snapshot ────────────────────────────────────────────────────────

export interface RecipeNutrition {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  sugarsG: number;
  saltG: number;
  saturatedFatG?: number;
  monounsaturatedFatG?: number;
  polyunsaturatedFatG?: number;
  omega3G?: number;
  omega6G?: number;
  cholesterolMg?: number;
  vitaminAUg?: number;
  vitaminB1Mg?: number;
  vitaminB2Mg?: number;
  vitaminB6Mg?: number;
  vitaminB12Ug?: number;
  vitaminCMg?: number;
  vitaminDUg?: number;
  vitaminEMg?: number;
  vitaminKUg?: number;
  folateMcg?: number;
  niacinMg?: number;
  calciumMg?: number;
  ironMg?: number;
  magnesiumMg?: number;
  phosphorusMg?: number;
  potassiumMg?: number;
  sodiumMg?: number;
  zincMg?: number;
  seleniumUg?: number;
  iodineMcg?: number;
  copperMg?: number;
  manganeseMg?: number;
}

// ─── Flags ─────────────────────────────────────────────────────────────────────

export interface AllergenFlag {
  allergenCode: string;    // e.g. "gluten", "milk", "eggs"
  presence: 'CONTAINS' | 'MAY_CONTAIN' | 'FREE';
}

export interface DietFlagEntry {
  flagCode: string;         // e.g. "vegetarian", "glutenFree", "diabeticFriendly"
  value: boolean;
  confidence: number;       // 0.0 - 1.0
  source: 'AUTO_RULE' | 'HEURISTIC' | 'SOURCE_DATA';
}

// ─── Pipeline progress ────────────────────────────────────────────────────────

export interface PipelineProgress {
  currentStep: number;      // 1-9
  scraped: Record<SiteName, SiteProgress>;
  normalized: number;
  mapped: number;
  metaGenerated: number;
  flagsDetected: number;
  scored: number;
  deduplicated: number;
  saved: number;
  startedAt: string;
  lastUpdatedAt: string;
}

export interface SiteProgress {
  total: number;
  completed: string[];      // processed URLs
  lastUrl?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface SiteConfig {
  name: SiteName;
  baseUrl: string;
  enabled: boolean;
  rateLimit: number;        // ms between requests
  minRating?: number;       // minimum rating to accept (if site has ratings)
  maxRecipes?: number;      // max recipes to scrape from this site
  autoFlags?: Record<string, boolean>; // auto-applied diet flags
}
