# DELETION_PREVIEW_5b.md — KROK 5b: drop diet planning models

**Status:** PROPOZYCJA. Czekam na "ok 5b final".
**Branch:** `main` (HEAD = `50cf94c`)
**Migration name proposal:** `drop_diet_planning_models`
**Schema state pre-K5b:** 1314 linii, 50 models, 16 enums

---

## §1. MODELE DO USUNIĘCIA w K5b (19 + 2 grey-area)

### 1.1 Planning core (8)
- `DietPlan` (L286)
- `DietPlanRevision` (L592)
- `Meal` (L505)
- `MealSwap` (L333)
- `NutritionTargets` (L471)
- `FrequentInput` (L492)
- `DayRegeneration` (L1192)
- `DietitianNote` (L846)

### 1.2 Templates (4)
- `TemplatePlan` (L543)
- `TemplateMeal` (L567)
- `DietTemplate` (L687)
- `NoteTemplate` (L862)

### 1.3 Patient tracking (5)
- `CheckIn` (L611)
- `BodyMeasurement` (L1219)
- `LabPanel` (L369)
- `SupplementPrescription` (L643)
- `Interview` (L223)

### 1.4 Messaging (2)
- `Conversation` (L1238)
- `Message` (L1258)

**SUMA core: 19 modeli.**

### 1.5 ⚠️ GREY-AREA: `AiUsageLog` + `AiCostLog`

Original §5 Q7 plan: "AiCostLog/AiUsageLog reusable pod Claude API tracking → zostają."

**Po inspekcji wykryto** że oba modele są w 100% diet-AI-pipeline glue:

**`AiCostLog` (L1123-1140):**
- `dietPlanId String` (required) + `dietPlan DietPlan @relation(...)` + `@@index([dietPlanId])`
- Cały model jest "AI cost per diet plan generation" — nie ma generic context (userId, sessionId)

**`AiUsageLog` (L728-770):**
- `patientId String` + `patient Patient @relation(...)`
- `dietPlanId String?` (nullable, no FK)
- Diet-AI pipeline fields: `source` (template|candidate_meals|fallback|n8n), `validationStatus`, `policyRulesCount`, `redFlagsCount`, `redFlagSeverity`, `stepTimings`
- Wszystkie pola są diet-AI-pipeline specific

**Decyzja proponowana: USUWAMY oba w K5b** (odstępstwo od Q7).
Powód: Claude API tracking dla bambooIT (chat IT helpdesk) ma inne semantyki — `companyId`, `sessionId`, `model`, `tokens`, `cost`, `feature` (chat/ticket-suggest/etc.). Zostawienie pustego skeletu z FK-removed polami daje mniej niż rebuild od zera.

**Alternatywa B (literal Q7):** Zachowaj modele, drop tylko FK refs (Patient, DietPlan). Modele zostają jako "generic AI log skeleton" do rebuild w fazie 4. Wymaga ALTER TABLE DROP COLUMN x4 (patientId, dietPlanId w AiUsageLog; dietPlanId w AiCostLog).

**Wybór: A (drop) lub B (keep skeleton)? Daj znać w "ok 5b final".** Default jeśli nie napiszesz: **A** (drop, czystsze).

**SUMA: 19 modeli + 2 grey-area = 21 modeli (jeśli A) albo 19 + 2 cleanups (jeśli B).**

---

## §2. ENUMS DO USUNIĘCIA w K5b (8)

| Enum | Location | Used by | Status |
|---|---|---|---|
| `DietPlanSource` | L16 | DietPlan L293 | DROP |
| `DietPlanStatus` | L21 | DietPlan L294 | DROP |
| `DietPlanRevisionReason` | L583 | DietPlanRevision | DROP |
| `DayRegenReason` | L31 | DayRegeneration | DROP |
| `DayRegenStatus` | L1211 | DayRegeneration | DROP |
| `MealType` | L84 | Meal L509 | DROP |
| `DietType` | L92 | Meal L510 + DietTemplate L552 | DROP |
| `ValidationStatus` | L78 | DietPlan L309 + AiUsageLog (komentarz) | DROP |

**NIE TYKAMY (clinical, K5c):**
- `RecipeComplexity` (L109) — `NutritionProtocol.recipeComplexity` (L1031)
- `BmrFormula` (L115) — `NutritionProtocol.bmrFormula` (L1018)

---

## §3. FOREIGN KEYS — 🟥 manual schema edit PRZED migration

### 3.1 `User` (L148-187) — 6 FK lines do USUWANYCH
| L | Field | Cel |
|---|---|---|
| 170 | `dietitianNotes DietitianNote[] @relation("NoteDietitian")` | DietitianNote |
| 171 | `noteTemplates NoteTemplate[] @relation("TemplateDietitian")` | NoteTemplate |
| 182 | `conversationsAsPatient Conversation[]` | Conversation |
| 183 | `conversationsAsDietitian Conversation[]` | Conversation |
| 184 | `sentMessages Message[]` | Message |
| 186 | `supplementPrescriptions SupplementPrescription[]` | SupplementPrescription |

### 3.2 `Patient` (L189-221) — 9 FK lines do USUWANYCH
| L | Field | Cel |
|---|---|---|
| 208 | `interviews Interview[]` | Interview |
| 209 | `dietPlans DietPlan[]` | DietPlan |
| 211 | `labPanels LabPanel[]` | LabPanel |
| 212 | `nutritionTargets NutritionTargets?` | NutritionTargets |
| 213 | `checkIns CheckIn[]` | CheckIn |
| 214 | `aiUsageLogs AiUsageLog[]` | AiUsageLog (jeśli A=drop) |
| 215 | `dietitianNotes DietitianNote[]` | DietitianNote |
| 216 | `bodyMeasurements BodyMeasurement[]` | BodyMeasurement |
| 217 | `supplements SupplementPrescription[]` | SupplementPrescription |

### 3.3 `NutritionProtocol` (clinical L1004) — 1 FK line
| L | Field | Cel |
|---|---|---|
| 1048 | `dietPlans DietPlan[] @relation("DietPlanProtocol")` | DietPlan |

### 3.4 `Order` (L353)
Sprawdzę: Order ma `dietPlan` relation? Wcześniej grep wskazywał na `order.service.ts:267,325 prisma.dietPlan.findFirst` — to lookup po `patientId/userId`, nie FK relation. **Order nie ma FK do K5b** (verified by grep). OK.

**SUMA: 16 FK lines do manual edit (jeśli A — AiCostLog/AiUsageLog drop)** lub **14 lines + 4 ALTER COLUMN** (jeśli B — keep skeletons).

---

## §4. KONSUMENCI W KODZIE — pre-migration cleanup

### 4.1 `apps/backend/src/services/admin.service.ts` — 5× `prisma.dietPlan.count` + 1× `prisma.interview.count`
L260-264 w `getStats()`. **Strategia:** comment TODO(5b-cleanup) + drop odpowiednie return fields (`interviews`, `dietPlans.{total, byStatus}`).

### 4.2 `apps/backend/src/controllers/admin.controller.ts:637` — `prisma.frequentInput.findMany`
W `getFrequentInputs()` handler — admin endpoint `/admin/frequent-inputs`. **Strategia:** comment cały handler TODO(5b-cleanup). Plus zakomentuj mount w `admin.routes.ts` (jeśli istnieje).

### 4.3 `apps/backend/src/services/dsar.service.ts:126,136` — 🟥 RODO scope
DSAR (Data Subject Access Request) export używa `prisma.interview.findMany()` + `prisma.dietPlan.findMany()` żeby wyeksportować dane patientu zgodnie z RODO art. 15.

**Po drop modeli — eksport zwróci empty arrays.** Strategia: comment z TODO(5b-cleanup) "RODO export of removed diet domain — rebuild for bambooIT data (companies, tickets, invoices) in faza 4". RODO compliance pozostaje dla DZIAŁAJĄCYCH danych (User, AuditLog, UserConsent) — tylko diet sections puste.

### 4.4 `apps/backend/src/services/order.service.ts:267,325` — `prisma.dietPlan.findFirst`
Sprawdzę kontekst — to lookup "delivered plan for this order". Po drop DietPlan, ta logic znika. **Strategia:** comment TODO(5b-cleanup), rebuild w fazie 4 (bambooIT order = abonament IT, nie diet plan).

### 4.5 `apps/backend/src/services/accounting.service.ts:142` — `prisma.aiUsageLog.findMany` (jeśli A)
Jeśli AiUsageLog dropped → comment TODO(5b-cleanup). Accounting service zostaje, ale AI cost section puste do fazy 4.

### 4.6 `apps/backend/src/services/aiUsage.service.ts` — cały plik (jeśli A)
Service używa `prisma.aiUsageLog.create/findMany/count`. Jeśli AiUsageLog drop:
- **Drop cały plik** w K5b (analogicznie do K2c services drop)
- Cascade: admin.controller imports `getAiUsageStats, listAiUsageLogs from aiUsage.service` → drop imports + handlery (`getAiUsage`, `listAiUsage`) — wszystkie sieroty po admin/ai-usage routes które już dropped w K2c

Jeśli B (keep skeleton) → service zostaje ale wymaga rewrite pod nowe pola (`aiUsageLog.create({ userId, model, tokens })` zamiast `{ patientId, dietPlanId, ... }`).

---

## §5. PRE-MIGRATION — backup

### 5.1 DB state
```bash
docker ps --filter "name=bambooit_postgres" 
```
Postgres na port 5433 (po K5a). Już up. Sprawdzę przed K5b żeby się upewnić.

### 5.2 Backup BEZWZGLĘDNIE
```bash
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db \
  > backup_pre_5b_$(date +%Y%m%d_%H%M%S).sql
```

### 5.3 Pre-drop counts (oczekiwanie: wszystkie 0)
```sql
SELECT (SELECT COUNT(*) FROM "DietPlan") AS diet_plans,
       (SELECT COUNT(*) FROM "Interview") AS interviews,
       (SELECT COUNT(*) FROM "Meal") AS meals,
       (SELECT COUNT(*) FROM "CheckIn") AS checkins,
       (SELECT COUNT(*) FROM "BodyMeasurement") AS body_measurements,
       (SELECT COUNT(*) FROM "Conversation") AS conversations,
       (SELECT COUNT(*) FROM "Message") AS messages,
       (SELECT COUNT(*) FROM "AiCostLog") AS ai_cost_logs,
       (SELECT COUNT(*) FROM "AiUsageLog") AS ai_usage_logs;
```

---

## §6. MIGRATION COMMAND

```bash
# Schema edit done first (drop 19+2 models + 8 enums + 16 FK lines)
cd packages/database && npx prisma migrate dev --name drop_diet_planning_models
```

Helper script: utworzę `scripts/cleanup-helpers/k5b-schema-drop.js` (analogicznie do K5a, inna lista MODELS_TO_DROP/ENUMS_TO_DROP).

---

## §7. POST-MIGRATION SANITY

1. `npm run typecheck`
2. Akceptowalny: exit 0 LUB "Cannot find module/type" tylko do usuniętych planning models (np. w types/api.ts/lib/api.ts → K5b.5)
3. DB sanity: `docker exec ... \dt | wc -l` → expected ~50 - 19 - 2 (jeśli A) = **29 user tables**

---

## §8. K5b.5 follow-up (analogicznie do K5a.5)

Po K5b sprawdzę `apps/web/src/types/api.ts` + `apps/web/src/lib/api.ts` na sieroty planning types:
- DietPlan, DietPlanRevision, MealSwap, Interview, LabPanel, CheckIn, BodyMeasurement, NutritionTargets, etc.
- Plus `PlanComparisonSide`, `SlotDecision`, `PlanQualityData`, `MicronutrientReport`, `DietToolkitData`, etc. (interface w types/api.ts zostały po K5a.5)

Jeśli >100 linii → osobny commit `K5b.5: chore(cleanup): remove orphan diet planning types from frontend api layer`.

`lib/api.ts` ma `dietPlans` section z fetch methods + dozens of inline diet types — duży drop.

---

## §9. COMMIT MESSAGE PROPOSAL

```
chore(cleanup): drop diet planning models (KROK 5b)

Drop 19 Prisma models + 2 grey-area (AiCostLog/AiUsageLog) + 8 enums
covering the diet planning + tracking + messaging stack.

Models dropped (planning core, 8): DietPlan, DietPlanRevision, Meal,
MealSwap, NutritionTargets, FrequentInput, DayRegeneration, DietitianNote.

Models dropped (templates, 4): TemplatePlan, TemplateMeal, DietTemplate,
NoteTemplate.

Models dropped (patient tracking, 5): CheckIn, BodyMeasurement, LabPanel,
SupplementPrescription, Interview.

Models dropped (messaging, 2): Conversation, Message.

Grey-area drop (2): AiCostLog, AiUsageLog. Both 100% diet-AI-pipeline
glue (dietPlanId/patientId FKs, diet-specific fields like
validationStatus/redFlagsCount/source=n8n). Rebuild from scratch for
bambooIT Claude API tracking in faza 4 with companyId/sessionId/feature
semantics. Diverges from §5 Q7 plan which kept them as "reusable
skeletons" — analysis showed there was no reusable infrastructure.

Enums dropped: DietPlanSource, DietPlanStatus, DietPlanRevisionReason,
DayRegenReason, DayRegenStatus, MealType, DietType, ValidationStatus.

Schema relations dropped from REMAINING models:
- User: dietitianNotes, noteTemplates, conversationsAsPatient,
  conversationsAsDietitian, sentMessages, supplementPrescriptions (6 FK)
- Patient: interviews, dietPlans, labPanels, nutritionTargets, checkIns,
  aiUsageLogs, dietitianNotes, bodyMeasurements, supplements (9 FK)
- NutritionProtocol: dietPlans (1 FK)

Pre-migration code cleanup (TODO 5b-cleanup):
- admin.controller.ts: getFrequentInputs handler
- admin.service.ts: 4× dietPlan.count + interview.count in getStats() +
  return fields
- accounting.service.ts: aiUsageLog.findMany cost lookup
- dsar.service.ts: interview/dietPlan RODO exports (rebuild bambooIT
  data export in faza 4 — User/AuditLog/UserConsent exports stay)
- order.service.ts: dietPlan.findFirst delivered-plan lookup (rebuild
  bambooIT order semantics in faza 4)
- aiUsage.service.ts: entire file dropped (sole consumer of AiUsageLog)

Migration: drop_diet_planning_models
SQL: ~20 DropForeignKey + 21 DropTable + 8 DropEnum.

DB state after migration: ~29 user tables (was 50 after K5a),
3 entries in _prisma_migrations.
```

---

## §10. ROLLBACK
Standard z K5a: `git reset --hard`, `pg_restore` z backup, `prisma generate`.

---

## §11. 3 USER GATES (analogicznie do K5a)

1. **"ok 5b final"** + decyzja A/B dla AiCostLog/AiUsageLog → start
2. **"ok migrate"** → po `git diff schema.prisma` + `prisma validate` + `prisma migrate diff --script` preview
3. **"ok commit"** → po `migrate dev` applied + typecheck + DB sanity

### Pełna sekwencja po "ok 5b final"

1. **Pre-migration code cleanup** w `admin.routes.ts`, `admin.service.ts`, `admin.controller.ts`, `accounting.service.ts`, `dsar.service.ts`, `order.service.ts`, ewentualnie drop `aiUsage.service.ts` (jeśli A)
2. **Verify DB up** (`docker ps`)
3. **Pre-drop counts** (expected: 0 for fresh DEV)
4. **Backup BEZWZGLĘDNIE**: `pg_dump > backup_pre_5b_*.sql`
5. **Schema edit**: drop 19+2 models + 8 enums + 16 FK lines via helper script `scripts/cleanup-helpers/k5b-schema-drop.js`
6. **🛑 Gate 2**: pokażę `git diff schema.prisma` + `prisma validate` + `migrate diff --script` SQL preview. CZEKAM na "ok migrate"
7. **Migration**: `prisma migrate dev --name drop_diet_planning_models`
8. **🛑 Gate 3**: pokażę `migration.sql` from disk + typecheck + DB \dt count + (po typecheck iter komentowania sierot jeśli trzeba). CZEKAM na "ok commit"
9. **Commit K5b**
10. **K5b.5 follow-up**: drop diet planning types/methods z `types/api.ts` + `lib/api.ts`

---

## §12. PYTANIA / DECYZJE PRZED "ok 5b final"

1. **Decyzja A/B dla AiCostLog/AiUsageLog?**
   - **A (default):** drop oba modele + drop aiUsage.service.ts + cleanup admin handlers/imports
   - **B (literal Q7):** keep models, drop tylko FK refs (Patient.aiUsageLogs, AiUsageLog.patient, AiUsageLog.dietPlanId, AiCostLog.dietPlanId + index) — wymaga 4× ALTER TABLE DROP COLUMN

2. **DSAR strategy:** zakomentowuj diet section z TODO(5b-cleanup) "rebuild w faza 4". OK?

3. **`aiUsage.service.ts` drop** (jeśli A): admin.controller `getAiUsage`/`listAiUsage` handlers + admin.routes mount `/admin/ai-usage/*` (sprawdzimy) → comment TODO(5b-cleanup). OK?

Po decyzjach wykonuję Gate 1 → Gate 2 → Gate 3 → commit + K5b.5.

---

## §13. Comprehensive remaining-model FK audit (U4 + A-D)

**Wynik:** ZERO niespodzianek. Lista §3 jest kompletna.

### U4 — NutritionProtocol
- L1048: `dietPlans DietPlan[] @relation("DietPlanProtocol")` — jedyna FK do K5b ✅
- BmrFormula + RecipeComplexity enums + dietitian (User) + accessGrants + triggers — wszystko ZOSTAJE (K5c)

### A — AuditLog
- Tylko `user User?` relation (User ZOSTAJE)
- `resourceType String?` + `resourceId String?` to **soft string refs** (nie FK constraints) — niezagrożone
- **Zero FK lines do drop** ✅

### B — Order
- `patientId String` + `patient Patient @relation(...)` — FK do Patient (ZOSTAJE w K5b, drop w K7)
- **Zero FK lines do K5b** ✅
- (Order.service.ts `prisma.dietPlan.findFirst` to runtime call — TODO 5b-cleanup, już w §4.4)

### C — Subscription
- `userId String @unique` + `user User @relation(...)` — FK do User (ZOSTAJE)
- **Zero FK lines do K5b** ✅

### D — pozostałe ZOSTAJĄCE modele
Audit: Testimonial, ReferralCode, ReferralUsage, Post, BlogCategoryConfig, NotificationPreferences, AppSettings, FeatureFlag, UserConsent, TrialFingerprint, DeviceFingerprint, SecurityBan, PasswordResetToken, EmailVerificationToken, DietitianProfile, EmailCampaign, EmailSend, ClinicalRule, ClinicalRuleHistory, NutritionProtocol, DietitianProtocolAccess, ProtocolTrigger, ProtocolConflict, Tenant — **wszystkie zero FK lines** do K5b USUWANYCH (potwierdzone grep).

### Wewnętrzne back-references (auto-drop z modelem)
- `DietPlan.aiCostLogs AiCostLog[]` (L326) — znika z DietPlan drop (plus AiCostLog drop wariant A)
- `DietPlan.protocol NutritionProtocol? @relation(...)` (L325) — znika z DietPlan drop (NutritionProtocol strona — L1048 — to MANUAL drop)
- `DietTemplate.sourceDietPlanId String?` (L710) — **soft string ref** (nie FK relation), znika z DietTemplate model drop

**Konkluzja:** §3 ma kompletną listę 16 FK lines do manual drop. Helper script może bezpiecznie edytować schema.
