/**
 * Extract recipe instruction steps from aniagotuje.pl articles using GPT-4.1-mini.
 * Only processes recipes that don't already have steps.
 *
 * Usage:
 *   node scripts/gpt-extract-steps.js [--dry-run] [--limit 10]
 */

const { PrismaClient } = require("@prisma/client");
const { OpenAI } = require("openai");
const cheerio = require("cheerio");
require("dotenv").config({ path: __dirname + "/../apps/backend/.env" });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : 0;

// Config
const CONCURRENCY = 3;
const DELAY_MS = 500;
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const MIN_STEPS = 3; // don't save if fewer than 3 steps

const SYSTEM_PROMPT = `Jesteś asystentem kulinarnym. Na podstawie PEŁNEGO tekstu artykułu wyodrębnij WSZYSTKIE konkretne kroki przygotowania przepisu.

Zasady:
- Wypisz 3-20 kroków, każdy jako zwięzłą instrukcję (1-3 zdania)
- Uwzględnij WSZYSTKIE etapy: przygotowanie składników, gotowanie/pieczenie, dekorację, podanie
- NIGDY nie wymyślaj danych (temperatura, czas, ilość), których nie ma w tekście — jeśli brakuje, pomiń tę informację
- Każdy krok to JEDNA konkretna czynność — nie łącz wielu czynności w jeden krok
- POMIŃ: opisy smaku, osobiste anegdoty, rekomendacje innych przepisów, warianty, porady
- NIE dodawaj kroków typu "podawaj" jeśli nie ma konkretnych instrukcji podania
- Odpowiedz TYLKO jako JSON: {"steps": ["krok1", "krok2", ...]}`;

// Stats
const stats = {
  total: 0,
  fetched: 0,
  saved: 0,
  tooFewSteps: 0,
  errors: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DietetykBot/1.0; recipe-enrichment)",
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

async function extractArticleText(url) {
  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);

  let fullText = "";
  const bodyDiv = $(".article-content-body");
  if (bodyDiv.length > 0) {
    const clone = bodyDiv.clone();
    clone.find("img, .img-placeholder, div[style*='padding-bottom'], .adsbygoogle, .vote, .share-ingredients, .copy-share-lock-con, .wake-photo-con, .nutrition-info, script, style").remove();
    fullText = clone.text().trim().replace(/\s+/g, " ");
  } else {
    $(".article-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10) fullText += text + "\n\n";
    });
  }

  const ingredients = [];
  $("[itemprop='recipeIngredient']").each((_, el) => {
    ingredients.push($(el).text().trim());
  });

  const title = $("h1").first().text().trim();
  return { title, fullText, ingredients };
}

async function callGpt(title, fullText, ingredients) {
  const ingredientList =
    ingredients.length > 0 ? `\nSkładniki: ${ingredients.join(", ")}` : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Przepis: ${title}${ingredientList}\n\nPełny tekst artykułu:\n${fullText}`,
      },
    ],
  });

  const content = response.choices[0].message.content.trim();
  const usage = response.usage;
  stats.totalInputTokens += usage.prompt_tokens;
  stats.totalOutputTokens += usage.completion_tokens;

  try {
    const parsed = JSON.parse(content);
    return parsed.steps || [];
  } catch (e) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.steps || [];
    }
    return [];
  }
}

async function processRecipe(recipe) {
  try {
    const { title, fullText, ingredients } = await extractArticleText(recipe.sourceUrl);
    stats.fetched++;

    if (fullText.length < 100) {
      console.log(`  SKIP (too short): ${recipe.title}`);
      stats.tooFewSteps++;
      return;
    }

    const steps = await callGpt(title || recipe.title, fullText, ingredients);

    if (DRY_RUN) {
      console.log(`  [DRY] ${recipe.title} → ${steps.length} steps`);
      if (steps.length > 0) console.log(`    Step 1: ${steps[0].substring(0, 100)}`);
      return;
    }

    if (steps.length < MIN_STEPS) {
      console.log(`  SKIP (${steps.length} steps < ${MIN_STEPS}): ${recipe.title}`);
      stats.tooFewSteps++;
      return;
    }

    await prisma.$transaction([
      prisma.recipeInstructionStep.deleteMany({ where: { recipeId: recipe.id } }),
      ...steps.map((instruction, idx) =>
        prisma.recipeInstructionStep.create({
          data: {
            recipeId: recipe.id,
            stepNumber: idx + 1,
            instruction: instruction.trim(),
            phase: "prep",
          },
        })
      ),
    ]);
    stats.saved++;
  } catch (err) {
    console.error(`  ERROR ${recipe.title}: ${err.message}`);
    stats.errors++;
  }
}

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

async function main() {
  console.log("=== GPT Step Extraction (aniagotuje) ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}, Limit: ${LIMIT || "all"}`);

  // Get recipes without steps
  const withSteps = await prisma.recipeInstructionStep.findMany({
    select: { recipeId: true },
    distinct: ["recipeId"],
  });
  const withStepsIds = new Set(withSteps.map((r) => r.recipeId));

  let recipes = await prisma.recipe.findMany({
    where: { sourceUrl: { contains: "aniagotuje" } },
    select: { id: true, title: true, sourceUrl: true },
    orderBy: { title: "asc" },
  });
  recipes = recipes.filter((r) => !withStepsIds.has(r.id));

  if (LIMIT > 0) recipes = recipes.slice(0, LIMIT);
  stats.total = recipes.length;
  console.log(`\nFound ${stats.total} recipes to process\n`);

  const BATCH_SIZE = 25;
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    const pct = Math.round((i / recipes.length) * 100);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipes.length / BATCH_SIZE)} (${pct}%)...`
    );
    await processBatch(batch);
  }

  const costInput = (stats.totalInputTokens * 0.4) / 1_000_000;
  const costOutput = (stats.totalOutputTokens * 1.6) / 1_000_000;
  const totalCost = costInput + costOutput;

  console.log("\n=== DONE ===");
  console.log(`Total:          ${stats.total}`);
  console.log(`Fetched:        ${stats.fetched}`);
  console.log(`Saved:          ${stats.saved}`);
  console.log(`Too few steps:  ${stats.tooFewSteps}`);
  console.log(`Errors:         ${stats.errors}`);
  console.log(`Input tokens:   ${stats.totalInputTokens}`);
  console.log(`Output tokens:  ${stats.totalOutputTokens}`);
  console.log(`Cost:           $${totalCost.toFixed(4)} (~${(totalCost * 4).toFixed(1)} zł)`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
