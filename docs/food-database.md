# Food Database — Technical Documentation

## Overview

DietetykDEV contains a professional-grade food database designed for clinical dietetics.
It supports 20,000+ food products and 10,000+ recipes with full macro/micronutrient data,
EU 14 allergen tracking, and automated dietary flag computation.

## Data Sources

### 1. USDA FoodData Central (Primary)
- **License**: Public domain (US government work)
- **Datasets**:
  - **SR Legacy** (~7,800 foods) — most comprehensive nutrient data per food
  - **Foundation Foods** (~2,100 foods) — analytical data with sample info
- **Download**: https://fdc.nal.usda.gov/download-datasets
- **Coverage**: 65+ nutrients per food including amino acids and fatty acids
- **Limitations**: English names only; requires Polish translation layer

### 2. Open Food Facts (Supplementary)
- **License**: Open Database License (ODbL)
- **Use case**: Branded/packaged products common in Polish market
- **API**: https://world.openfoodfacts.org/data
- **Status**: Importer architecture ready, not yet implemented

### 3. Manual / Dietitian Input
- Products and recipes can be created manually via admin API
- Manual overrides for allergens and diet flags are preserved across recomputations

## Data Model

### Core Tables

| Table | Purpose | Records target |
|-------|---------|---------------|
| `FoodProduct` | Base food product with metadata | 20,000+ |
| `FoodProductNutrients` | 65+ nutrient values per 100g | 1:1 with FoodProduct |
| `FoodProductAllergen` | EU 14 allergens with presence levels | Many per product |
| `FoodProductDietFlag` | 20 dietary flags with confidence | Many per product |
| `FoodProductAlias` | Synonyms and translations | Many per product |
| `FoodProductSourceMeta` | Source traceability and raw data | Many per product |
| `FoodCategory` | Hierarchical food categories | ~25 top-level |
| `FoodBrand` | Brand registry | As needed |
| `HouseholdMeasure` | Household units (łyżka, szklanka) | Many per product |

### Recipe Tables

| Table | Purpose |
|-------|---------|
| `Recipe` | Full recipe with metadata, timing, difficulty |
| `RecipeIngredient` | Ingredient with quantity, unit, grams, retention factor |
| `RecipeInstructionStep` | Numbered cooking steps |
| `RecipeNutritionSnapshot` | Computed per-serving and total nutrition |
| `RecipeAllergen` | Aggregated allergens from ingredients |
| `RecipeDietFlag` | Aggregated diet flags from ingredients |
| `IngredientSubstitutionRule` | Product A → Product B with context |

### Infrastructure Tables

| Table | Purpose |
|-------|---------|
| `ImportJob` | Import run tracking with status, counts, error log |
| `DataQualityIssue` | Detected data quality problems |
| `ManualReviewQueue` | Items requiring human review |

## Nutrients Tracked (per 100g)

### Macronutrients (always present)
- Energy (kcal), Protein, Fat, Carbohydrates

### Fat Breakdown
- Saturated, Monounsaturated, Polyunsaturated, Trans fat

### Carb Breakdown
- Sugars, Added sugars, Fiber, Starch

### Minerals (13)
- Sodium, Potassium, Calcium, Magnesium, Phosphorus, Iron, Zinc
- Copper, Manganese, Iodine, Selenium, Chromium, Molybdenum

### Vitamins (15)
- A (RAE), Beta-carotene, D, E, K
- C, B1, B2, B3, B5, B6, Folate, B12, Biotin, Choline

### Amino Acids (9 essential)
- Tryptophan, Threonine, Isoleucine, Leucine, Lysine
- Methionine, Phenylalanine, Valine, Histidine

### Fatty Acids
- Omega-3 total, Omega-6 total, EPA, DHA, ALA

### Clinical
- Cholesterol, Purines (gout), Oxalates (renal)
- Water, Alcohol, Caffeine, Ash

## Allergen System (EU 14)

All 14 EU major allergens are tracked:

1. Gluten (wheat, rye, barley, oats)
2. Crustaceans
3. Eggs
4. Fish
5. Peanuts
6. Soy
7. Milk (dairy)
8. Tree nuts
9. Celery
10. Mustard
11. Sesame
12. Sulphites
13. Lupin
14. Molluscs

### Presence Levels
- `CONTAINS` — confirmed allergen present
- `MAY_CONTAIN` — cross-contamination risk or category heuristic
- `FREE` — confirmed absent
- `UNKNOWN` — not enough data

### Detection Methods
- **SOURCE_DATA** — from original database (e.g., USDA, OFF)
- **HEURISTIC** — keyword + category matching engine
- **MANUAL** — dietitian override
- **AUTO_RULE** — computed from rules

### Manual Override
Each allergen record has `manualOverride: boolean`. When true, automatic
recomputation will not overwrite the value.

## Diet Flags

20 dietary compatibility flags computed per product:

| Flag | Logic |
|------|-------|
| `vegetarian` | No meat/fish keywords or categories |
| `vegan` | No animal product keywords |
| `pescatarian` | No meat (fish allowed) |
| `glutenFree` | No gluten allergen |
| `lactoseFree` | No milk allergen |
| `lowFodmap` | Requires explicit FODMAP data |
| `lowSodium` | < 140mg Na per 100g |
| `lowSugar` | < 5g sugar per 100g |
| `lowFat` | < 3g fat per 100g |
| `highProtein` | > 20g protein per 100g |
| `highFiber` | > 6g fiber per 100g |
| `ketoCompatible` | < 5g carbs, > 10g fat per 100g |
| `diabeticFriendly` | < 5g sugar, < 30g carbs per 100g |
| `renalFriendly` | Low Na, low protein (basic heuristic) |
| `liverFriendly` | Low fat, low saturated fat |
| `ibsFriendly` | Requires FODMAP data (placeholder) |
| `pregnancyFriendly` | Requires specific rules (placeholder) |
| `goutFriendly` | Low purines (< 50mg per 100g) |
| `heartFriendly` | Low sat. fat, low Na, low cholesterol |
| `pancreasFriendly` | Very low fat (< 3g) |

### Confidence Scores
Each flag has a confidence score (0-100):
- 85-90: Based on clear nutrient thresholds
- 60-75: Based on keyword/category heuristics
- 40-55: Based on composite rules with uncertainty

### Which Fields Are Certain vs Heuristic

**Certain (nutrient-based, high confidence):**
- lowSodium, lowSugar, lowFat, highProtein, highFiber, ketoCompatible

**Heuristic (keyword-based, medium confidence):**
- vegetarian, vegan, pescatarian, glutenFree, lactoseFree

**Placeholder (needs additional data sources):**
- lowFodmap, ibsFriendly, pregnancyFriendly

## Quality Score

Each product gets a 0-100 quality score based on data completeness:

| Component | Max Points |
|-----------|-----------|
| Base macros (kcal, P, F, C) | 20 |
| Fiber + Sugar | 10 |
| Fat breakdown | 10 |
| Key minerals (5) | 15 |
| Key vitamins (5) | 15 |
| Amino acids | 10 |
| Cholesterol | 5 |
| Water | 5 |
| Omega fatty acids | 5 |
| **Total** | **95+** |

Products with score ≥ 60 are auto-verified; below 60 remain UNVERIFIED.

## Import Pipeline

### USDA Import Process

1. Admin triggers import via `POST /admin/import/usda` with JSON file path
2. System creates `ImportJob` record
3. Categories are auto-created from USDA food groups
4. Foods processed in batches of 100:
   - Skip duplicates by `source + sourceId`
   - Extract 65+ nutrients via ID mapping
   - Extract household measures from portions
   - Compute quality score
   - Validate data (negative values, kcal consistency)
   - Log quality issues
5. `ImportJob` updated with final counts

### Post-Import Pipeline

After import, run these in sequence:

```
POST /admin/import/compute-allergens  → detect allergens for all products
POST /admin/import/compute-diet-flags → compute diet flags for all products
```

### Data Validation Rules

| Check | Severity | Code |
|-------|----------|------|
| Negative nutrient value | ERROR | NEGATIVE_VALUE |
| kcal vs Atwater mismatch > 25% | WARNING | KCAL_MISMATCH |
| Protein > 100g/100g | WARNING | SUSPICIOUS_VALUE |
| Fat > 100g/100g | WARNING | SUSPICIOUS_VALUE |
| Carbs > 100g/100g | WARNING | SUSPICIOUS_VALUE |

## API Endpoints

### Public (rate-limited)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/food-products` | List with filtering |
| GET | `/food-products/:id` | Get by ID with full data |
| GET | `/food-products/search?q=` | Quick search |
| GET | `/recipes` | List with filtering |
| GET | `/recipes/:id` | Get by ID with ingredients |
| GET | `/recipes/search?q=` | Quick search |

### Admin (requires ADMIN role)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/food-products` | Create product |
| PATCH | `/admin/food-products/:id` | Update product |
| PATCH | `/admin/food-products/:id/verify` | Verify/reject |
| DELETE | `/admin/food-products/:id` | Delete product |
| POST | `/admin/recipes` | Create recipe |
| PATCH | `/admin/recipes/:id` | Update recipe |
| DELETE | `/admin/recipes/:id` | Delete recipe |
| POST | `/admin/import/usda` | Trigger USDA import |
| POST | `/admin/import/compute-allergens` | Run allergen engine |
| POST | `/admin/import/compute-diet-flags` | Run diet flag engine |
| POST | `/admin/recipes/:id/recompute-nutrition` | Recompute recipe nutrition |
| GET | `/admin/import-jobs` | List import runs |
| GET | `/admin/data-quality/issues` | List quality issues |
| PATCH | `/admin/data-quality/issues/:id/resolve` | Resolve issue |
| GET | `/admin/review-queue` | List review items |
| PATCH | `/admin/review-queue/:id` | Process review item |

### Filtering Parameters

**Food Products:**
- `search` — name search (case-insensitive)
- `categoryId` — filter by category
- `source` — filter by data source
- `verificationStatus` — UNVERIFIED/AUTO_VERIFIED/MANUALLY_VERIFIED/REJECTED
- `allergenFree` — comma-separated allergen codes (exclude products containing)
- `dietFlags` — comma-separated flag codes (include products with flag=true)
- `minKcal`, `maxKcal` — kcal range
- `isActive` — active only

**Recipes:**
- `search` — title search
- `category`, `mealType`, `difficulty` — enums
- `maxTotalTime` — max preparation time
- `allergenFree`, `dietFlags` — same as products
- `minKcal`, `maxKcal` — nutrition snapshot range

## Scaling to 20,000+ Products

### Current Path
1. **USDA SR Legacy** — ~7,800 products (ready to import)
2. **USDA Foundation Foods** — ~2,100 products (ready to import)
3. **Open Food Facts PL** — ~10,000+ Polish branded products (importer architecture ready)
4. **Manual additions** — dietitian-curated products

### Polish Name Translation
Products from USDA import with English names (`nameEn`). Polish names can be added via:
- `FoodProductAlias` table (synonym/translation layer)
- Batch translation scripts
- Manual curation

## Scaling to 10,000+ Recipes

### Strategy
1. **Manual recipe creation** via admin API (~50-100 quality recipes)
2. **Template-based generator** — combine known ingredients into recipe templates
3. **AI-assisted generation** — use n8n + AI to generate recipe variants from templates
4. **Community/dietitian contributions** — via review queue workflow
5. **Open source recipe imports** — when legal sources become available

### Recipe Nutrition Computation
After creating/updating a recipe, call:
```
POST /admin/recipes/:id/recompute-nutrition
```
This computes:
- Per-serving macros and micros from ingredient nutrients
- Applies retention factors for cooking losses
- Aggregates allergens from all ingredients
- Computes diet flags from ingredient flags

## Known Limitations

1. **Polish translations** — USDA data is in English; Polish names need manual/batch translation
2. **FODMAP data** — not available from USDA; requires external FODMAP database or manual entry
3. **Glycemic index** — not in USDA; requires external GI tables
4. **Purines/oxalates** — limited USDA coverage; best data from specialized clinical sources
5. **Retention factors** — per-ingredient cooking losses are optional; defaults to 1.0
6. **Allergen heuristics** — keyword-based detection has ~75% confidence; manual review recommended
7. **Pregnancy/IBS flags** — require more specific clinical rule sets beyond simple nutrient thresholds

## File Structure

```
apps/backend/src/
├── import/
│   ├── usda-nutrient-map.ts    — USDA nutrient ID → field mapping
│   ├── usda-importer.ts        — USDA FDC JSON importer
│   ├── allergen-engine.ts      — EU 14 allergen detection
│   ├── diet-flag-engine.ts     — Dietary flag computation
│   └── nutrition-snapshot.ts   — Recipe nutrition calculator
├── services/
│   ├── foodProduct.service.ts  — FoodProduct CRUD + search
│   └── recipe.service.ts       — Recipe CRUD + search
├── controllers/
│   ├── foodProduct.controller.ts — Food product endpoints
│   ├── recipe.controller.ts      — Recipe endpoints
│   └── import.controller.ts      — Import & data quality endpoints
└── routes/
    ├── foodProduct.routes.ts     — Public food product routes
    ├── recipe.routes.ts          — Public recipe routes
    └── admin.routes.ts           — Admin routes (includes import)
```
