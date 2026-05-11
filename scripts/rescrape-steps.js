/**
 * Re-scrape recipe instruction steps and categories from source URLs.
 *
 * Reads all Recipe rows from DB, fetches sourceUrl, parses steps + category
 * per domain, and UPSERTs into RecipeInstructionStep + Recipe.category.
 *
 * Usage:
 *   node scripts/rescrape-steps.js [--dry-run] [--domain aniagotuje] [--limit 10] [--offset 0]
 *
 * Prerequisites:
 *   - DATABASE_URL set (or .env in packages/database)
 *   - npm install (cheerio already in backend deps)
 */

const { PrismaClient } = require("@prisma/client");
const cheerio = require("cheerio");

const prisma = new PrismaClient();

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const DOMAIN_FILTER = args.includes("--domain")
  ? args[args.indexOf("--domain") + 1]
  : null;
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : 0;
const OFFSET = args.includes("--offset")
  ? parseInt(args[args.indexOf("--offset") + 1], 10)
  : 0;

// ── Config ──────────────────────────────────────────────────────────────────
const RETRY_MODE = args.includes("--retry-failed");
const CONCURRENCY = RETRY_MODE ? 2 : 5;
const DELAY_MS = RETRY_MODE ? 2000 : 300; // per-request throttle
const TIMEOUT_MS = 15000;
const MAX_RETRIES = RETRY_MODE ? 4 : 2;

// Stats
const stats = {
  total: 0,
  fetched: 0,
  stepsUpdated: 0,
  categoryUpdated: 0,
  errors: 0,
  skipped: 0,
};

// ── Domain parsers ──────────────────────────────────────────────────────────

function getDomain(url) {
  if (url.includes("aniagotuje.pl")) return "aniagotuje";
  if (url.includes("kwestiasmaku.com")) return "kwestiasmaku";
  if (url.includes("jadlonomia.com")) return "jadlonomia";
  if (url.includes("dietetykpowszechny.pl")) return "dietetykpowszechny";
  return "unknown";
}

/**
 * aniagotuje.pl
 * Steps: div.step > div.step-name + div.step-text (schema.org HowToStep)
 * Category: ol.breadcrumb > li > a (2nd item)
 */
function parseAniagotuje($) {
  const steps = [];

  // PRIMARY: structured div.step elements (schema.org HowToStep)
  $("div.step").each((i, el) => {
    const nameEl = $(el).find(".step-name");
    const textEl = $(el).find(".step-text");

    let name = nameEl.text().trim().replace(/^Krok\s*\d+:\s*/i, "");
    const textClone = textEl.clone();
    textClone.find("img, .img-placeholder, div[style]").remove();
    let text = textClone
      .find("p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean)
      .join("\n");
    if (!text) text = textClone.text().trim();

    if (text) {
      const instruction = name ? `${name}: ${text}` : text;
      steps.push(instruction);
    }
  });

  // FALLBACK: if no structured steps, extract from article-content paragraphs.
  // Many aniagotuje recipes have instructions as prose in <p> tags.
  // We skip: article-intro, nutritional info, and very short paragraphs.
  if (steps.length === 0) {
    let passedNutrition = false;
    $(".article-content p, .article-body p").each((_, el) => {
      const text = $(el).text().trim();
      const parentClass = $(el).parent().attr("class") || "";

      // Skip intro section
      if (parentClass.includes("article-intro")) return;
      // Skip comments, vote, social sections
      if (parentClass.includes("comment") || parentClass.includes("vote") || parentClass.includes("social")) return;

      // Detect nutritional info block — skip it, but mark that we've passed it
      if (
        text.includes("Wartość energetyczna") ||
        text.includes("kcal") ||
        text.includes("Czas przygotowania") ||
        text.includes("Liczba porcji")
      ) {
        passedNutrition = true;
        return;
      }

      // Only collect paragraphs AFTER the nutrition/meta block
      if (!passedNutrition) return;

      // Skip short paragraphs (tips about cup size, calorie disclaimers, etc.)
      if (text.length < 40) return;
      // Skip known non-instruction patterns
      if (text.startsWith("Szklanka ma u mnie")) return;
      if (text.startsWith("Kalorie policzone")) return;
      if (text.includes("Gorąco polecam")) return;
      if (text.includes("Czytaj dalej")) return;
      if (text.includes("REKLAMA")) return;

      steps.push(text);
    });
  }

  // Category from breadcrumbs
  let category = null;
  const breadcrumbs = $("ol.breadcrumb .breadcrumb-item")
    .not(".active")
    .find("a")
    .map((_, a) => $(a).text().trim())
    .get();
  if (breadcrumbs.length >= 2) {
    category = breadcrumbs[1];
  }

  return { steps, category };
}

/**
 * kwestiasmaku.com
 * Steps: <h3>Przygotowanie</h3> followed by <ul><li>...</li></ul>
 * Category: links to /blog-kulinarny/category/XXX — pick first "Dania główne"-like one
 */
function parseKwestiasmaku($) {
  const steps = [];

  // Find "Przygotowanie" heading and get the list items after it
  let foundPrep = false;
  $("h3").each((_, h3) => {
    if ($(h3).text().trim().toLowerCase().includes("przygotowanie")) {
      foundPrep = true;
    }
  });

  if (foundPrep) {
    // Get all li items in the recipe content area after Przygotowanie
    let collecting = false;
    $("h3, li, ol, ul").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === "h3") {
        const text = $(el).text().trim().toLowerCase();
        if (text.includes("przygotowanie")) {
          collecting = true;
          return;
        }
        if (collecting && !text.includes("przygotowanie")) {
          collecting = false;
          return;
        }
      }
      if (collecting && tag === "li") {
        const text = $(el).text().trim();
        if (text.length > 10) steps.push(text);
      }
    });
  }

  // Category from field-name-field-przepisy taxonomy reference (recipe-specific)
  let category = null;
  $(".field-name-field-przepisy a").each((_, a) => {
    const href = $(a).attr("href") || "";
    const text = $(a).text().trim();
    if (href.includes("/blog-kulinarny/category/") && text.length > 2) {
      // Pick the first food-category, skip diet labels
      if (!category) category = text;
    }
  });

  // Fallback: season-links-row (recipe-specific section)
  if (!category) {
    $(".season-links-row a").each((_, a) => {
      const href = $(a).attr("href") || "";
      const text = $(a).text().trim();
      if (href.includes("/blog-kulinarny/category/") && text.length > 2) {
        if (!category) category = text;
      }
    });
  }

  // Fallback: /przepisy/CATEGORY links near recipe content
  if (!category) {
    $('a[href*="/kuchnia_polska/"], a[href*="/przepisy/"]').each((_, a) => {
      const text = $(a).text().trim();
      if (text.length > 2 && text.length < 30 && !category) {
        // Skip navigation-level items
        const parent = $(a).closest(".depth_0, .depth_1, .depth_2, nav, .menu");
        if (parent.length === 0) category = text;
      }
    });
  }

  return { steps, category };
}

/**
 * jadlonomia.com
 * Steps: heading containing "Przygotowanie" → <ol><li> items
 * Category: rel="tag" links (pick food-related, not ingredient tags)
 */
function parseJadlonomia($) {
  const steps = [];

  // Jadlonomia uses <ol> for instruction steps in the recipe content.
  // The first <ol> with li items > 15 chars (not comments) is usually instructions.
  // Filter out comment-like ol (contains "pisze:", timestamps, etc.)
  $("ol").each((_, ol) => {
    if (steps.length > 0) return; // already found
    const items = $(ol).find("> li");
    if (items.length === 0) return;

    // Check if this looks like recipe steps (not comments)
    const firstText = items.first().text().trim();
    if (firstText.includes("pisze:") || firstText.includes("Odpowiedz")) return;
    if (firstText.length < 20) return;

    items.each((_, li) => {
      const text = $(li).text().trim();
      if (text.length > 15 && !text.includes("pisze:")) {
        steps.push(text);
      }
    });
  });

  // Category from rel="tag" — pick category-like tags (not ingredient names)
  let category = null;
  const categoryTags = [
    "zupy",
    "sałatki",
    "obiady",
    "śniadania",
    "kolacje",
    "desery",
    "przekąski",
    "napoje",
    "ciasta",
    "pieczywo",
    "sosy",
    "dania główne",
    "dania z patelni",
    "zapiekanki",
    "makaron",
    "risotto",
    "curry",
    "pizza",
    "burgery",
    "tortille",
    "smoothie",
    "koktajle",
    "przetwory",
    "dodatki",
  ];

  $('a[rel="tag"]').each((_, a) => {
    const text = $(a).text().trim().toLowerCase();
    if (!category && categoryTags.includes(text)) {
      category = $(a).text().trim();
    }
  });

  // Fallback: breadcrumbs (3rd item if available)
  if (!category) {
    const breadcrumbs = $(".breadcrumbs a")
      .map((_, a) => $(a).text().trim())
      .get();
    if (breadcrumbs.length >= 3) {
      category = breadcrumbs[2];
    }
  }

  return { steps, category };
}

/**
 * dietetykpowszechny.pl
 * Steps: heading with "opis przygotowania" or "przygotowanie" → <p> paragraphs
 * Category: body class "category-XXX" or articleSection from JSON-LD
 */
function parseDietetykpowszechny($) {
  const steps = [];

  // Find the heading containing "opis przygotowania" or "przygotowanie"
  // These are often inside <h3><strong>...</strong></h3> or just <h3>
  let foundHeading = false;
  $("h1, h2, h3, h4, h5").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (
      text.includes("opis przygotowania") ||
      text.includes("sposób przygotowania") ||
      (text.includes("przygotowanie") && !text.includes("składnik"))
    ) {
      foundHeading = true;

      // Collect text from siblings after this heading.
      // Structure: <h3> is inside a <div>, siblings are <p>, <div> etc.
      let next = $(el).next();
      for (let j = 0; j < 20 && next.length; j++) {
        const tag = next[0] && next[0].tagName ? next[0].tagName.toLowerCase() : "";
        // Stop at next heading or element containing one
        if (["h1", "h2", "h3", "h4", "h5"].includes(tag)) break;
        if (next.find("h1,h2,h3,h4,h5").length > 0) break;

        // Get text from the element — could be <p>, <div>, or nested
        const text = next.text().trim();
        if (text.length > 20) {
          // Split long paragraphs into sentences for steps
          const sentences = text
            .split(/(?<=[.!])\s+/)
            .filter((s) => s.length > 15);
          if (sentences.length > 1) {
            steps.push(...sentences);
          } else {
            steps.push(text);
          }
        }
        next = next.next();
      }
      return false; // break .each
    }
  });

  // Category — look in elementor wrapper classes or any element with category-*
  let category = null;
  const allHtml = $.html();
  // Match category-XXXX in class attributes (elementor wraps post in category-class)
  const catRegex = /class="[^"]*\bcategory-([a-z0-9-]+)\b/g;
  const ignoreCats = new Set(["przepisy", "post", "type"]);
  let match;
  while ((match = catRegex.exec(allHtml)) !== null) {
    const cat = match[1];
    if (!ignoreCats.has(cat) && cat.length > 2) {
      category = cat
        .replace(/-/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
      break;
    }
  }

  // Fallback: JSON-LD articleSection
  if (!category) {
    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const json = JSON.parse($(script).html());
        if (json["@graph"]) {
          json["@graph"].forEach((item) => {
            if (item.articleSection && item.articleSection.length > 0) {
              const sec = item.articleSection[0];
              if (sec.toLowerCase() !== "przepisy") {
                category = category || sec;
              }
            }
          });
        }
      } catch (e) {
        /* ignore parse errors */
      }
    });
  }

  return { steps, category };
}

// ── Parser registry ─────────────────────────────────────────────────────────
const parsers = {
  aniagotuje: parseAniagotuje,
  kwestiasmaku: parseKwestiasmaku,
  jadlonomia: parseJadlonomia,
  dietetykpowszechny: parseDietetykpowszechny,
};

// ── Fetch with retry ────────────────────────────────────────────────────────
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DietetykBot/1.0; recipe-enrichment)",
          Accept: "text/html",
          "Accept-Language": "pl,en;q=0.5",
        },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Process single recipe ───────────────────────────────────────────────────
async function processRecipe(recipe) {
  const { id, title, sourceUrl } = recipe;
  const domain = getDomain(sourceUrl);
  const parser = parsers[domain];

  if (!parser) {
    console.log(`  SKIP unknown domain: ${sourceUrl}`);
    stats.skipped++;
    return;
  }

  try {
    const html = await fetchWithRetry(sourceUrl);
    stats.fetched++;
    const $ = cheerio.load(html);
    const { steps, category } = parser($);

    if (DRY_RUN) {
      console.log(
        `  [DRY] ${title} → ${steps.length} steps, category="${category || "null"}"`
      );
      if (steps.length > 0)
        console.log(`    Step 1: ${steps[0].substring(0, 100)}...`);
      return;
    }

    // Update steps — delete old micro-fragments, insert proper steps
    if (steps.length > 0) {
      await prisma.$transaction([
        prisma.recipeInstructionStep.deleteMany({ where: { recipeId: id } }),
        ...steps.map((instruction, idx) =>
          prisma.recipeInstructionStep.create({
            data: {
              recipeId: id,
              stepNumber: idx + 1,
              instruction: instruction.trim(),
              phase: "prep",
            },
          })
        ),
      ]);
      stats.stepsUpdated++;
    }

    // Update category if found and not already set
    if (category) {
      await prisma.recipe.update({
        where: { id },
        data: { category },
      });
      stats.categoryUpdated++;
    }
  } catch (err) {
    console.error(`  ERROR ${title}: ${err.message}`);
    stats.errors++;
  }
}

// ── Process batch with concurrency ──────────────────────────────────────────
async function processBatch(recipes) {
  const queue = [...recipes];
  const workers = [];

  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const recipe = queue.shift();
          await processRecipe(recipe);
          await sleep(DELAY_MS);
        }
      })()
    );
  }

  await Promise.all(workers);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Recipe Steps & Categories Re-scraper ===");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}, Domain: ${DOMAIN_FILTER || "all"}, Limit: ${LIMIT || "all"}, Offset: ${OFFSET}`
  );

  // Build query
  const where = {};
  if (DOMAIN_FILTER) {
    where.sourceUrl = { contains: DOMAIN_FILTER };
  }
  if (RETRY_MODE) {
    where.category = null; // only recipes that failed (no category = not fetched)
  }

  const recipes = await prisma.recipe.findMany({
    where,
    select: { id: true, title: true, sourceUrl: true, category: true },
    orderBy: { title: "asc" },
    ...(LIMIT > 0 ? { take: LIMIT } : {}),
    ...(OFFSET > 0 ? { skip: OFFSET } : {}),
  });

  stats.total = recipes.length;
  console.log(`\nFound ${stats.total} recipes to process\n`);

  // Process in batches of 50 for progress reporting
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    const pct = Math.round((i / recipes.length) * 100);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipes.length / BATCH_SIZE)} (${pct}%)...`
    );
    await processBatch(batch);
  }

  console.log("\n=== DONE ===");
  console.log(`Total:            ${stats.total}`);
  console.log(`Fetched:          ${stats.fetched}`);
  console.log(`Steps updated:    ${stats.stepsUpdated}`);
  console.log(`Category updated: ${stats.categoryUpdated}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log(`Skipped:          ${stats.skipped}`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
