/**
 * Scraper pipeline configuration.
 */

import type { SiteConfig, SiteName } from './types';

// ─── Site configs ──────────────────────────────────────────────────────────────

export const SITE_CONFIGS: Record<SiteName, SiteConfig> = {
  aniagotuje: {
    name: 'aniagotuje',
    baseUrl: 'https://aniagotuje.pl',
    enabled: true,
    rateLimit: 2000,
    minRating: 4.5,
    maxRecipes: 1500,
  },
  kwestiasmaku: {
    name: 'kwestiasmaku',
    baseUrl: 'https://www.kwestiasmaku.com',
    enabled: true,
    rateLimit: 2000,
    minRating: 4.0,
    maxRecipes: 1200,
  },
  dietetykpowszechny: {
    name: 'dietetykpowszechny',
    baseUrl: 'https://dietetykpowszechny.pl',
    enabled: true,
    rateLimit: 2000,
    maxRecipes: 200,
  },
  jadlonomia: {
    name: 'jadlonomia',
    baseUrl: 'https://jadlonomia.com',
    enabled: true,
    rateLimit: 2000,
    maxRecipes: 500,
    autoFlags: { vegetarian: true },
  },
  paleosmak: {
    name: 'paleosmak',
    baseUrl: 'https://paleosmak.pl',
    enabled: true,
    rateLimit: 2000,
    maxRecipes: 400,
    autoFlags: { glutenFree: true },
  },
};

// ─── OpenAI config ─────────────────────────────────────────────────────────────

export const OPENAI_CONFIG = {
  model: 'gpt-4.1-mini',
  maxRpm: 200,
  normalizeBatchSize: 12,   // ingredients per API call
  metaBatchSize: 5,         // recipes per API call
  maxRetries: 3,
  retryDelayMs: 2000,
};

// ─── Pipeline config ───────────────────────────────────────────────────────────

export const PIPELINE_CONFIG = {
  dataDir: 'src/scraper/data',
  rawDir: 'src/scraper/data/raw',
  progressFile: 'src/scraper/data/progress.json',
  reportFile: 'src/scraper/data/report.json',

  // Quality thresholds
  minQualityScore: 30,
  minIngredientMatchRate: 0.5,
  minIngredients: 2,
  minSteps: 1,
  kcalMin: 50,
  kcalMax: 1500,

  // Deduplication
  titleSimilarityThreshold: 0.8,     // Levenshtein: 1 = identical
  ingredientOverlapThreshold: 0.7,   // 70% shared CleanProduct IDs

  // DB save
  saveBatchSize: 50,
};

// ─── Cuisine types (matching interview cuisinePreferences) ─────────────────────

export const CUISINE_TYPES = [
  'polska',
  'włoska',
  'azjatycka',
  'śródziemnomorska',
  'meksykańska',
  'indyjska',
  'amerykańska',
  'francuska',
  'inna',
] as const;

export type CuisineType = (typeof CUISINE_TYPES)[number];
