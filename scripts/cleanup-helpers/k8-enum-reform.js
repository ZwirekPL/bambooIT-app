// scripts/cleanup-helpers/k8-enum-reform.js
//
// K8 helper — FLAG REPORTER for ProductType + SubscriptionPlan enum reform.
// Reports occurrences of 15 diet enum values + Stripe env vars.
// No auto-replace — strategy is drop-first (per Pytanie B), manual edits.
//
// Usage:
//   node scripts/cleanup-helpers/k8-enum-reform.js
//
// Flagged values:
//   ProductType (12): FREE_7, OPIEKA_MIESIECZNA, OPIEKA_ROCZNA,
//     PLAN_2W, PLAN_4W, CONSULTATION, PREMIUM, CONSULTATION_1W,
//     AI_2W, AI_4W, SUBSCRIPTION_1M, CONSULTATION_2W, CONSULTATION_4W
//   SubscriptionPlan (3): 'FREE', 'PRO_MONTHLY', 'PRO_YEARLY'
//   Env vars: STRIPE_PRO_YEARLY_PRICE_ID, STRIPE_PRICE_OPIEKA_*,
//     STRIPE_PRICE_PLAN_*, STRIPE_PRICE_CONSULTATION
//
// SKIP:
//   - apps/backend/src/config/planLimits.ts (K9 territory — drop entire file)
//   - apps/backend/src/utils/{cuisineMapping,composeMealsFlag,scaleRecipeSteps,
//     mealSchedule,ingredientDisplayName,templateRenderer}.ts (K9 orphans)
//   - Lines inside TODO(*-cleanup) commented blocks

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

const ROOTS = [
  path.join(REPO_ROOT, 'apps', 'backend', 'src'),
  path.join(REPO_ROOT, 'apps', 'web', 'src'),
];

const SKIP_FILES = [
  'apps/backend/src/config/planLimits.ts',
  'apps/backend/src/utils/cuisineMapping.ts',
  'apps/backend/src/utils/composeMealsFlag.ts',
  'apps/backend/src/utils/scaleRecipeSteps.ts',
  'apps/backend/src/utils/mealSchedule.ts',
  'apps/backend/src/utils/ingredientDisplayName.ts',
  'apps/backend/src/utils/templateRenderer.ts',
];

const PATTERNS = [
  // ProductType diet values (12)
  [/'FREE_7'/g, "PT: 'FREE_7'"],
  [/'OPIEKA_MIESIECZNA'/g, "PT: 'OPIEKA_MIESIECZNA'"],
  [/'OPIEKA_ROCZNA'/g, "PT: 'OPIEKA_ROCZNA'"],
  [/'PLAN_2W'/g, "PT: 'PLAN_2W'"],
  [/'PLAN_4W'/g, "PT: 'PLAN_4W'"],
  [/'CONSULTATION'/g, "PT: 'CONSULTATION'"],
  [/'PREMIUM'/g, "PT: 'PREMIUM' (legacy)"],
  [/'CONSULTATION_1W'/g, "PT: 'CONSULTATION_1W' (legacy)"],
  [/'AI_2W'/g, "PT: 'AI_2W' (legacy)"],
  [/'AI_4W'/g, "PT: 'AI_4W' (legacy)"],
  [/'SUBSCRIPTION_1M'/g, "PT: 'SUBSCRIPTION_1M' (legacy)"],
  [/'CONSULTATION_2W'/g, "PT: 'CONSULTATION_2W' (legacy)"],
  [/'CONSULTATION_4W'/g, "PT: 'CONSULTATION_4W' (legacy)"],

  // SubscriptionPlan diet values (3)
  [/'PRO_MONTHLY'/g, "SP: 'PRO_MONTHLY'"],
  [/'PRO_YEARLY'/g, "SP: 'PRO_YEARLY'"],
  // 'FREE' is too generic — only flag when clearly SubscriptionPlan context
  // (e.g., plan: 'FREE', plan === 'FREE', plan !== 'FREE', plan: { not: 'FREE' })
  [/plan[^a-zA-Z_].*'FREE'/g, "SP: 'FREE' (plan context)"],

  // Stripe env vars to rename
  [/STRIPE_PRO_YEARLY_PRICE_ID/g, "ENV: STRIPE_PRO_YEARLY_PRICE_ID → rename to STRIPE_PRICE_FIRMA_PLUS"],
  [/STRIPE_PRICE_OPIEKA_MIESIECZNA/g, "ENV: STRIPE_PRICE_OPIEKA_MIESIECZNA → drop"],
  [/STRIPE_PRICE_OPIEKA_ROCZNA/g, "ENV: STRIPE_PRICE_OPIEKA_ROCZNA → drop"],
  [/STRIPE_PRICE_PLAN_2W/g, "ENV: STRIPE_PRICE_PLAN_2W → drop"],
  [/STRIPE_PRICE_PLAN_4W/g, "ENV: STRIPE_PRICE_PLAN_4W → drop"],
  [/STRIPE_PRICE_CONSULTATION/g, "ENV: STRIPE_PRICE_CONSULTATION → drop"],

  // Type union compound (multi-line TS unions caught indirectly)
  [/SubscriptionPlan/g, "TYPE: SubscriptionPlan import/reference"],
];

function isInsideTODOBlock(lines, lineIdx) {
  const currentLine = lines[lineIdx].trim();
  if (currentLine !== '' && !currentLine.startsWith('//')) return false;
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 30); i--) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('//')) return false;
    if (/TODO\([A-Za-z0-9._]+-cleanup\)/.test(line)) return true;
  }
  return false;
}

function findFilesRecursive(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...findFilesRecursive(fullPath));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = ROOTS.flatMap(findFilesRecursive);
// Also check .env.example
const envExample = path.join(REPO_ROOT, 'apps', 'backend', '.env.example');
if (fs.existsSync(envExample)) files.push(envExample);

const report = {
  filesScanned: files.length,
  filesFlagged: [],
  patternCounts: {},
  filesSkipped: [],
};

for (const file of files) {
  const relPath = path.relative(REPO_ROOT, file).replace(/\\/g, '/');

  if (SKIP_FILES.some((s) => relPath === s)) {
    report.filesSkipped.push(relPath);
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // env.example doesn't have TODO comment convention — scan all lines
    if (relPath.endsWith('.ts') || relPath.endsWith('.tsx')) {
      if (isInsideTODOBlock(lines, idx)) return;
    }

    for (const [regex, label] of PATTERNS) {
      if (regex.test(line)) {
        report.patternCounts[label] = (report.patternCounts[label] || 0) + 1;
        let entry = report.filesFlagged.find((f) => f.path === relPath);
        if (!entry) {
          entry = { path: relPath, lines: [] };
          report.filesFlagged.push(entry);
        }
        if (!entry.lines.some((l) => l.line === idx + 1 && l.label === label)) {
          entry.lines.push({ line: idx + 1, label });
        }
      }
    }
  });
}

const totalFlags = Object.values(report.patternCounts).reduce((a, b) => a + b, 0);

console.log('═════════════════════════════════════════════════════════');
console.log('K8 Enum Reform — FLAG REPORT (no auto-replace)');
console.log('═════════════════════════════════════════════════════════\n');
console.log(`Files scanned: ${report.filesScanned}`);
console.log(`Files flagged: ${report.filesFlagged.length}`);
console.log(`Files skipped (K9 territory): ${report.filesSkipped.length}`);
console.log(`Total flags: ${totalFlags}\n`);
console.log('--- Pattern counts ---');
Object.entries(report.patternCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([label, count]) => {
    console.log(`  ${String(count).padStart(4, ' ')}  ${label}`);
  });
console.log('\n--- Flagged files (sorted by hit count) ---');
report.filesFlagged
  .sort((a, b) => b.lines.length - a.lines.length)
  .forEach(({ path: p, lines }) => {
    console.log(`  ${String(lines.length).padStart(3, ' ')} hits  ${p}`);
  });
console.log('\n--- Skipped files (K9 territory) ---');
report.filesSkipped.forEach((p) => console.log(`  ${p}`));
console.log();
