/**
 * Smoke test: fetch robots.txt for our scraped domains and verify the parser
 * + isAllowed decisions on a sample recipe URL per domain.
 *
 * No DB access. Network only.
 */

import { getRobotsForHost, isAllowed, crawlDelayMs, _clearRobotsCache } from '../src/scraper/utils/robotsTxt';
import { USER_AGENT } from '../src/scraper/utils/http';

const SAMPLES: Array<{ host: string; testUrl: string }> = [
  { host: 'aniagotuje.pl', testUrl: 'https://aniagotuje.pl/przepis/faworki' },
  { host: 'kwestiasmaku.com', testUrl: 'https://www.kwestiasmaku.com/przepis/szarlotka' },
  { host: 'jadlonomia.com', testUrl: 'https://jadlonomia.com/przepisy/dyniowe-pancakes/' },
  { host: 'dietetykpowszechny.pl', testUrl: 'https://dietetykpowszechny.pl/pasta-na-kanapki-z-pieczonej-dyni-i-fety/' },
  { host: 'www.mojegotowanie.pl', testUrl: 'https://www.mojegotowanie.pl/przepis/muffinki-jajeczne' },
];

async function main() {
  _clearRobotsCache();
  console.log('=== robots.txt audit ===');
  console.log(`Using User-Agent: ${USER_AGENT}\n`);

  for (const { host, testUrl } of SAMPLES) {
    process.stdout.write(`${host.padEnd(28)} `);
    try {
      const rules = await getRobotsForHost(host, USER_AGENT);
      if (rules.unavailable) {
        console.log('NO robots.txt (treated as permissive)');
        continue;
      }
      const allowed = isAllowed(rules, testUrl, USER_AGENT);
      const delay = crawlDelayMs(rules, USER_AGENT);
      const groups = Object.keys(rules.groups).filter((g) => g !== '*');
      console.log(
        `${allowed ? 'ALLOWED' : 'BLOCKED'} | crawl-delay=${delay}ms | agents=${groups.length} + * | test=${testUrl.replace(/^https?:\/\/[^/]+/, '')}`
      );

      // Detail for * group
      const star = rules.groups['*'];
      if (star) {
        console.log(`    * allows: ${star.allows.length}, disallows: ${star.disallows.length}${star.crawlDelaySec ? `, crawl-delay=${star.crawlDelaySec}s` : ''}`);
      }
    } catch (e) {
      console.log(`ERROR ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
