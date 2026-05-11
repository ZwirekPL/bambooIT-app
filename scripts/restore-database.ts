/**
 * Restore database from backup directory.
 * Import order: clean-products -> recipes -> clinical-rules -> protocols -> feature-flags -> blog-posts
 * Skips duplicates by slug/key. Supports --dry-run flag.
 *
 * Run: npx ts-node --esm scripts/restore-database.ts [backup-dir] [--dry-run]
 * Example: npx ts-node --esm scripts/restore-database.ts scripts/data/backup-2026-03-23
 */
import { prisma } from '../packages/database/dist/index.js';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const backupDir = args.find(a => !a.startsWith('--')) ?? '';

interface RestoreStats {
  imported: number;
  skipped: number;
  errors: number;
}

function loadJson<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`  File not found: ${filePath} — skipping`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function restoreCleanProducts(dir: string): Promise<RestoreStats> {
  console.log('\n[1/6] Restoring clean products...');
  const products = loadJson<Record<string, unknown>>(path.join(dir, 'clean-products.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const product of products) {
    try {
      const existing = await prisma.cleanProduct.findUnique({ where: { slug: product.slug as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, nutrients, allergens, dietFlags, portions, createdAt, updatedAt, ...productData } = product;
      const created = await prisma.cleanProduct.create({ data: productData as never });

      if (nutrients && typeof nutrients === 'object') {
        const { id: _id, cleanProductId: _cpid, ...nutData } = nutrients as Record<string, unknown>;
        await prisma.cleanProductNutrients.create({ data: { cleanProductId: created.id, ...nutData } as never });
      }

      if (Array.isArray(allergens) && allergens.length > 0) {
        await prisma.cleanProductAllergen.createMany({
          data: allergens.map((a: Record<string, unknown>) => {
            const { id: _id, cleanProductId: _cpid, ...aData } = a;
            return { cleanProductId: created.id, ...aData } as never;
          }),
        });
      }

      if (Array.isArray(dietFlags) && dietFlags.length > 0) {
        await prisma.cleanProductDietFlag.createMany({
          data: dietFlags.map((f: Record<string, unknown>) => {
            const { id: _id, cleanProductId: _cpid, ...fData } = f;
            return { cleanProductId: created.id, ...fData } as never;
          }),
        });
      }

      if (Array.isArray(portions) && portions.length > 0) {
        await prisma.cleanProductPortion.createMany({
          data: portions.map((p: Record<string, unknown>) => {
            const { id: _id, cleanProductId: _cpid, ...pData } = p;
            return { cleanProductId: created.id, ...pData } as never;
          }),
        });
      }

      stats.imported++;
      if (stats.imported % 500 === 0) console.log(`  ...imported ${stats.imported}`);
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing product: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function restoreRecipes(dir: string): Promise<RestoreStats> {
  console.log('\n[2/6] Restoring recipes...');
  const recipes = loadJson<Record<string, unknown>>(path.join(dir, 'recipes.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const recipe of recipes) {
    try {
      const existing = await prisma.recipe.findUnique({ where: { slug: recipe.slug as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, ingredients, instructionSteps, nutritionSnapshot, allergens, dietFlags, createdAt, updatedAt, ...recipeData } = recipe;

      const created = await prisma.recipe.create({
        data: {
          ...recipeData as never,
          ingredients: {
            create: (Array.isArray(ingredients) ? ingredients : []).map((ing: Record<string, unknown>) => {
              const { id: _id, recipeId: _rid, ...ingData } = ing;
              return ingData as never;
            }),
          },
          instructionSteps: {
            create: (Array.isArray(instructionSteps) ? instructionSteps : []).map((step: Record<string, unknown>) => {
              const { id: _id, recipeId: _rid, ...stepData } = step;
              return stepData as never;
            }),
          },
        },
      });

      if (nutritionSnapshot && typeof nutritionSnapshot === 'object') {
        const { id: _id, recipeId: _rid, ...snapData } = nutritionSnapshot as Record<string, unknown>;
        await prisma.recipeNutritionSnapshot.create({ data: { recipeId: created.id, ...snapData } as never });
      }

      if (Array.isArray(allergens) && allergens.length > 0) {
        await prisma.recipeAllergen.createMany({
          data: allergens.map((a: Record<string, unknown>) => {
            const { id: _id, recipeId: _rid, ...aData } = a;
            return { recipeId: created.id, ...aData } as never;
          }),
        });
      }

      if (Array.isArray(dietFlags) && dietFlags.length > 0) {
        await prisma.recipeDietFlag.createMany({
          data: dietFlags.map((f: Record<string, unknown>) => {
            const { id: _id, recipeId: _rid, ...fData } = f;
            return { recipeId: created.id, ...fData } as never;
          }),
        });
      }

      stats.imported++;
      if (stats.imported % 100 === 0) console.log(`  ...imported ${stats.imported}`);
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing recipe: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function restoreClinicalRules(dir: string): Promise<RestoreStats> {
  console.log('\n[3/6] Restoring clinical rules...');
  const rules = loadJson<Record<string, unknown>>(path.join(dir, 'clinical-rules.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const rule of rules) {
    try {
      // Skip by name (no unique slug on ClinicalRule)
      const existing = await prisma.clinicalRule.findFirst({ where: { name: rule.name as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, createdAt, updatedAt, history, ...ruleData } = rule;
      await prisma.clinicalRule.create({ data: ruleData as never });
      stats.imported++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing rule: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function restoreProtocols(dir: string): Promise<RestoreStats> {
  console.log('\n[4/6] Restoring nutrition protocols...');
  const protocols = loadJson<Record<string, unknown>>(path.join(dir, 'nutrition-protocols.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const protocol of protocols) {
    try {
      const existing = await prisma.nutritionProtocol.findFirst({ where: { name: protocol.name as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, createdAt, updatedAt, dietitianId, accessGrants, dietPlans, triggers, ...protocolData } = protocol;
      await prisma.nutritionProtocol.create({ data: protocolData as never });
      stats.imported++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing protocol: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function restoreFeatureFlags(dir: string): Promise<RestoreStats> {
  console.log('\n[5/6] Restoring feature flags...');
  const flags = loadJson<Record<string, unknown>>(path.join(dir, 'feature-flags.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const flag of flags) {
    try {
      const existing = await prisma.featureFlag.findUnique({ where: { key: flag.key as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, createdAt, updatedAt, ...flagData } = flag;
      await prisma.featureFlag.create({ data: flagData as never });
      stats.imported++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing flag: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function restoreBlogPosts(dir: string): Promise<RestoreStats> {
  console.log('\n[6/6] Restoring blog posts...');
  const posts = loadJson<Record<string, unknown>>(path.join(dir, 'blog-posts.json'));
  const stats: RestoreStats = { imported: 0, skipped: 0, errors: 0 };

  for (const post of posts) {
    try {
      const existing = await prisma.post.findUnique({ where: { slug: post.slug as string } });
      if (existing) { stats.skipped++; continue; }

      if (dryRun) { stats.imported++; continue; }

      const { id, createdAt, updatedAt, ...postData } = post;
      await prisma.post.create({ data: postData as never });
      stats.imported++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 5) console.error(`  Error importing post: ${(err as Error).message}`);
    }
  }

  return stats;
}

async function main() {
  if (!backupDir) {
    console.error('Usage: npx ts-node --esm scripts/restore-database.ts <backup-dir> [--dry-run]');
    console.error('Example: npx ts-node --esm scripts/restore-database.ts scripts/data/backup-2026-03-23');
    process.exit(1);
  }

  if (!fs.existsSync(backupDir)) {
    console.error(`Backup directory not found: ${backupDir}`);
    process.exit(1);
  }

  // Read manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    console.log(`Restoring backup from ${manifest.date} (schema: ${manifest.schemaVersion})`);
    console.log('Counts:', JSON.stringify(manifest.counts, null, 2));
  }

  if (dryRun) {
    console.log('\n*** DRY RUN MODE — no data will be written ***\n');
  }

  const results: Record<string, RestoreStats> = {};

  // Import in dependency order
  results['clean-products'] = await restoreCleanProducts(backupDir);
  results['recipes'] = await restoreRecipes(backupDir);
  results['clinical-rules'] = await restoreClinicalRules(backupDir);
  results['nutrition-protocols'] = await restoreProtocols(backupDir);
  results['feature-flags'] = await restoreFeatureFlags(backupDir);
  results['blog-posts'] = await restoreBlogPosts(backupDir);

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log(dryRun ? '  RESTORE SUMMARY (DRY RUN)' : '  RESTORE SUMMARY');
  console.log('════════════════════════════════════════');
  for (const [name, stats] of Object.entries(results)) {
    console.log(`  ${name.padEnd(22)} imported: ${stats.imported}, skipped: ${stats.skipped}, errors: ${stats.errors}`);
  }
  console.log('════════════════════════════════════════\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
