/**
 * Abstract base scraper with shared HTTP, rate limiting, and pagination logic.
 */

import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import { fetchHtml, delay } from '../utils/http';
import type { CheerioAPI } from 'cheerio';

export abstract class BaseScraper {
  abstract readonly siteName: SiteName;
  abstract readonly baseUrl: string;

  protected config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  /**
   * Get all recipe URLs from the site (handles pagination).
   */
  abstract getRecipeUrls(): AsyncGenerator<string>;

  /**
   * Scrape a single recipe page and extract structured data.
   * Returns null if the page can't be parsed or doesn't meet quality criteria.
   */
  abstract scrapeRecipe(url: string, $: CheerioAPI): Promise<RawRecipe | null>;

  /**
   * Fetch and parse a single recipe URL.
   */
  async fetchAndScrape(url: string): Promise<RawRecipe | null> {
    try {
      const $ = await fetchHtml(url);
      const recipe = await this.scrapeRecipe(url, $);

      if (!recipe) {
        console.log(`  [${this.siteName}] Skipped (no data): ${url}`);
        return null;
      }

      // Basic validation
      if (!recipe.title || recipe.rawIngredients.length < 2) {
        console.log(`  [${this.siteName}] Skipped (insufficient data): ${recipe.title ?? url}`);
        return null;
      }

      // Rating filter
      if (this.config.minRating && recipe.rating && recipe.rating < this.config.minRating) {
        return null;
      }

      return recipe;
    } catch (err) {
      console.error(`  [${this.siteName}] Error scraping ${url}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Scrape all recipes from this site with rate limiting.
   */
  async scrapeAll(
    skipUrls: Set<string> = new Set(),
    onRecipe?: (recipe: RawRecipe, url: string) => void,
  ): Promise<RawRecipe[]> {
    const recipes: RawRecipe[] = [];
    let count = 0;
    const maxRecipes = this.config.maxRecipes ?? Infinity;

    console.log(`\n[${this.siteName}] Starting scrape (max: ${maxRecipes})...`);

    for await (const url of this.getRecipeUrls()) {
      if (count >= maxRecipes) {
        console.log(`[${this.siteName}] Reached max recipes limit (${maxRecipes})`);
        break;
      }

      if (skipUrls.has(url)) {
        count++;
        continue;
      }

      await delay(this.config.rateLimit);

      const recipe = await this.fetchAndScrape(url);
      if (recipe) {
        recipes.push(recipe);
        onRecipe?.(recipe, url);
        count++;

        if (count % 50 === 0) {
          console.log(`[${this.siteName}] Progress: ${count} recipes scraped`);
        }
      }
    }

    console.log(`[${this.siteName}] Done: ${recipes.length} recipes scraped`);
    return recipes;
  }

  /**
   * Parse time string like "1 godzina 30 minut" or "45 min" to minutes.
   */
  protected parseTime(text: string | undefined | null): number | undefined {
    if (!text) return undefined;
    const clean = text.toLowerCase().trim();

    let total = 0;

    // "1 godzina" / "2 godziny" / "1 h"
    const hours = clean.match(/(\d+)\s*(?:godzin[aey]?|godz\.?|h)/);
    if (hours) total += parseInt(hours[1], 10) * 60;

    // "30 minut" / "45 min"
    const mins = clean.match(/(\d+)\s*(?:minut[ay]?|min\.?|m(?![a-z]))/);
    if (mins) total += parseInt(mins[1], 10);

    // Just a number (assume minutes)
    if (total === 0) {
      const justNum = clean.match(/^(\d+)$/);
      if (justNum) total = parseInt(justNum[1], 10);
    }

    return total > 0 ? total : undefined;
  }

  /**
   * Parse servings string like "4 porcje" or "6" to number.
   */
  protected parseServings(text: string | undefined | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Extract recipe slug from URL.
   */
  protected slugFromUrl(url: string): string {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  }
}
