#!/usr/bin/env node
/**
 * K9 i18n sweep helper.
 *
 * Drops diet-era keys from pl.json + en.json and renames patient→client
 * variants per Wariant A decision. Operates on both message bundles
 * synchronously so they stay structurally aligned (D-023: PL is the
 * source of truth, EN is mirrored for future activation).
 *
 * Usage:
 *   node scripts/cleanup-helpers/k9-i18n-sweep.js --dry-run
 *   node scripts/cleanup-helpers/k9-i18n-sweep.js --apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PL_PATH = path.join(ROOT, 'apps', 'web', 'messages', 'pl.json');
const EN_PATH = path.join(ROOT, 'apps', 'web', 'messages', 'en.json');

// Drop list — dotted JSON paths to delete (per K9 decisions).
// Categorized for readable diffs in the GATE 1 report.
const DROP_PATHS = [
  // §1 auth: dietitianCode form field (RegisterForm K7-stripped)
  'auth.dietitianCodeLabel',
  'auth.dietitianCodePlaceholder',
  'auth.dietitianCodeHint',
  'auth.errorInvalidDietitianCode',

  // §2 order: diet product variants (K8 enum reform) + diet narrative copy
  'order.products.FREE_7',
  'order.products.TRIAL',
  'order.products.OPIEKA_MIESIECZNA',
  'order.products.OPIEKA_ROCZNA',
  'order.products.PLAN_2W',
  'order.products.PLAN_4W',
  'order.products.CONSULTATION',
  'order.devNote',
  'order.trialAfterInfo',
  'order.yearlyBilledAs',

  // §3 checkout: diet product variants + consultation flow (K8 dropped Order.consultationPhone)
  'checkout.products.FREE_7',
  'checkout.products.TRIAL',
  'checkout.products.OPIEKA_MIESIECZNA',
  'checkout.products.OPIEKA_ROCZNA',
  'checkout.products.PLAN_2W',
  'checkout.products.PLAN_4W',
  'checkout.products.CONSULTATION',
  'checkout.consultationSuccessTitle',
  'checkout.consultationSuccessDescription',
  'checkout.consultationNextSteps',
  'checkout.consultationStep1',
  'checkout.consultationStep2',
  'checkout.consultationStep3',
  'checkout.consultationEmailSent',
  'checkout.consultationPhoneLabel',
  'checkout.consultationPhoneDescription',
  'checkout.consultationPhonePlaceholderLabel',
  'checkout.consultationPhoneSave',
  'checkout.consultationPhoneSaved',
  'checkout.consultationPhoneError',
  'checkout.consultationPhoneSaveError',
  'checkout.successCtaInterview',
  'checkout.successNextSteps',

  // §4 admin.nav: diet sections (orphan after K2c/K5b/K7/K8)
  'admin.nav.tenants',
  'admin.nav.scraperStats',
  'admin.nav.solverStats',
  'admin.nav.clinicalRules',
  'admin.nav.protocols',
  'admin.nav.protocolTriggers',
  'admin.nav.protocolConflicts',
  'admin.nav.recipes',
  'admin.nav.foodProducts',
  'admin.nav.aiCosts',
  'admin.nav.emailCampaigns',
  'admin.nav.consultations',

  // §5 admin.subscriptions: legacy product/period labels (orphan after K8)
  'admin.subscriptions.plan2w',
  'admin.subscriptions.plan4w',
  'admin.subscriptions.consultationCount',
  'admin.subscriptions.dialogPlan2wTitle',
  'admin.subscriptions.dialogPlan4wTitle',
  'admin.subscriptions.dialogConsultationTitle',
  'admin.subscriptions.oneTimeTitle',
  'admin.subscriptions.monthly',
  'admin.subscriptions.yearly',

  // §6 admin.settings: consultation contact-info settings (dropped K8)
  'admin.settings.consultationTitle',
  'admin.settings.consultationDescription',
  'admin.settings.consultationPhone',
  'admin.settings.consultationEmail',
  'admin.settings.consultationMeetingUrl',
  'admin.settings.consultationInstructions',
  'admin.settings.consultationInstructionsPlaceholder',
  'admin.settings.consultationSave',

  // §7 admin.stats: diet stats panel (orphan dashboard tiles)
  'admin.stats.patients',
  'admin.stats.dietitians',
  'admin.stats.interviews',
  'admin.stats.dietPlansTotal',
  'admin.stats.plansByStatus',
  'admin.stats.statusGenerated',
  'admin.stats.statusReviewed',
  'admin.stats.statusSent',
  'admin.stats.cacheTitle',
  'admin.stats.cacheTemplates',
  'admin.stats.cacheHitRate',
  'admin.stats.cacheExactHits',
  'admin.stats.cacheSimilarHits',
  'admin.stats.cacheMisses',
  'admin.stats.cacheSavings',
  'admin.stats.recipesTitle',
  'admin.stats.recipesTotal',
  'admin.stats.recipesNeedingWork',
  'admin.stats.recipesComplete',
  'admin.stats.recipesViewNeedingWork',
  'admin.stats.consultationsTitle',
  'admin.stats.consultationsPending',
  'admin.stats.consultationsHandleCta',
  'admin.stats.actionItemsPendingConsultations',
  'admin.stats.actionItemsRecipesNeedingWork',

  // §8 admin.users: diet role variants (orphan post-K7) + dietitian-code create field
  'admin.users.filterDietitian',
  'admin.users.roleDietitian',
  'admin.users.createDietitianCode',
  'admin.users.createDietitianCodePlaceholder',
  'admin.users.fieldCode',
];

// Rename map — old dotted path → new dotted path. Value is preserved.
const RENAMES = [
  ['admin.users.filterPatient', 'admin.users.filterClient'],
  ['admin.users.rolePatient', 'admin.users.roleClient'],
];

function dropPath(obj, segments) {
  if (segments.length === 0) return false;
  const [head, ...rest] = segments;
  if (!Object.prototype.hasOwnProperty.call(obj, head)) return false;
  if (rest.length === 0) {
    delete obj[head];
    return true;
  }
  if (obj[head] && typeof obj[head] === 'object') {
    return dropPath(obj[head], rest);
  }
  return false;
}

function readPath(obj, segments) {
  let cur = obj;
  for (const s of segments) {
    if (!cur || typeof cur !== 'object' || !(s in cur)) return undefined;
    cur = cur[s];
  }
  return cur;
}

function setPath(obj, segments, value) {
  let cur = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const s = segments[i];
    if (!cur[s] || typeof cur[s] !== 'object') cur[s] = {};
    cur = cur[s];
  }
  cur[segments[segments.length - 1]] = value;
}

function applyToBundle(json) {
  const dropped = [];
  const renamed = [];

  for (const dotted of DROP_PATHS) {
    const segs = dotted.split('.');
    if (dropPath(json, segs)) dropped.push(dotted);
  }

  for (const [from, to] of RENAMES) {
    const fromSegs = from.split('.');
    const toSegs = to.split('.');
    const val = readPath(json, fromSegs);
    if (val !== undefined) {
      dropPath(json, fromSegs);
      setPath(json, toSegs, val);
      renamed.push(`${from} → ${to}`);
    }
  }

  return { dropped, renamed };
}

function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const apply = mode === 'apply';

  const plRaw = fs.readFileSync(PL_PATH, 'utf8');
  const enRaw = fs.readFileSync(EN_PATH, 'utf8');
  const pl = JSON.parse(plRaw);
  const en = JSON.parse(enRaw);

  const plResult = applyToBundle(pl);
  const enResult = applyToBundle(en);

  if (apply) {
    fs.writeFileSync(PL_PATH, JSON.stringify(pl, null, 2) + '\n');
    fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + '\n');
  }

  console.log(`\n=== K9 i18n sweep [${mode}] ===`);
  console.log(`\npl.json:`);
  console.log(`  dropped keys: ${plResult.dropped.length}`);
  console.log(`  renamed keys: ${plResult.renamed.length}`);
  console.log(`en.json:`);
  console.log(`  dropped keys: ${enResult.dropped.length}`);
  console.log(`  renamed keys: ${enResult.renamed.length}`);

  console.log(`\n--- pl.json drops ---`);
  for (const d of plResult.dropped) console.log(`  - ${d}`);
  console.log(`\n--- pl.json renames ---`);
  for (const r of plResult.renamed) console.log(`  ~ ${r}`);

  if (plResult.dropped.length !== enResult.dropped.length) {
    console.log(`\n[WARN] PL/EN drop counts mismatch (PL=${plResult.dropped.length}, EN=${enResult.dropped.length}) — investigate orphan keys`);
  }

  if (!apply) console.log(`\n(dry-run — no files modified; re-run with --apply)`);
}

main();
