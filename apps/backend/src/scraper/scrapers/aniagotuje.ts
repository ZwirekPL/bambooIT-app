/**
 * Scraper for aniagotuje.pl
 * Tech: Nuxt.js SSR with JSON-LD schema.org Recipe
 * ~2000 recipes, has kcal/100g, ratings, pagination via /przepisy/strona/N
 */

import { BaseScraper } from './base';
import { fetchHtml, delay } from '../utils/http';
import { extractAndParseRecipe, parseIsoDuration } from '../utils/jsonLd';
import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import type { CheerioAPI } from 'cheerio';

export class AniaGotujeScraper extends BaseScraper {
  readonly siteName: SiteName = 'aniagotuje';
  readonly baseUrl = 'https://aniagotuje.pl';

  constructor(config: SiteConfig) {
    super(config);
  }

  async *getRecipeUrls(): AsyncGenerator<string> {
    // Use sitemap.xml — contains all ~2200 recipe URLs
    console.log('[aniagotuje] Fetching sitemap.xml...');
    try {
      const response = await fetch(`${this.baseUrl}/sitemap.xml`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        console.error(`[aniagotuje] Sitemap returned ${response.status}`);
        return;
      }
      const xml = await response.text();

      // Extract all /przepis/ URLs from sitemap
      const urlRegex = /<loc>(https?:\/\/aniagotuje\.pl\/przepis\/[^<]+)<\/loc>/g;
      const urls: string[] = [];
      let match;
      while ((match = urlRegex.exec(xml)) !== null) {
        urls.push(match[1]);
      }

      console.log(`[aniagotuje] Found ${urls.length} recipe URLs in sitemap`);

      for (const url of urls) {
        yield url;
      }
    } catch (err) {
      console.error('[aniagotuje] Failed to fetch sitemap:', err instanceof Error ? err.message : err);
    }
  }

  async scrapeRecipe(url: string, $: CheerioAPI): Promise<RawRecipe | null> {
    // Try JSON-LD first (most reliable, unified parser)
    const parsed = extractAndParseRecipe($);
    if (parsed) {
      return {
        sourceId: this.slugFromUrl(url),
        sourceUrl: url,
        sourceSite: 'aniagotuje',
        title: parsed.title,
        rawIngredients: parsed.rawIngredients,
        steps: parsed.steps,
        prepTimeMinutes: parsed.prepTimeMinutes,
        cookTimeMinutes: parsed.cookTimeMinutes,
        totalTimeMinutes: parsed.totalTimeMinutes,
        servings: parsed.servings,
        rating: parsed.rating,
        ratingCount: parsed.ratingCount,
        imageUrl: parsed.imageUrl,
        category: parsed.category,
        tags: parsed.tags,
      };
    }

    // Fallback: parse HTML directly
    return this.parseHtml($, url);
  }

  private parseHtml($: CheerioAPI, url: string): RawRecipe | null {
    const title = $('h1').first().text().trim()
      || $('meta[property="og:title"]').attr('content')?.trim();
    if (!title) return null;

    // Ingredients: use itemprop="recipeIngredient" (aniagotuje SSR uses microdata)
    const rawIngredients: string[] = [];
    $('[itemprop="recipeIngredient"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 200) rawIngredients.push(text);
    });

    // Fallback: recipe-ing-list items
    if (rawIngredients.length === 0) {
      $('ul.recipe-ing-list li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) rawIngredients.push(text);
      });
    }

    // Steps: div.steps > div.step > div.step-text
    const steps: string[] = [];
    $('div.steps div.step div.step-text').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        // Split into sentences
        const sentences = text.split(/(?<=[.!])\s+/).filter(s => s.length > 10);
        steps.push(...sentences);
      }
    });

    // Fallback: any step-like paragraphs
    if (steps.length === 0) {
      $('div.step p, div.steps p').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 15 && !text.startsWith('Tip') && !text.includes('reklam')) {
          steps.push(text);
        }
      });
    }

    // Rating
    let rating: number | undefined;
    let ratingCount: number | undefined;
    const ratingText = $('[itemprop="ratingValue"]').attr('content') ?? $('[itemprop="ratingValue"]').text();
    if (ratingText) rating = parseFloat(ratingText);
    const countText = $('[itemprop="ratingCount"]').attr('content') ?? $('[itemprop="ratingCount"]').text();
    if (countText) ratingCount = parseInt(countText, 10);

    // Time
    const prepTime = parseIsoDuration($('[itemprop="prepTime"]').attr('content'));
    const cookTime = parseIsoDuration($('[itemprop="cookTime"]').attr('content'));
    const totalTime = parseIsoDuration($('[itemprop="totalTime"]').attr('content'))
      ?? this.parseTime($('.post-recipe-time').first().text());

    // Servings
    const servings = this.parseServings($('[itemprop="recipeYield"]').text())
      ?? this.parseServings($('.recipe-info').text());

    return {
      sourceId: this.slugFromUrl(url),
      sourceUrl: url,
      sourceSite: 'aniagotuje',
      title,
      rawIngredients,
      steps,
      prepTimeMinutes: prepTime,
      cookTimeMinutes: cookTime,
      totalTimeMinutes: totalTime ?? (prepTime && cookTime ? prepTime + cookTime : undefined),
      servings,
      rating,
      ratingCount,
      imageUrl: $('meta[property="og:image"]').attr('content') ?? undefined,
      category: $('meta[property="article:section"]').attr('content') ?? undefined,
    };
  }

}
