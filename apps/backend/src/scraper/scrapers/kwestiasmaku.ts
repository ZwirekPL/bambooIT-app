/**
 * Scraper for kwestiasmaku.com
 * Tech: Drupal CMS, static HTML
 * ~5000+ recipes, NO nutritional data, has ratings
 * Categories: /przepisy/[category-slug], pagination: ?page=N
 */

import { BaseScraper } from './base';
import { fetchHtml, delay } from '../utils/http';
import { extractAndParseRecipe } from '../utils/jsonLd';
import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import type { CheerioAPI } from 'cheerio';

// We discover categories dynamically from /przepisy page

export class KwestiaSmakuScraper extends BaseScraper {
  readonly siteName: SiteName = 'kwestiasmaku';
  readonly baseUrl = 'https://www.kwestiasmaku.com';

  constructor(config: SiteConfig) {
    super(config);
  }

  async *getRecipeUrls(): AsyncGenerator<string> {
    const seenUrls = new Set<string>();

    // Step 1: Discover all micro-categories from /przepisy page
    console.log('[kwestiasmaku] Discovering categories from /przepisy...');
    await delay(this.config.rateLimit);
    const $main = await fetchHtml(`${this.baseUrl}/przepisy`);
    const categories: string[] = [];
    $main('a[href*="/przepisy/"]').each((_, el) => {
      const href = $main(el).attr('href');
      if (href) {
        const full = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        if (!categories.includes(full) && full !== `${this.baseUrl}/przepisy`) {
          categories.push(full);
        }
      }
    });
    console.log(`[kwestiasmaku] Found ${categories.length} categories`);

    // Step 2: For each category, collect recipe links
    for (const catUrl of categories) {
      try {
        await delay(this.config.rateLimit);
        const $ = await fetchHtml(catUrl);

        // Collect /przepis/[slug] links (new format)
        $('a[href*="/przepis/"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('/przepis/') && !href.includes('/przepisy/')) {
            const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
            if (!seenUrls.has(fullUrl)) {
              seenUrls.add(fullUrl);
            }
          }
        });

        // Collect old format /[category]/[name]/przepis.html links
        $('a[href$="/przepis.html"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
            if (!seenUrls.has(fullUrl)) {
              seenUrls.add(fullUrl);
            }
          }
        });

        // Also check pagination within category
        let page = 1;
        const maxPages = 10;
        while (page < maxPages) {
          const pageUrl = `${catUrl}?page=${page}`;
          try {
            await delay(this.config.rateLimit);
            const $p = await fetchHtml(pageUrl);
            let found = 0;

            $p('a[href*="/przepis/"]').each((__, el) => {
              const href = $p(el).attr('href');
              if (href && href.includes('/przepis/') && !href.includes('/przepisy/')) {
                const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                if (!seenUrls.has(fullUrl)) {
                  seenUrls.add(fullUrl);
                  found++;
                }
              }
            });

            $p('a[href$="/przepis.html"]').each((__, el) => {
              const href = $p(el).attr('href');
              if (href) {
                const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                if (!seenUrls.has(fullUrl)) {
                  seenUrls.add(fullUrl);
                  found++;
                }
              }
            });

            if (found === 0) break;
            page++;
          } catch {
            break;
          }
        }
      } catch {
        // Skip failed categories silently
      }
    }

    console.log(`[kwestiasmaku] Collected ${seenUrls.size} unique recipe URLs`);

    // Yield all collected URLs
    for (const url of seenUrls) {
      yield url;
    }
  }

  async scrapeRecipe(url: string, $: CheerioAPI): Promise<RawRecipe | null> {
    // Try JSON-LD first (unified parser)
    const parsed = extractAndParseRecipe($);
    if (parsed) {
      return {
        sourceId: this.slugFromUrl(url),
        sourceUrl: url,
        sourceSite: 'kwestiasmaku',
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

    // Fallback: HTML parsing
    const title = $('h1.przepis').first().text().trim()
      || $('h1').first().text().trim();
    if (!title) return null;

    const rawIngredients: string[] = [];
    $('.field-name-field-skladniki li, .skladniki li, .group-skladniki li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) rawIngredients.push(text);
    });

    // If no ingredients found with specific selectors, try generic
    if (rawIngredients.length === 0) {
      $('ul li').each((_, el) => {
        const text = $(el).text().trim();
        // Heuristic: ingredient lines typically contain numbers/units
        if (text && /\d/.test(text) && text.length < 100) {
          rawIngredients.push(text);
        }
      });
    }

    const steps: string[] = [];
    $('.field-name-field-przygotowanie p, .field-name-body p, .przygotowanie p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) steps.push(text);
    });

    // Rating
    let rating: number | undefined;
    let ratingCount: number | undefined;
    const ratingEl = $('[class*="rating"] [class*="average"], .fivestar-average-stars');
    if (ratingEl.length) {
      const ratingText = ratingEl.attr('title') ?? ratingEl.text();
      const match = ratingText.match(/([\d.]+)/);
      if (match) rating = parseFloat(match[1]);
    }
    const countEl = $('[class*="rating"] [class*="count"], .fivestar-summary .total-votes');
    if (countEl.length) {
      const match = countEl.text().match(/(\d+)/);
      if (match) ratingCount = parseInt(match[1], 10);
    }

    // Time
    const timeText = $('.field-name-field-czas-przygotowania, [class*="czas"]').first().text();

    // Servings
    const servingsText = $('.field-name-field-porcje, [class*="porcj"]').first().text();

    // Category
    const category = $('nav.breadcrumb a, .breadcrumb a').last().text().trim() || undefined;

    return {
      sourceId: this.slugFromUrl(url),
      sourceUrl: url,
      sourceSite: 'kwestiasmaku',
      title,
      rawIngredients,
      steps,
      prepTimeMinutes: this.parseTime(timeText),
      totalTimeMinutes: this.parseTime(timeText),
      servings: this.parseServings(servingsText),
      rating,
      ratingCount,
      imageUrl: $('meta[property="og:image"]').attr('content') ?? undefined,
      category,
    };
  }

}
