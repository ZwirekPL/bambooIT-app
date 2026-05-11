/**
 * Scraper for jadlonomia.com
 * Tech: WordPress — vegetarian/vegan focus
 * ~800+ recipes, auto-flag: vegetarian=true
 */

import { BaseScraper } from './base';
import { fetchHtml, delay } from '../utils/http';
import { extractAndParseRecipe } from '../utils/jsonLd';
import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import type { CheerioAPI } from 'cheerio';

// Jadlonomia categories
const CATEGORIES = [
  'przepisy/rodzaj_dania/sniadania',
  'przepisy/rodzaj_dania/zupy',
  'przepisy/rodzaj_dania/dania-glowne',
  'przepisy/rodzaj_dania/przystawki',
  'przepisy/rodzaj_dania/do-chleba',
  'przepisy/rodzaj_dania/lunche-do-pracy',
  'przepisy/rodzaj_dania/ciasta-i-desery',
  'przepisy/rodzaj_dania/napoje',
  'przepisy/rodzaj_dania/sosy-i-dodatki',
  'przepisy/category/przepisy',
];

export class JadlonomiaScraper extends BaseScraper {
  readonly siteName: SiteName = 'jadlonomia';
  readonly baseUrl = 'https://jadlonomia.com';

  constructor(config: SiteConfig) {
    super(config);
  }

  async *getRecipeUrls(): AsyncGenerator<string> {
    const seenUrls = new Set<string>();

    for (const category of CATEGORIES) {
      let page = 1;
      const maxPages = 30;

      while (page <= maxPages) {
        const listUrl = page === 1
          ? `${this.baseUrl}/${category}/`
          : `${this.baseUrl}/${category}/page/${page}/`;

        try {
          await delay(this.config.rateLimit);
          const $ = await fetchHtml(listUrl);

          const links: string[] = [];
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (
              href &&
              href.startsWith(`${this.baseUrl}/przepisy/`) &&
              !href.includes('/page/') &&
              !href.includes('/rodzaj_dania/') &&
              !href.includes('/category/') &&
              !href.includes('/dieta/') &&
              !href.includes('/skladnik/') &&
              !href.endsWith('/przepisy/') &&
              !seenUrls.has(href)
            ) {
              seenUrls.add(href);
              links.push(href);
            }
          });

          if (links.length === 0) break;

          for (const link of links) {
            yield link;
          }

          page++;
        } catch {
          break;
        }
      }
    }
  }

  async scrapeRecipe(url: string, $: CheerioAPI): Promise<RawRecipe | null> {
    // Try JSON-LD first (unified parser)
    const parsed = extractAndParseRecipe($);
    if (parsed) {
      return {
        sourceId: this.slugFromUrl(url),
        sourceUrl: url,
        sourceSite: 'jadlonomia',
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
    // Jadlonomia uses microdata itemprop="recipeIngredient"
    $('[itemprop="recipeIngredient"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length < 200) rawIngredients.push(text);
    });
    // Fallback: entry-content ul li
    if (rawIngredients.length === 0) {
      $('.entry-content ul li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 200 && !text.includes('http') && /\d/.test(text)) rawIngredients.push(text);
      });
    }

    const steps: string[] = [];
    // Jadlonomia: steps in itemprop="recipeInstructions" or entry-content ol/p
    $('[itemprop="recipeInstructions"] li, [itemprop="recipeInstructions"] p').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 15) steps.push(text);
    });
    if (steps.length === 0) {
      // Fallback: instruction-like paragraphs
      $('.entry-content p').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 30 && /ugotuj|pokrój|dodaj|wymieszaj|podsmaż|piecz|smaż|podawaj|wlej|zagotuj|odstaw/i.test(text)) {
          const sentences = text.split(/(?<=[.!])\s+/).filter(s => s.length > 10);
          steps.push(...sentences);
        }
      });
    }
    // Already handled above, skip old stepSelectors
    const stepSelectors: string[] = [];
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
      sourceSite: 'jadlonomia',
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
