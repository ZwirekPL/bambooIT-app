/**
 * Scraper for paleosmak.pl
 * Tech: WordPress — paleo/gluten-free focus
 * ~300+ recipes, auto-flag: glutenFree=true
 */

import { BaseScraper } from './base';
import { fetchHtml, delay } from '../utils/http';
import { extractAndParseRecipe } from '../utils/jsonLd';
import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import type { CheerioAPI } from 'cheerio';

// Paleosmak lists recipes on /przepisy/ with pagination /przepisy/page/N/

export class PaleoSmakScraper extends BaseScraper {
  readonly siteName: SiteName = 'paleosmak';
  readonly baseUrl = 'https://paleosmak.pl';

  constructor(config: SiteConfig) {
    super(config);
  }

  async *getRecipeUrls(): AsyncGenerator<string> {
    const seenUrls = new Set<string>();
    const skipPatterns = ['/page/', '/kategoria/', '/tag/', '/author/', '/badania', '/kontakt', '/o-mnie', '/polityka', '/koszyk', '/sklep'];

    // Paginate through /przepisy/ and /przepisy/page/N/
    let page = 1;
    const maxPages = 40;

    while (page <= maxPages) {
      const listUrl = page === 1
        ? `${this.baseUrl}/przepisy/`
        : `${this.baseUrl}/przepisy/page/${page}/`;

      try {
        await delay(this.config.rateLimit);
        const $ = await fetchHtml(listUrl);

        let found = 0;
        $('article a[href], h2 a[href], h3 a[href], .entry-title a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (
            href &&
            href.startsWith(this.baseUrl) &&
            !skipPatterns.some(p => href.includes(p)) &&
            !href.endsWith('/przepisy/') &&
            !href.includes('#') &&
            !seenUrls.has(href)
          ) {
            seenUrls.add(href);
            found++;
          }
        });

        if (found === 0) break;
        page++;
      } catch {
        break;
      }
    }

    console.log(`[paleosmak] Collected ${seenUrls.size} unique recipe URLs`);

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
        sourceSite: 'paleosmak',
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

    const title = $('h1.entry-title, h1').first().text().trim();
    if (!title) return null;

    const rawIngredients: string[] = [];
    const selectors = [
      '.wprm-recipe-ingredient',
      '.recipe-ingredients li',
      '.entry-content ul li',
    ];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 200 && !text.includes('http')) rawIngredients.push(text);
      });
      if (rawIngredients.length > 0) break;
    }

    const steps: string[] = [];
    const stepSelectors = [
      '.wprm-recipe-instruction',
      '.recipe-instructions li',
      '.entry-content ol li',
    ];
    for (const sel of stepSelectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10) steps.push(text);
      });
      if (steps.length > 0) break;
    }

    return {
      sourceId: this.slugFromUrl(url),
      sourceUrl: url,
      sourceSite: 'paleosmak',
      title,
      rawIngredients,
      steps,
      totalTimeMinutes: this.parseTime($('.wprm-recipe-total-time-container, [class*="czas"]').first().text()),
      servings: this.parseServings($('.wprm-recipe-servings, [class*="porcj"]').first().text()),
      imageUrl: $('meta[property="og:image"]').attr('content') ?? undefined,
      category: $('[rel="tag"]').first().text().trim() || undefined,
    };
  }

}
