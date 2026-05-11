/**
 * Scraper for dietetykpowszechny.pl
 * Tech: WordPress + Elementor
 * ~490 recipes, has full macros per serving, exact grams
 * URL: /przepisy/ with pagination /przepisy/page/N/
 * Recipe URLs: /[recipe-slug]/
 */

import { BaseScraper } from './base';
import { fetchHtml, delay } from '../utils/http';
import type { RawRecipe, SiteName } from '../types';
import type { SiteConfig } from '../types';
import type { CheerioAPI } from 'cheerio';

export class DietetykPowszechnyScraper extends BaseScraper {
  readonly siteName: SiteName = 'dietetykpowszechny';
  readonly baseUrl = 'https://dietetykpowszechny.pl';

  constructor(config: SiteConfig) {
    super(config);
  }

  async *getRecipeUrls(): AsyncGenerator<string> {
    let page = 1;
    const maxPages = 55; // ~490 recipes / 10 per page

    while (page <= maxPages) {
      const listUrl = page === 1
        ? `${this.baseUrl}/przepisy/`
        : `${this.baseUrl}/przepisy/page/${page}/`;

      try {
        await delay(this.config.rateLimit);
        const $ = await fetchHtml(listUrl);

        const links: string[] = [];
        // WordPress post links in article/archive
        $('article a[href], .post a[href], h2 a[href], h3 a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (
            href &&
            href.startsWith(this.baseUrl) &&
            !href.includes('/przepisy/page/') &&
            !href.includes('/kategoria/') &&
            !href.endsWith('/przepisy/') &&
            !href.match(/\/przepisy\/(sniadania|obiady|kolacje|desery|przekaski|zupy|napoje)\/?$/) &&
            !href.match(/\/\d{4}\/\d{2}\/\d{2}\/?$/) && // skip date archive pages
            !href.match(/\/\d{4}\/\d{2}\/?$/) &&          // skip month archive pages
            href !== this.baseUrl + '/'
          ) {
            if (!links.includes(href)) links.push(href);
          }
        });

        if (links.length === 0) {
          console.log(`[dietetykpowszechny] No links on page ${page}, stopping.`);
          break;
        }

        for (const link of links) {
          yield link;
        }

        page++;
      } catch (err) {
        console.error(`[dietetykpowszechny] Error on page ${page}:`, err instanceof Error ? err.message : err);
        break;
      }
    }
  }

  async scrapeRecipe(url: string, $: CheerioAPI): Promise<RawRecipe | null> {
    const title = $('h1').first().text().trim()
      || $('h1.entry-title').first().text().trim();
    if (!title) return null;

    // ─── Ingredients ──────────────────────────────────────────────────
    // Structure: <h2>Składniki (1 porcja):</h2><ul><li>50 g komosy...</li></ul>
    const rawIngredients: string[] = [];

    // Find the <ul> that follows a heading containing "Składniki" or "składniki"
    $('h2, h3').each((_, heading) => {
      const headingText = $(heading).text().toLowerCase();
      if (headingText.includes('składnik')) {
        // Get the next <ul> after this heading
        const ul = $(heading).nextAll('ul').first();
        if (ul.length === 0) {
          // Try parent's next sibling (Elementor wraps elements differently)
          const parentWidget = $(heading).closest('.elementor-widget-container');
          if (parentWidget.length) {
            parentWidget.find('ul li').each((__, li) => {
              const text = $(li).text().trim();
              if (text && text.length < 150 && !text.match(/kalory|kcal|białko|tłuszcz|węglowodan/i)) {
                rawIngredients.push(text);
              }
            });
          }
        } else {
          ul.find('li').each((__, li) => {
            const text = $(li).text().trim();
            if (text && text.length < 150 && !text.match(/kalory|kcal|białko|tłuszcz|węglowodan/i)) {
              rawIngredients.push(text);
            }
          });
        }
      }
    });

    // Fallback: all <li> items with gram/ml patterns
    if (rawIngredients.length === 0) {
      $('li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && /\d+\s*g\b/.test(text) && text.length < 150 && !text.match(/kcal|białko|tłuszcz/i)) {
          rawIngredients.push(text);
        }
      });
    }

    // ─── Steps ────────────────────────────────────────────────────────
    // Structure: <h2>... opis przygotowania:</h2> followed by <p> with instructions
    const steps: string[] = [];

    $('h2, h3').each((_, heading) => {
      const headingText = $(heading).text().toLowerCase();
      if (headingText.includes('przygotowani') || headingText.includes('wykonani') || headingText.includes('sposób')) {
        // Get all <p> siblings after this heading
        $(heading).nextAll('p').each((__, p) => {
          const text = $(p).text().trim();
          if (text && text.length > 15) {
            // Split long paragraphs into sentences as steps
            const sentences = text.split(/(?<=[.!])\s+/).filter(s => s.length > 10);
            steps.push(...sentences);
          }
        });

        // Also check within the same elementor widget container
        if (steps.length === 0) {
          const parentWidget = $(heading).closest('.elementor-widget-container');
          if (parentWidget.length) {
            parentWidget.find('p').each((__, p) => {
              const text = $(p).text().trim();
              if (text && text.length > 15 && !text.match(/kalory|kcal/i)) {
                const sentences = text.split(/(?<=[.!])\s+/).filter(s => s.length > 10);
                steps.push(...sentences);
              }
            });
          }
        }
      }
    });

    // Fallback: look for instruction-like paragraphs in entry-content
    if (steps.length === 0) {
      const allText = $('.entry-content p, .elementor-widget-container p').map((_, el) => $(el).text().trim()).get();
      for (const text of allText) {
        if (text.length > 30 && /ugotuj|pokrój|dodaj|wymieszaj|podsmaż|piecz|gotuj|smaż|podawaj/i.test(text)) {
          const sentences = text.split(/(?<=[.!])\s+/).filter(s => s.length > 10);
          steps.push(...sentences);
        }
      }
    }

    // ─── Servings ─────────────────────────────────────────────────────
    // Extract from heading text like "Składniki (1 porcja):"
    let servings: number | undefined;
    $('h2, h3').each((_, heading) => {
      const text = $(heading).text();
      const match = text.match(/(\d+)\s*porcj/i);
      if (match) servings = parseInt(match[1], 10);
    });

    // ─── Time (not typically available on this site) ──────────────────
    const timeText = $('[class*="czas"], [class*="time"]').first().text();

    // Image
    const imageUrl = $('meta[property="og:image"]').attr('content')
      ?? $('article img').first().attr('src')
      ?? undefined;

    // Category from breadcrumbs or tags
    const category = $('nav.breadcrumb a, .breadcrumb a, [rel="tag"]').last().text().trim() || undefined;

    // Tags
    const tags: string[] = [];
    $('[rel="tag"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) tags.push(text);
    });

    return {
      sourceId: this.slugFromUrl(url),
      sourceUrl: url,
      sourceSite: 'dietetykpowszechny',
      title,
      rawIngredients,
      steps,
      prepTimeMinutes: this.parseTime(timeText),
      totalTimeMinutes: this.parseTime(timeText),
      servings: servings ?? 1,
      imageUrl,
      category,
      tags,
    };
  }
}
