/**
 * Step 1: Orchestrate all scrapers and save raw data to data/raw/{site}.json.
 *
 * Supports:
 *   --site=NAME   Scrape only one specific site
 *   --resume       Skip already-scraped URLs (from progress tracker)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SITE_CONFIGS, PIPELINE_CONFIG } from '../config';
import { loadProgress, saveProgress, markSiteUrl, isSiteUrlDone, updateStep } from '../progress';
import type { RawRecipe, SiteName } from '../types';
import { AniaGotujeScraper } from '../scrapers/aniagotuje';
import { KwestiaSmakuScraper } from '../scrapers/kwestiasmaku';
import { DietetykPowszechnyScraper } from '../scrapers/dietetykpowszechny';
import { JadlonomiaScraper } from '../scrapers/jadlonomia';
import { PaleoSmakScraper } from '../scrapers/paleosmak';
import type { BaseScraper } from '../scrapers/base';

// ─── Scraper factory ────────────────────────────────────────────────────────

function createScraper(site: SiteName): BaseScraper {
  const config = SITE_CONFIGS[site];
  switch (site) {
    case 'aniagotuje':
      return new AniaGotujeScraper(config);
    case 'kwestiasmaku':
      return new KwestiaSmakuScraper(config);
    case 'dietetykpowszechny':
      return new DietetykPowszechnyScraper(config);
    case 'jadlonomia':
      return new JadlonomiaScraper(config);
    case 'paleosmak':
      return new PaleoSmakScraper(config);
    default:
      throw new Error(`Unknown site: ${site}`);
  }
}

// ─── File helpers ───────────────────────────────────────────────────────────

const rootDir = path.resolve(__dirname, '..', '..', '..');

function rawFilePath(site: SiteName): string {
  return path.join(rootDir, PIPELINE_CONFIG.rawDir, `${site}.json`);
}

function loadExistingRaw(site: SiteName): RawRecipe[] {
  const filePath = rawFilePath(site);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawRecipe[];
    }
  } catch {
    console.warn(`[step1] Could not load existing raw file for ${site}, starting fresh.`);
  }
  return [];
}

function saveRawRecipes(site: SiteName, recipes: RawRecipe[]): void {
  const filePath = rawFilePath(site);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(recipes, null, 2), 'utf-8');
}

// ─── Step 1 ─────────────────────────────────────────────────────────────────

export async function step1(opts?: { resume?: boolean; site?: string }): Promise<void> {
  const resume = opts?.resume ?? false;
  const siteFilter = opts?.site as SiteName | undefined;

  console.log('\n=== STEP 1: SCRAPE ===');
  console.log(`  Resume: ${resume}`);
  if (siteFilter) console.log(`  Site filter: ${siteFilter}`);

  const progress = loadProgress();
  updateStep(progress, 1);

  // Determine which sites to scrape
  const sites = Object.values(SITE_CONFIGS)
    .filter((cfg) => cfg.enabled)
    .filter((cfg) => !siteFilter || cfg.name === siteFilter);

  if (sites.length === 0) {
    console.error('[step1] No matching enabled sites found.');
    return;
  }

  let totalScraped = 0;

  for (const siteConfig of sites) {
    const site = siteConfig.name;
    console.log(`\n[step1] Processing site: ${site}`);

    // Build skip set from progress when resuming
    const skipUrls = new Set<string>();
    if (resume) {
      const completed = progress.scraped[site].completed;
      for (const url of completed) {
        skipUrls.add(url);
      }
      console.log(`  Resuming: ${skipUrls.size} URLs already done`);
    }

    // Load existing raw recipes when resuming
    let recipes: RawRecipe[] = resume ? loadExistingRaw(site) : [];
    const existingUrls = new Set(recipes.map((r) => r.sourceUrl));

    // Create scraper and run
    const scraper = createScraper(site);
    let siteCount = 0;

    try {
      const newRecipes = await scraper.scrapeAll(skipUrls, (recipe, url) => {
        // Avoid duplicates in the output array
        if (!existingUrls.has(recipe.sourceUrl)) {
          recipes.push(recipe);
          existingUrls.add(recipe.sourceUrl);
        }

        // Update progress
        markSiteUrl(progress, site, url);
        siteCount++;

        // Periodic save (every 25 recipes)
        if (siteCount % 25 === 0) {
          saveRawRecipes(site, recipes);
          saveProgress(progress);
          console.log(`  [${site}] Checkpoint: ${recipes.length} total recipes saved`);
        }
      });

      // If scraper returned recipes but callback didn't catch them (shouldn't happen, but safety)
      for (const recipe of newRecipes) {
        if (!existingUrls.has(recipe.sourceUrl)) {
          recipes.push(recipe);
          existingUrls.add(recipe.sourceUrl);
        }
      }
    } catch (err) {
      console.error(`[step1] Fatal error scraping ${site}:`, err instanceof Error ? err.message : err);
      // Save whatever we have so far
      saveRawRecipes(site, recipes);
      saveProgress(progress);
      console.log(`  [${site}] Saved ${recipes.length} recipes before error`);
      continue;
    }

    // Final save for this site
    saveRawRecipes(site, recipes);
    progress.scraped[site].total = recipes.length;
    saveProgress(progress);

    totalScraped += recipes.length;
    console.log(`[step1] ${site}: ${recipes.length} recipes saved to ${rawFilePath(site)}`);
  }

  console.log(`\n[step1] Done. Total recipes scraped: ${totalScraped}`);
}
