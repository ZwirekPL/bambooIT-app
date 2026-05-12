# DELETION_PREVIEW_5a.md — KROK 5a: drop diet food database models

**Status:** PROPOZYCJA. Czekam na "ok 5a final" zanim uruchomię migrację.
**Branch:** `main` (HEAD = `c0eefb9`)
**Migration name proposal:** `drop_diet_food_database_models`

---

## §1. MODELE DO USUNIĘCIA w K5a (30)

Wszystkie zweryfikowane w `packages/database/prisma/schema.prisma`.

### 1.1 Food domain (9)
- `FoodCategory` (L583)
- `FoodProduct` (L603)
- `FoodBrand` (L664)
- `FoodProductNutrients` (L680)
- `FoodProductAllergen` (L769)
- `FoodProductDietFlag` (L788)
- `FoodProductAlias` (L809)
- `FoodProductSourceMeta` (L825)
- `HouseholdMeasure` (L844)

### 1.2 Recipe domain (7)
- `Recipe` (L862)
- `RecipeIngredient` (L940)
- `RecipeInstructionStep` (L968)
- `RecipeNutritionSnapshot` (L985)
- `RecipeAllergen` (L1063)
- `RecipeDietFlag` (L1078)
- `RecipeRating` (L1096)

### 1.3 CleanProduct domain (7)
- `CleanProduct` (L1779)
- `CleanProductNutrients` (L1839)
- `CleanProductPortion` (L1910)
- `CleanProductAllergen` (L1925)
- `CleanProductDietFlag` (L1942)
- `CleanProductAminoAcids` (L1960)
- `CleanProductBioactives` (L1979)

### 1.4 Food helpers / data quality (7)
- `IngredientRepairLog` (L396)
- `IngredientSubstitutionRule` (L1150)
- `FavoriteMeal` (L1134)
- `ShoppingListCheck` (L1117)
- `ImportJob` (L1171)
- `DataQualityIssue` (L1194)
- `ManualReviewQueue` (L1216)

**SUMA: 30 modeli.**

---

## §2. ENUMS DO USUNIĘCIA w K5a

Po dropie modeli sieroty enum types do usunięcia razem:

### Pewne (używane tylko przez K5a modele)
- `FoodState` (L102) — FoodProduct.state
- `FodmapLevel` (L119) — FoodProduct
- `PriceCategory` (L126) — FoodProduct
- `ProcessingLevel` (L132) — FoodProduct
- `AllergenPresence` (L147) — FoodProductAllergen + RecipeAllergen + CleanProductAllergen
- `DietFlagSource` (L154) — FoodProductDietFlag + RecipeDietFlag + CleanProductDietFlag
- `ImportJobStatus` (L161) — ImportJob
- `DataQualitySeverity` (L169) — DataQualityIssue
- `ReviewItemType` (L176) — ManualReviewQueue
- `ReviewItemStatus` (L181) — ManualReviewQueue
- `RecipeDifficulty` (L188) — Recipe
- `RecipeMealType` (L194) — Recipe
- `DishCompleteness` (L210) — Recipe
- `ServingType` (L223) — Recipe
- `CleanProductType` (L1758) — CleanProduct
- `CleanProductSource` (L1764) — CleanProduct (multiple references)
- `CleanVerificationStatus` (L1771) — CleanProduct
- `VerificationStatus` (L140) — używany przez Recipe — sprawdzę czy używany przez ZOSTAJĄCE też (FoodProduct, Recipe — oba USUWANE)
- `FoodRestrictionLevel` (L236) — sprawdzić użycie

### NIE TYKAMY w K5a (cross-cutting z planning models — K5b/c)
- `RecipeComplexity` (L242) — używany przez `NutritionProtocol.recipeComplexity` (planning, K5b/c)
- `DietType` (L92) — prawdopodobnie używany przez Patient/DietPlan (planning)
- `MealType` (L84) — prawdopodobnie używany przez DietPlan/Meal (planning)

**Sprawdzę dokładnie przed migracją** — jeśli enum w K5a jest też używany przez ZOSTAJĄCE modele, USUWAMY w K5b/c.

---

## §3. FOREIGN KEYS — drop dependencies

### 3.1 FK pomiędzy USUWANYMI (Prisma migrate auto-handle)
Wewnątrz K5a scope wszystkie FK mają `onDelete: Cascade`. Prisma wygeneruje SQL w odpowiedniej kolejności:
- Drop child tables first (FoodProductNutrients, FoodProductAllergen, etc.) przed parent (FoodProduct)
- Drop join tables before referenced (RecipeIngredient drop przed Recipe i przed FoodProduct/CleanProduct)
- Etc.

### 3.2 🟥 FK z ZOSTAJĄCYCH modeli do USUWANYCH — **wymaga manual schema edit PRZED migration**

| ZOSTAJĄCY model | Pole | Wskazuje na | Action |
|---|---|---|---|
| `Patient` | `recipeRatings RecipeRating[]` (L349) | RecipeRating | DROP linia w schema (oneToMany — Patient strona zostaje, Recipe strona znika) |
| `Patient` | `favoriteMeals FavoriteMeal[]` (L350) | FavoriteMeal | DROP linia |
| `Patient` | `shoppingListChecks ShoppingListCheck[]` (L351) | ShoppingListCheck | DROP linia |
| `DietPlan` | `shoppingListChecks ShoppingListCheck[]` (L482) | ShoppingListCheck | DROP linia |
| `Meal` | `recipeId String?` (L1297) + `recipe Recipe? @relation(...)` (L1302) | Recipe | DROP 2 linie (field + relation) |

**To 6 manualnych edycji w schema.prisma PRZED `prisma migrate dev`.**

Bez tego `prisma validate` skrzyknie się: `Error: Type "RecipeRating" is neither a built-in type, nor refers to another model, enum, or composite type.`

### 3.3 ZOSTAJĄCE modele referencjące K5a enums (sprawdzić w trakcie)
- `NutritionProtocol.recipeComplexity: RecipeComplexity` (L2031) → enum **NIE TYKAMY** w K5a
- Jeśli `DietType`/`MealType` używane przez planning → ZOSTAJĄ

---

## §4. KONSUMENCI W KODZIE — pre-migration cleanup

### 4.1 `apps/backend/src/routes/admin.routes.ts` — 9 wystąpień `prisma.recipe.*` w inline handlerach
Trzy diet handlery używają `prisma.recipe`:
- `/admin/recipes/ai-review` (L110-140) — list AI-generated recipes pending review
- `/admin/recipes/ai-stats` (L143-158) — stats (total, aiGenerated, aiApproved, humanCreated)
- `/admin/recipes/:id/approve-ai` (L161-180) — approve AI recipe

**Strategia:** zakomentuj wszystkie 3 bloki z TODO(5a-cleanup). 3 handlery, ~70 linii do zakomentowania (te bloki używają TYLKO `prisma`+`logAudit` — zostały świadomie nie tknięte w 2b bo prisma.recipe model wtedy istniał).

### 4.2 `apps/backend/src/services/admin.service.ts` — 3 wystąpienia `prisma.recipe.count`
- L264: `prisma.recipe.count()` w `getStats()` (admin dashboard stats)
- L265: `prisma.recipe.count({ where: { qualityScore: { lt: 40 } } })` w `getStats()` — recipesNeedingWork
- L301: `prisma.recipe.count({ where: { qualityScore: { lt: 40 } } })` w `getActionItems()` — recipesNeedingWork

**Strategia:** zakomentuj `recipe.count()` linie + odpowiednie pola w return statement (`recipes: { total, needingWork }` w stats + `recipesNeedingWork` w actionItems). TODO(5a-cleanup).

### 4.3 ZOSTAJĄCE pliki które używają K5a Prisma models — `apps/web/src/lib/api.ts`
~14 metod fetch dla FoodProduct/CleanProduct/Recipe (linie ~1018-1351). Typed jako lokalny `FoodProduct`/`CleanProduct`/`Recipe` z `types/api.ts` (NIE @prisma/client). Endpointy backend już usunięte w K2a/b, więc te metody to **runtime sieroty**, ale typecheck-clean.

**Strategia:** **NIE TYKAMY w K5a** — sprzątniemy w K11 razem z rebuild types/api.ts. Plus K5.5 depcheck zauważy.

### 4.4 `apps/web/src/types/api.ts` — local interfaces (~30 dla FoodProduct/Recipe/CleanProduct)
Lokalne mirror interfejsy, niezależne od @prisma/client. **NIE TYKAMY** — K11 cleanup.

### 4.5 `packages/database/src/index.ts`
Re-exports: `prisma`, `Prisma`, `DayRegenReason`. Nie tyka K5a modeli. **NIE TYKAMY**.

---

## §5. PRE-MIGRATION — backup + verify

### 5.1 Database state
```
docker ps --filter "name=bambooit_postgres"
→ (empty)
```

**Postgres container NIE UP.** Brak działającej bazy DEV. Migracja zadziała w trybie:
- Pierwsza opcja: `prisma migrate dev` próbuje connect → fail → user musi uruchomić DB
- Druga opcja: uruchom `docker-compose up -d postgres` przed migration, sprawdź czy migrations już zaaplikowane w bazie, dropuj te z K5a list

**Decyzja proponowana:** uruchom DB w docker, sprawdź stan, zrób migrację. Backup niepotrzebny (DEV-only, no production data, fresh DB można też z drop'em).

### 5.2 Backup strategy (jeśli DB ma dane)
Jeśli po uruchomieniu container'a w `bambooit_db` są dane:
```bash
# Postgres in docker — backup via docker exec
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db > backup_pre_5a_$(date +%Y%m%d_%H%M%S).sql
```
Zapis info w raporcie.

Jeśli baza pusta (fresh) lub container nie up — **backup pomijam**, raportuję "no data to backup".

### 5.3 Pre-migration record count
Jeśli DB up:
```sql
SELECT (SELECT COUNT(*) FROM "FoodProduct") AS food_products,
       (SELECT COUNT(*) FROM "Recipe") AS recipes,
       (SELECT COUNT(*) FROM "CleanProduct") AS clean_products,
       (SELECT COUNT(*) FROM "ImportJob") AS import_jobs;
```
Counts udokumentować w raporcie post-commit.

---

## §6. MIGRATION COMMANDS

### 6.1 Pre-migration code cleanup (commit-able SEPARATELY z migracją albo razem)
1. Edit `apps/backend/src/routes/admin.routes.ts` — comment 3 inline handlers
2. Edit `apps/backend/src/services/admin.service.ts` — comment 3 `prisma.recipe.count` + return fields

### 6.2 Schema edit (manual — w pamięć K5a scope)
1. Drop 30 model definitions (lista §1)
2. Drop ~18 enum definitions (lista §2 pewne)
3. Drop 6 FK lines z ZOSTAJĄCYCH modeli (lista §3.2)

### 6.3 DB up (jeśli nie up)
```bash
docker-compose up -d postgres
# Wait ~5s for ready
```

### 6.4 Migration generation
```bash
npm run prisma -- migrate dev -w packages/database --name drop_diet_food_database_models
```

Prisma:
1. Reads new schema
2. Diffs vs DB state
3. Generates SQL in `packages/database/prisma/migrations/[timestamp]_drop_diet_food_database_models/migration.sql`
4. Applies SQL to DB
5. Regenerates Prisma Client

### 6.5 Verify SQL migration (PRZED COMMIT)
**Pokaż user'owi `migration.sql` PRZED `git add`** — sanity check że SQL ma sense:
- DROP TABLE w odpowiedniej kolejności
- DROP TYPE (enums)
- ALTER TABLE w Patient/DietPlan/Meal (drop FK columns jeśli były na ZOSTAJĄCYCH stronach — w naszym przypadku to oneToMany, więc DROP CONSTRAINT na USUWANYCH stronach, brak ALTER na ZOSTAJĄCYCH)

---

## §7. POST-MIGRATION SANITY

1. `npm run typecheck` — full chain (database build + backend build + web type-check)
2. **Akceptowalny:**
   - exit 0 ✅
   - LUB "Cannot find module/type" tylko do usuniętych enums/models — wtedy iteracyjnie fix przez komentowanie usagów + retry
3. **Nieakceptowalny:** inne błędy — STOP i raport

---

## §8. COMMIT MESSAGE PROPOSAL

```
chore(cleanup): drop diet food database models (KROK 5a)

Drop 30 Prisma models + ~18 sibling enum types covering the diet food
database stack (food products, recipes, clean products, food helpers,
data quality pipeline).

Models dropped:
- Food (9): FoodCategory, FoodProduct, FoodBrand, FoodProductNutrients,
  FoodProductAllergen, FoodProductDietFlag, FoodProductAlias,
  FoodProductSourceMeta, HouseholdMeasure
- Recipe (7): Recipe, RecipeIngredient, RecipeInstructionStep,
  RecipeNutritionSnapshot, RecipeAllergen, RecipeDietFlag, RecipeRating
- CleanProduct (7): CleanProduct, CleanProductNutrients,
  CleanProductPortion, CleanProductAllergen, CleanProductDietFlag,
  CleanProductAminoAcids, CleanProductBioactives
- Helpers/QA (7): IngredientRepairLog, IngredientSubstitutionRule,
  FavoriteMeal, ShoppingListCheck, ImportJob, DataQualityIssue,
  ManualReviewQueue

Enums dropped: FoodState, FodmapLevel, PriceCategory, ProcessingLevel,
AllergenPresence, DietFlagSource, ImportJobStatus, DataQualitySeverity,
ReviewItemType, ReviewItemStatus, RecipeDifficulty, RecipeMealType,
DishCompleteness, ServingType, VerificationStatus (?), FoodRestrictionLevel
(?), CleanProductType, CleanProductSource, CleanVerificationStatus.

Schema relations dropped from REMAINING models:
- Patient.recipeRatings, Patient.favoriteMeals, Patient.shoppingListChecks
- DietPlan.shoppingListChecks
- Meal.recipeId + Meal.recipe (FK to Recipe)

Pre-migration code cleanup (commented with TODO 5a-cleanup):
- apps/backend/src/routes/admin.routes.ts: 3 inline handlers
  (/admin/recipes/ai-review, /admin/recipes/ai-stats, /admin/recipes/:id/approve-ai)
- apps/backend/src/services/admin.service.ts: 3 prisma.recipe.count
  calls in getStats() + getActionItems() + corresponding return fields

Migration: drop_diet_food_database_models (timestamp will be added by Prisma).

Pre-migration record counts (from DEV DB before drop): [will be filled
during execution — if DB up].

Not touched in K5a (deferred):
- RecipeComplexity enum (used by NutritionProtocol — K5b/c planning)
- DietType, MealType enums (used by DietPlan, Meal planning — K5b)
- apps/web/src/lib/api.ts food/recipe methods (runtime orphans, K11 cleanup)
- apps/web/src/types/api.ts local interfaces (K11 rebuild)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## §9. ROLLBACK PLAN (na wszelki wypadek)

Jeśli migracja się sypnie albo typecheck pokaże nieoczekiwane błędy nie do naprawienia:

```bash
# 1. Revert kod
git reset --hard HEAD  # cofa schema.prisma + code edits przed commitem
                       # LUB
git revert HEAD        # cofa po commicie (utwórz reverse commit)

# 2. Cofnij DB (jeśli migration was applied)
# Restore z backupu jeśli istnieje:
docker exec -i bambooit_postgres psql -U bambooit -d bambooit_db < backup_pre_5a_*.sql

# LUB: drop database + recreate fresh
docker exec bambooit_postgres psql -U bambooit -d postgres -c "DROP DATABASE bambooit_db;"
docker exec bambooit_postgres psql -U bambooit -d postgres -c "CREATE DATABASE bambooit_db;"
npm run prisma -- migrate deploy -w packages/database  # re-apply all OLD migrations

# 3. Regenerate Prisma Client
npm run prisma -- generate -w packages/database
npm install
```

---

## §11. Q1-Q4 PRE-FLIGHT RESULTS

### Q1 — DATABASE_URL audit ✅
**docker-compose.yml postgres**: `POSTGRES_USER: bambooit`, `POSTGRES_DB: bambooit_db`, `POSTGRES_PASSWORD: bambooit123` ✅ bambooIT branding.

**`.env.example`** (`apps/backend/.env.example`): `DATABASE_URL=postgresql://bambooit:bambooit123@localhost:5432/bambooit_db?schema=public` ✅ bambooIT.

⚠️ **ALE: brak rzeczywistych `.env` plików w workdir.**
```
apps/backend/.env       → missing
apps/web/.env           → missing
apps/web/.env.local     → missing
packages/database/.env  → missing
.env                    → missing
.env.local              → missing
```

**Implikacja:** Prisma `migrate dev` szuka `DATABASE_URL` w env. Bez `.env` failure z "Environment variable not found: DATABASE_URL".

**Fix przed migracją:** utworzyć `apps/backend/.env` lub `packages/database/.env` z DATABASE_URL = wartość z .env.example. **NIE COMMITUJEMY .env** (jest w `.gitignore`).

Decyzja: utworzę `packages/database/.env` z minimalnym `DATABASE_URL` (Prisma CLI tam szuka). Plus dla backend wystarczy w trakcie migracji — runtime env zrobimy później.

Brak diet residue, brak zaczepienia o e-dietetyk DB. Migracja czysta.

### Q2 — Backup unconditional ✅
**Procedura (updated):**
```bash
# 1. Start DB
docker-compose up -d postgres
sleep 5

# 2. Backup BEZWZGLĘDNIE (DEV-only, asekuracja)
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db \
  > backup_pre_5a_$(date +%Y%m%d_%H%M%S).sql 2>&1 | tee backup.log
ls -la backup_pre_5a_*.sql

# 3. Add to .gitignore (jeśli nie ma)
echo "backup_pre_*.sql" >> .gitignore
echo "backup.log" >> .gitignore
```

Backup path → udokumentowany w raporcie post-commit.

### Q3 — Migration name (updated)
Stara nazwa: ~~`drop_diet_food_database_models`~~
**Nowa nazwa:** `drop_diet_food_database_models_models`

Spójność z K5b/K5c (`drop_diet_planning_models`, `drop_diet_clinical_models`) i K6/K7/K8 (`rename_*`).

### Q4 — Frontend diet types audit

| Plik | Total LOC | Matches (FoodProduct\|Recipe\|CleanProduct\|FoodCategory\|FoodBrand) |
|---|---|---|
| `apps/web/src/types/api.ts` | 1616 | **32** |
| `apps/web/src/lib/api.ts` | 1703 | **58** |

**32 + 58 = 90 matches** w ~3300 linii. Każdy match reprezentuje 1 linijkę, ale otaczające bloki (interface declarations, fetch methods) ciągną ~5-15 linii każdy. **Szacowane do usunięcia: ~500-700 linii**.

**Decyzja:** **>100 linii → osobny commit K5a.5**:
```
chore(cleanup): remove orphan diet types from frontend api layer (K5a.5)
```

Wykonany **PO** K5a commit (Prisma models drop), **PRZED** K5b. Skopiowane przed K5b żeby `types/api.ts` był zerowy o diet już wtedy gdy K5b drop'uje planning models.

---

## §12. UPDATED PROCESS FLOW

### Trzy user gates dla K5a (pierwsza migracja Prisma):

**Gate 1: "ok 5a final"** — start chirurgii
Acceptable trigger: ten preview file zaakceptowany.

**Gate 2: "ok migrate"** — po edycji schemy, przed `prisma migrate dev`
Pokażę: `git diff packages/database/prisma/schema.prisma` + `prisma validate` output. **Schema edit jest reversible przez git** — migrate dev nie. Wymagam explicit green light.

**Gate 3: "ok commit"** — po migration zaaplikowanej, przed `git add + commit`
Pokażę: wygenerowany `migration.sql` (sanity check kolejności DROP), typecheck output, post-drop record counts (jeśli były dane).

### Pełna sekwencja kroków po "ok 5a final"

1. **Pre-migration code cleanup** (commit-able later z migration)
   - Edit `apps/backend/src/routes/admin.routes.ts`: comment 3 inline diet handlers (ai-review, ai-stats, approve-ai)
   - Edit `apps/backend/src/services/admin.service.ts`: comment 3 `prisma.recipe.count()` + return fields

2. **Env setup**
   - Utwórz `packages/database/.env` z DATABASE_URL=postgresql://bambooit:bambooit123@localhost:5432/bambooit_db?schema=public (jeśli nie istnieje)
   - Verify `.gitignore` zawiera `.env` i `backup_pre_*.sql`

3. **DB up + verify**
   - `docker-compose up -d postgres`
   - Wait ~5s
   - `docker exec bambooit_postgres pg_isready -U bambooit`

4. **Migration state check**
   - `docker exec bambooit_postgres psql -U bambooit -d bambooit_db -c "\dt"` — czy są tabele
   - Jeśli DB pusta (fresh) — `npm run prisma -- migrate deploy -w packages/database` żeby zaaplikować existing migrations przed K5a drop
   - Jeśli DB ma już migrations zaaplikowane — skip

5. **Pre-drop record counts** (jeśli tabele istnieją)
   ```sql
   SELECT (SELECT COUNT(*) FROM "FoodProduct") AS food_products,
          (SELECT COUNT(*) FROM "Recipe") AS recipes,
          (SELECT COUNT(*) FROM "CleanProduct") AS clean_products,
          (SELECT COUNT(*) FROM "ImportJob") AS import_jobs;
   ```
   Udokumentuj counts.

6. **Backup BEZWZGLĘDNIE**
   ```bash
   docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db \
     > backup_pre_5a_$(date +%Y%m%d_%H%M%S).sql
   ```

7. **Schema edit** (`packages/database/prisma/schema.prisma`)
   - Drop 30 model definitions (lista §1)
   - Drop ~18 enum definitions (lista §2 pewne)
   - Drop 6 FK lines z ZOSTAJĄCYCH: Patient.{recipeRatings,favoriteMeals,shoppingListChecks}, DietPlan.shoppingListChecks, Meal.{recipeId,recipe}

8. **🛑 Gate 2: pokaż `git diff schema.prisma` + `prisma validate`**
   - `npm run prisma -- validate -w packages/database`
   - Pokażę diff w treści message
   - CZEKAM na **"ok migrate"**

9. **Migration** (po "ok migrate")
   ```bash
   npm run prisma -- migrate dev -w packages/database --name drop_diet_food_database_models_models
   ```

10. **🛑 Gate 3: pokaż migration.sql + typecheck**
    - Cat `packages/database/prisma/migrations/<timestamp>_drop_diet_food_database_models_models/migration.sql`
    - `npm run typecheck > TYPECHECK_STEP_5a.log 2>&1`
    - Jeśli typecheck FAIL → iter (komentowanie sierot) → retry → pokaż final stan
    - CZEKAM na **"ok commit"**

11. **Commit** (po "ok commit")
    - `git add -A`
    - Commit z message §8 (uzupełnionym o counts, enum list, migration timestamp)

12. **K5a.5 follow-up** (osobny commit, automatyczny po K5a)
    - Frontend diet types cleanup (~500-700 linii w types/api.ts + lib/api.ts)
    - Drop `FoodProduct`/`Recipe`/`CleanProduct` interfejsów + fetch methods
    - Typecheck → commit `chore(cleanup): remove orphan diet types from frontend api layer (K5a.5)`

---

## §13. CZEKAM NA "ok 5a final"

Po tym gate'cie wykonuję kroki 1-7 (kod, env, DB, backup, schema edit) i zatrzymuję się przy **Gate 2** z `git diff schema.prisma`.
