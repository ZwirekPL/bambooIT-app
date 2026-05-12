# DELETION_PREVIEW_5c.md — KROK 5c: drop diet clinical + email campaign models

**Status:** PROPOZYCJA. Czekam na "ok 5c final".
**Branch:** `main` (HEAD = `19bd549`)
**Migration name proposal:** `drop_diet_clinical_models`
**Schema state pre-K5c:** 760 linii, 29 models, 12 enums

---

## §1. MODELE DO USUNIĘCIA w K5c (6 clinical + 2 email sweep = 8)

### 1.1 Clinical core (6)
- `NutritionProtocol` — protokoły żywieniowe (z FoodRestrictions, MacroRatios, BmrFormula, RecipeComplexity)
- `DietitianProtocolAccess` — join table dietitian↔protocol (access grants)
- `ProtocolTrigger` — auto-match rules (e.g. CKD_4_5 → renal protocol)
- `ProtocolConflict` — conflicts (e.g. BUILD_MUSCLE × CKD = BLOCK)
- `ClinicalRule` — POLICY / RED_FLAG rules (e.g. "max protein for renal patients")
- `ClinicalRuleHistory` — audit log of rule edits

### 1.2 Diet residue sweep (2) — backend already dropped in K2c, modele zostały sierotami
- `EmailCampaign` — type enum 100% diet (`WEEKLY_SUMMARY | DIETITIAN_SUMMARY | TRIGGER_PLATEAU | TRIGGER_MILESTONE | TRIGGER_INACTIVE | TRIGGER_PLAN_EXPIRY | MOTIVATION`), segmentation `lose_weight|maintenance|muscle_gain`. bambooIT email campaigns (newsletter, satisfaction surveys, IT update notifications) potrzebują innych semantyk — rebuild w fazie 4.
- `EmailSend` — child model EmailCampaign + `personalData Json` z `{weightTrend, compliance, topMeal}` (diet metrics). Cascade z EmailCampaign.

**SUMA: 8 modeli.**

---

## §2. ENUMS DO USUNIĘCIA w K5c (5)

| Enum | L | Used by | Status |
|---|---|---|---|
| `ProtocolScope` | 61 | NutritionProtocol.scope | DROP |
| `RecipeComplexity` | 66 | NutritionProtocol.recipeComplexity | DROP |
| `BmrFormula` | 72 | NutritionProtocol.bmrFormula | DROP |
| `ClinicalRuleType` | 445 | ClinicalRule.type | DROP |
| `RuleSeverity` | 450 | ClinicalRule.severity | DROP |

**SUMA: 5 enums.** Wszystkie używane tylko przez K5c modele — czysty drop.

**Po K5c pozostają enums (7):** UserRole, ProductType, OrderStatus, SubscriptionStatus, SubscriptionPlan, TestimonialStatus, ConsentType. Wszystkie generic bambooIT-relevant.

---

## §3. FOREIGN KEYS — 🟥 manual schema edit PRZED migration

### 3.1 `User` — 3 FK lines do K5c USUWANYCH
| L | Field | Cel | Action |
|---|---|---|---|
| 131 | `ownedProtocols NutritionProtocol[] @relation("DietitianProtocols")` | NutritionProtocol | DROP |
| 132 | `protocolAccesses DietitianProtocolAccess[] @relation("DietitianProtocolAccesses")` | DietitianProtocolAccess | DROP |
| 135 | `protocolAssignments DietitianProtocolAccess[] @relation("ProtocolAssignments")` | DietitianProtocolAccess | DROP |

### 3.2 `DietitianProfile` (decyzja: drop w K7, sprawdzono w K5c)
**Zero FK lines** do K5c USUWANYCH. `DietitianProtocolAccess.dietitian` wskazuje na **User** (`@relation("DietitianProtocolAccesses")`, L606), NIE na DietitianProfile. Drop K5c nie tyka DietitianProfile — pasuje semantycznie do K7 (UserRole rename razem).

### 3.3 `Patient`, `Order`, `Subscription`, `Testimonial`, `Post`, `Referral*`, etc.
**Zero FK lines** — żaden ZOSTAJĄCY model poza User nie ma relacji do K5c USUWANYCH.

### 3.4 Wewnątrz K5c (auto-drop z modelem, Prisma handle)
- NutritionProtocol.accessGrants → DietitianProtocolAccess (drop razem)
- NutritionProtocol.triggers → ProtocolTrigger (drop razem)
- ProtocolTrigger.protocol → NutritionProtocol
- ProtocolConflict — standalone (sprawdzono — brak FK do NutritionProtocol direct, tylko `triggerAField/B/Value` to inline strings, nie relations)
- ClinicalRule.history → ClinicalRuleHistory + ClinicalRuleHistory.rule
- DietitianProtocolAccess: 3 FK (dietitian → User, protocol → NutritionProtocol, assignedByUser → User) — User strony znikną przez schema edit §3.1

**SUMA: 3 FK lines manual edit (wszystkie w User).**

---

## §4. KONSUMENCI W KODZIE — pre-migration cleanup

### 4.1 Result `grep -rn "prisma\.(nutritionProtocol|protocolTrigger|protocolConflict|dietitianProtocolAccess|clinicalRule|clinicalRuleHistory)" apps/backend/src/`

**ZERO matches** ✅

Cały clinical backend (controllers, services, routes) został usunięty w K2a/b/c. Zero pre-migration code cleanup wymagane.

### 4.2 EmailCampaign / EmailSend consumers
W K2c usunąłem:
- `emailCampaign.service.ts`, `emailCampaignWorker.service.ts`
- `routes/emailCampaign.routes.ts`
- `/email-campaigns` mount w server.ts
- admin/email-kampanie page (dropped w K4)

**Pozostały tylko modele** — drop schema-level, zero code consumers.

### 4.3 admin.routes.ts mount admin email-campaigns
Sprawdziłem — w K4 admin/email-kampanie route page miał header TODO 4-cleanup ("backend route /email-campaigns removed in K2c"). Page nadal istnieje jako sierota ale **nie używa Prisma** — to frontend admin page placeholder.

W K5c nic nie ruszam w admin/email-kampanie page (już placeholder po K4).

---

## §5. PRE-MIGRATION

### 5.1 Backup BEZWZGLĘDNIE
```bash
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db \
  > backup_pre_5c_$(date +%Y%m%d_%H%M%S).sql
```

### 5.2 Pre-drop counts (oczekiwanie: 0)
```sql
SELECT (SELECT COUNT(*) FROM "NutritionProtocol") AS protocols,
       (SELECT COUNT(*) FROM "ClinicalRule") AS rules,
       (SELECT COUNT(*) FROM "EmailCampaign") AS email_campaigns;
```

---

## §6. MIGRATION COMMAND

```bash
cd packages/database && npx prisma migrate dev --name drop_diet_clinical_models
```

Helper: `scripts/cleanup-helpers/k5c-schema-drop.js` (analog K5a/K5b).

---

## §7. POST-MIGRATION SANITY

1. `npm run typecheck` — expect exit 0 (no backend consumers)
2. DB: **21 user tables** (29 − 8 = 21)
3. `_prisma_migrations`: 4 rows (baseline + K5a + K5b + K5c)
4. Sanity że DietitianProfile, Patient, User, Order, Subscription, AuditLog, Testimonial, etc. nadal istnieją

---

## §8. K5c.5 follow-up preview

Po K5c sprawdzę `apps/web/src/types/api.ts` + `apps/web/src/lib/api.ts` na clinical sieroty:

**Spodziewane drop'y w types/api.ts:**
- ClinicalRule, ClinicalRuleHistory, ClinicalRuleType, RuleSeverity, ClinicalRuleSource
- NutritionProtocol, NutritionProtocolCreateData, DietitianProtocolWithAccess
- ProtocolAssignedDietitian, ProtocolTrigger, ProtocolTriggerCreateData
- ProtocolConflict, ProtocolConflictCreateData, MatchedProtocolEntry,
- DetectedConflictEntry, MergedProtocolSummary, MatchedProtocolsResponse
- MacroRatio, MacroRatios, CaloricAdjustments, MealSlot, FoodRestriction, AvoidCategory
- MonthlyReport (z K5b.5 zapowiedziane — dietitianReport service już dropped, type to sierota)
- ProtocolStatus / ConflictResolution (jeśli istnieją)

**Spodziewane drop'y w lib/api.ts:**
- protocols, dietitianProtocol, protocolTriggers, protocolConflicts sections (4 sekcje)
- clinicalRules section
- report section (uses MonthlyReport — dietitianReport.service dropped)

Jeśli >50 linii → osobny commit K5c.5.

Helper: użyję istniejącego `scripts/cleanup-helpers/k5b5-types-drop.js` z extended `PLANNING_TYPE_NAMES` + `LIB_SECTION_NAMES` lists (możliwa renowacja na `k5c5-types-drop.js` jeśli kopiuję plik).

---

## §9. COMMIT MESSAGE PROPOSAL

```
chore(cleanup): drop diet clinical + email campaign models (KROK 5c)

Drop 8 Prisma models + 5 enums + 3 FK lines from User covering the
diet clinical stack (protocols, rules, triggers, conflicts) plus
email campaign sweep (models orphaned after K2c service drop).

Migration history note:
Final "wielka chirurgia" on schema before K6/K7 renames. After this
commit DB has 21 user tables (was 29 after K5b, 80 at baseline) +
4 entries in _prisma_migrations.

Models dropped (clinical core, 6):
- NutritionProtocol (protocols żywieniowe)
- DietitianProtocolAccess (join table dietitian↔protocol)
- ProtocolTrigger (auto-match rules)
- ProtocolConflict (BLOCK/WARN conflicts)
- ClinicalRule (POLICY / RED_FLAG)
- ClinicalRuleHistory (audit trail)

Models dropped (email sweep, 2):
- EmailCampaign — type 100% diet (WEEKLY_SUMMARY, TRIGGER_PLATEAU,
  TRIGGER_MILESTONE etc.), segmentation lose_weight/maintenance/muscle_gain
- EmailSend — diet personalData {weightTrend, compliance, topMeal}
Both orphaned after K2c (emailCampaign.service.ts +
emailCampaignWorker.service.ts dropped). bambooIT email campaigns
(newsletter, satisfaction surveys) rebuild from scratch in faza 4.

Enums dropped: ProtocolScope, RecipeComplexity, BmrFormula,
ClinicalRuleType, RuleSeverity.

Schema relations dropped from REMAINING models (3 FK lines):
- User: ownedProtocols, protocolAccesses, protocolAssignments

DietitianProfile NOT touched in K5c — drop scheduled for K7 alongside
UserRole DIETITIAN removal (semantic grouping: role + profile = same
business concept).

Pre-migration code cleanup: ZERO. All clinical/email backend consumers
already removed in K2a/b/c (controllers, services, routes).

Migration: drop_diet_clinical_models
SQL: ~12 DropForeignKey + 8 DropTable + 5 DropEnum + 0 AlterTable.

DB state after migration: 21 user tables (was 29 after K5b),
4 entries in _prisma_migrations.

REMAINING schema (21 models) is fully bambooIT-ready except:
- Patient (K6 rename → Company)
- DietitianProfile (K7 drop with DIETITIAN role)

K5c.5 follow-up commit will clean up apps/web/src/types/api.ts +
apps/web/src/lib/api.ts orphan clinical types (NutritionProtocol,
ClinicalRule, ProtocolTrigger, ProtocolConflict, MonthlyReport, etc.)
plus protocols/clinicalRules sections in api object.
```

---

## §10. ROLLBACK
Standard z K5a/K5b: `git reset --hard`, `pg_restore` z backup, `prisma generate`.

---

## §11. 3 USER GATES

1. **"ok 5c final"** → start (audit done, this preview accepted)
2. **"ok migrate"** → po `git diff schema.prisma` + `prisma validate` + `prisma migrate diff --script` preview
3. **"ok commit"** → po `migrate dev` applied + typecheck + DB sanity

### Pełna sekwencja po "ok 5c final"

1. **Pre-migration code cleanup**: ZERO actions needed (no consumers in code)
2. **Backup BEZWZGLĘDNIE**: `pg_dump > backup_pre_5c_*.sql`
3. **Pre-drop counts**: SELECT COUNT(*) FROM clinical+email tables (expect 0)
4. **Helper script**: utworzę `scripts/cleanup-helpers/k5c-schema-drop.js` z 8 MODELS + 5 ENUMS + User 3 FK lines
5. **Schema edit**: run helper
6. **🛑 Gate 2**: `git diff schema.prisma` + `prisma validate` + `migrate diff --script` preview SQL. CZEKAM na "ok migrate"
7. **Migration**: `prisma migrate dev --name drop_diet_clinical_models`
8. **🛑 Gate 3**: `migration.sql` from disk + typecheck + DB \dt count. CZEKAM na "ok commit"
9. **Commit K5c**
10. **K5c.5 follow-up**: drop diet clinical types/methods z `types/api.ts` + `lib/api.ts` (analog K5a.5/K5b.5)

---

## §12. NICE-TO-HAVE SANITY CHECK (zero niespodzianek przed start)

| Check | Wynik |
|---|---|
| Liczba modeli K5c | 8 (6 clinical + 2 email sweep) ✅ <10 |
| Liczba enums K5c | 5 ✅ |
| Konsumenci w backend code | **0** (clinical i email backend dropped w K2a/b/c) ✅ |
| FK z ZOSTAJĄCYCH (User only) | 3 lines ✅ |
| DietitianProtocolAccess.dietitian | wskazuje na User, NIE DietitianProfile ✅ |
| DietitianProfile FK do K5c | 0 ✅ (drop razem z K7) |
| Sieroty z K5a/K5b w schemie | 0 ✅ (IngredientSubstitutionRule/HouseholdMeasure/ManualReviewQueue/DataQualityIssue/ImportJob — wszystko dropped w K5a) |
| Patient/Order/Subscription FK do K5c | 0 ✅ |

**Zero niespodzianek. Standardowy K5c flow.**

K5c jest **ostatnią dużą schemą chirurgią** — po nim schema jest fully bambooIT-ready poza dwoma planowanymi renames (K6 Patient→Company, K7 drop DietitianProfile + DIETITIAN role).
