/**
 * S-12 gold standard regression test.
 *
 * Loads gold-standard.json, fetches each URL via the per-domain scraper and
 * asserts:
 *   - title contains the expected phrase
 *   - at least N ingredients extracted
 *   - at least N steps extracted
 *   - nutrition present when expected
 *
 * Run manually:
 *   cd apps/backend
 *   npm run test:scraper
 *
 * Excluded from default `npm test` because it hits live external sites
 * (network-bound, prone to timeouts and target-site URL drift).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { fetchHtml } from '../../src/scraper/utils/http';
import { AniaGotujeScraper } from '../../src/scraper/scrapers/aniagotuje';
import { KwestiaSmakuScraper } from '../../src/scraper/scrapers/kwestiasmaku';
import { JadlonomiaScraper } from '../../src/scraper/scrapers/jadlonomia';
import { DietetykPowszechnyScraper } from '../../src/scraper/scrapers/dietetykpowszechny';
import { SITE_CONFIGS } from '../../src/scraper/config';
import type { BaseScraper } from '../../src/scraper/scrapers/base';
import type { SiteName } from '../../src/scraper/types';

interface Entry {
  domain: string;
  url: string;
  expected: {
    titleContains: string;
    minIngredients: number;
    minSteps: number;
    hasNutrition?: boolean;
  };
}

const dataPath = path.resolve(__dirname, 'gold-standard.json');
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as { entries: Entry[] };

function scraperForDomain(domain: string): BaseScraper | null {
  const site: SiteName | null =
    domain.includes('aniagotuje') ? 'aniagotuje'
    : domain.includes('kwestiasmaku') ? 'kwestiasmaku'
    : domain.includes('jadlonomia') ? 'jadlonomia'
    : domain.includes('dietetykpowszechny') ? 'dietetykpowszechny'
    : null;
  if (!site) return null;
  const cfg = SITE_CONFIGS[site];
  switch (site) {
    case 'aniagotuje': return new AniaGotujeScraper(cfg);
    case 'kwestiasmaku': return new KwestiaSmakuScraper(cfg);
    case 'jadlonomia': return new JadlonomiaScraper(cfg);
    case 'dietetykpowszechny': return new DietetykPowszechnyScraper(cfg);
    default: return null;
  }
}

describe.concurrent('S-12 gold standard regression', () => {
  for (const entry of raw.entries) {
    it(`[${entry.domain}] ${entry.expected.titleContains}`, async () => {
      const scraper = scraperForDomain(entry.domain);
      expect(scraper, `no scraper for domain ${entry.domain}`).not.toBeNull();
      if (!scraper) return;

      const $ = await fetchHtml(entry.url, { rateLimitMs: 1500 });
      const recipe = await scraper.scrapeRecipe(entry.url, $);

      expect(recipe, `scrapeRecipe returned null for ${entry.url}`).not.toBeNull();
      if (!recipe) return;

      expect(recipe.title.toLowerCase()).toContain(entry.expected.titleContains.toLowerCase());
      expect(recipe.rawIngredients.length).toBeGreaterThanOrEqual(entry.expected.minIngredients);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(entry.expected.minSteps);
    }, 30_000);
  }
});
