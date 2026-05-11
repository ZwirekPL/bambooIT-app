# Migration: dev → production

## Overview

This document describes how to migrate recipe and product data from development to production.

**Import order is critical:** CleanProducts must be imported before Recipes,
because `RecipeIngredient.cleanProductId` references `CleanProduct.id`.

---

## Quick start

### 1. Export from source (dev/staging)

```bash
# Export both in one command (products first, then recipes)
npm run db:export:all

# Or individually:
npm run db:export:products   # → scripts/data/clean-products-export.json
npm run db:export:recipes    # → scripts/data/recipes-export.json
```

The export files land in `scripts/data/`. Check their sizes:
- `clean-products-export.json` — typically ~15-25 MB (~6 600 products)
- `recipes-export.json` — typically ~5-15 MB (depends on count)

### 2. Transfer files to production server

```bash
scp scripts/data/clean-products-export.json user@31.97.75.190:/app/scripts/data/
scp scripts/data/recipes-export.json        user@31.97.75.190:/app/scripts/data/
```

### 3. Import on production (SSH into server)

```bash
ssh user@31.97.75.190
cd /app

# DRY RUN first — check what would be created/updated
npm run db:import:products -- --dry-run
npm run db:import:recipes  -- --dry-run

# Actual import (products FIRST, then recipes)
npm run db:import:all
```

---

## Script details

### `export-recipes.ts`

- Exports active recipes where `origin != 'ai_generated'` OR `aiApproved = true`
- Includes: ingredients, instructionSteps, nutritionSnapshot, allergens, dietFlags
- Use `--include-ai` flag to export all recipes regardless of AI status

```bash
npm run db:export:recipes -- --include-ai
```

### `import-recipes.ts`

- **Upsert by `slug`**: if slug exists → update scalars + re-sync relations; if not → create
- Re-syncs ingredients, steps, allergens, diet flags on update (delete + re-create)
- Nutrition snapshot is upserted (not deleted)
- `--dry-run`: counts creates/updates without writing anything
- Progress bar shown in terminal

### `export-clean-products.ts`

- Exports all active CleanProducts with nutrients, allergens, diet flags, portions

### `import-clean-products.ts`

- **Upsert by `slug`**
- Nutrients are upserted (single record per product)
- Allergens, diet flags, portions: delete + re-create on update
- `--dry-run` supported

---

## Idempotency

All import scripts are **idempotent** — safe to run multiple times.
Re-running will update existing records rather than creating duplicates.

---

## Troubleshooting

**`File not found: scripts/data/recipes-export.json`**
→ Run the export first, or copy the file from the source machine.

**`ERROR on <slug>: Foreign key constraint failed`**
→ The recipe references a CleanProduct that doesn't exist on the target.
→ Ensure you ran `import-clean-products` before `import-recipes`.

**`RecipeNutritionSnapshot already exists`**
→ The upsert handles this automatically. If you see this, something is wrong
with the `recipeId` uniqueness constraint — check the DB.

**Import is slow**
→ Normal for large datasets (6 000+ products). With sequential upserts:
- Products: ~3-5 min for 6 600 records
- Recipes: ~2-4 min depending on ingredients count
→ Do not interrupt mid-import — records are committed per item.

---

## File locations summary

| File | Purpose |
|------|---------|
| `scripts/export-recipes.ts` | Export Recipe + relations |
| `scripts/import-recipes.ts` | Import/upsert Recipe + relations |
| `scripts/export-clean-products.ts` | Export CleanProduct + relations |
| `scripts/import-clean-products.ts` | Import/upsert CleanProduct + relations |
| `scripts/data/recipes-export.json` | Export output (gitignored) |
| `scripts/data/clean-products-export.json` | Export output (gitignored) |
