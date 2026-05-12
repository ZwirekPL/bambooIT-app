# DELETION_PREVIEW_2b.md — KROK 2b: drop diet-specific backend controllers

**Status:** PROPOZYCJA. Czekam na "ok 2b final" zanim faktycznie usunę pliki.
**Branch:** `main` (HEAD = `7dd8038`)

---

## 1. Lista wstępna z planu §2c + 1 sierota po 2a

| # | Plik | Status decyzji |
|---|---|---|
| 1 | `aiCost.controller.ts` | **GREY-AREA → sekcja 2 (A1)** |
| 2 | `checkin.controller.ts` | pewny — diet |
| 3 | `cleanProduct.controller.ts` | pewny — diet |
| 4 | `clinicalRule.controller.ts` | pewny — diet |
| 5 | `dietCache.controller.ts` | pewny — diet |
| 6 | `dietPlan.controller.ts` | pewny — diet |
| 7 | `dietToolkit.controller.ts` | pewny — diet |
| 8 | `dietitianAlerts.controller.ts` | pewny — diet |
| 9 | `dietitianReport.controller.ts` | **GREY-AREA → sekcja 2 (A3)** |
| 10 | `foodProduct.controller.ts` | pewny — diet |
| 11 | `import.controller.ts` | pewny — diet (food database import) |
| 12 | `interview.controller.ts` | pewny — diet |
| 13 | `labpanel.controller.ts` | pewny — diet |
| 14 | `meal.controller.ts` | pewny — diet |
| 15 | `mealSwap.controller.ts` | pewny — diet |
| 16 | `micronutrient.controller.ts` | pewny — diet |
| 17 | `n8nWebhook.controller.ts` | **GREY-AREA → sekcja 2 (A2)** |
| 18 | `note.controller.ts` | pewny — diet (dietitian notes) |
| 19 | `noteTemplate.controller.ts` | pewny — diet |
| 20 | `patient.controller.ts` | pewny — będzie company.controller w KROK 6 |
| 21 | `planValidation.controller.ts` | pewny — diet |
| 22 | `protocol.controller.ts` | pewny — diet (clinical protocols) |
| 23 | `protocolTrigger.controller.ts` | pewny — diet |
| 24 | `rating.controller.ts` | pewny — diet (recipe ratings) |
| 25 | `recipe.controller.ts` | pewny — diet |
| 26 | `template.controller.ts` | pewny — diet (template plans) |
| 27 | `tenant.controller.ts` | pewny — multi-tenancy out per §5 Q2 |
| 28 | `access.controller.ts` | **NOT ON PLAN LIST** — sekcja 2 (A4) |

**`admin.controller.ts`** — NIE TYKAMY w 2b (osobny admin cleanup step).

---

## 2. GREY-AREA CONTROLLERS

### A1. `aiCost.controller.ts` → **USUWAMY**

**Treść (head + endpoint signatures):**
- Plik 33.9 — admin-only AI cost tracking
- 2 endpoints (via admin.routes.ts):
  - `GET /admin/ai-costs` → `listAiCosts`
  - `GET /admin/ai-costs/:dietPlanId` → `getAiCostForPlan`
- Pierwszy handler `listAiCosts` używa `prisma.aiCostLog.findMany({ include: { dietPlan: { select: { patientId, patient: { firstName, lastName, dietitianId, user: { email } } } } } })`

**Decyzja:** Controller jest **diet-glue** — generic `AiCostLog`/`AiUsageLog` modele (§5 Q7 ZOSTAJĄ) używane z silnie diet-specific joinami (DietPlan, Patient, dietitianId). Po usunięciu modeli DietPlan/Patient w KROK 5 include'y pękną — bezpieczniej napisać od zera w fazie 4 pod Claude API z relacjami `Company`/`User`. **USUWAMY** controller. Modele `AiCostLog`/`AiUsageLog` zostają nietknięte (sprzątniemy w KROK 5).

---

### A2. `n8nWebhook.controller.ts` → **USUWAMY**

**Treść (head 80 linii):**
- POST `/webhooks/n8n` — "Receives AI-generated diet plan from n8n workflow callback. Validates X-N8N-Api-Secret header, then processes and saves the plan."
- Zod schema explicite na diet plan: `dietPlanId: cuid`, `content.days[].meals[].name`, `kcal`, `protein`, `fat`, `carbs`, `ingredients[]`, `recipe: { prepTimeMin, steps, tips, variants: { appliance: 'THERMOMIX'|'AIRFRYER' } }`
- Importuje `processN8nCallback, type N8nCallbackPayload` z `../services/n8n.service`

**Decyzja:** 100% diet workflow (THERMOMIX/AIRFRYER variant of recipes, diet plan structure). **USUWAMY**. Filar 4 (automatyzacje) będzie miał własne n8n webhooks (lead callback, payment notification, IT automation) — od zera w fazie 4.

⚠️ **Side-effect:** mount tej route'y musi też zniknąć. Sprawdziłem `routes/webhook.routes.ts` — `n8nWebhook` jest tam zarejestrowany. W 2b zakomentuję / usunę linię z `webhook.routes.ts` (lub samo usunięcie controller'a sypnie typecheck — wybiorę co czystsze podczas chirurgii). Patrz sekcja 4.

---

### A3. `dietitianReport.controller.ts` → **USUWAMY**

**Treść (head 50 linii):**
- 2 handlery: `getReport`, `exportPdf`
- 47 linii total — thin wrapper:
  ```
  getReport → reportService.getMonthlyReport(userId, month) → JSON
  exportPdf → reportService.getMonthlyReport + generateReportPdf → PDF binary
  ```
- Importuje: `dietitianReport.service` (per §5 Q6 ZOSTAJE jako szkielet, rename do `internalReport.service` w fazie 4) + `dietitianReportPdf.service` (do usunięcia w KROK 3, plik w `apps/backend/src/pdf/`)

**Decyzja:** Controller jest **thin wrapper** — łatwiejszy do napisania od zera w fazie 4 (47 linii) niż czyszczenie zależności PDF service. **USUWAMY** controller. Service `dietitianReport.service` zostaje w 2c (per §5 Q6).

---

### A4. `access.controller.ts` → **USUWAMY** (NEW — nie na planie §2c)

**Treść (full):**
- 18 linii, 1 endpoint: `GET /access/status` → `checkAccess(userId)` z `paywall.service`
- NIE diet, ale **paywall/subscription gate**

**Powód usunięcia:**
1. `access.routes.ts` już usunięte w 2a → controller jest sierotą (zero callers)
2. `paywall.service` ma `(?)` w PLAN §2d — niepewne — sprawdzimy w 2c
3. bambooIT subscription gating zrobimy od zera w fazie 4 (inne semantyki — abonament obsługi IT vs. diet plan access window)

**Decyzja:** **USUWAMY** — sierota infrastrukturalna po 2a.

---

## 3. Pre-flight sanity checks

| # | Check | Komenda | Wynik |
|---|---|---|---|
| 1 | Cross-controller imports | `grep -rn "from.*controllers/" apps/backend/src/controllers/` | ✅ **0 matches** |
| 2 | Middleware → usuwane controllers | `grep -rn "from.*controllers/(aiCost\|...)" apps/backend/src/middleware/` | ✅ **0 matches** |
| 3 | **admin.routes.ts → controllers** | `grep -n "from.*controllers/" apps/backend/src/routes/admin.routes.ts` | 🟥 **18 matches, w tym 11 USUWANYCH** |
| 4 | scripts/ → controllers | `grep -rn "from.*controllers/" scripts/` | ✅ **0 matches** |
| 5 | Frontend → controllers | `grep -rn "apps/backend.*controllers" apps/web/` | ✅ **0 matches** |

Plus dodatkowo wykryte:
- `webhook.routes.ts` mountuje `n8nWebhook` controller — sprawdzę pełniej w sekcji 4.
- `admin.routes.ts` importuje 2 services które same idą do usunięcia: `computeScraperStats` z `scraperStats.service`, `computeSolverStats` z `solverStats.service` (oba inline w admin.routes.ts — linie 22-23 imports + 331-338, 342-357 mount jako inline handlers).

---

## 4. RED FLAGS — admin.routes.ts

### 4.1 Imports do zakomentowania (linie 5-23)
**11 USUWANYCH controller imports:**
- L5: `foodProductController` 🟥
- L6: `recipeController` 🟥
- L7: `mealController` 🟥
- L8: `templateController` 🟥
- L9: `importController` 🟥
- L14: `dietCacheController` 🟥
- L15: `clinicalRuleController` 🟥
- L16: `cleanProductController` 🟥
- L17: `protocolController` 🟥
- L18: `protocolTriggerController` 🟥
- L19: `aiCostController` 🟥

**2 USUWANE service imports (z 2c, ale używane inline w admin.routes):**
- L22: `computeScraperStats` from `scraperStats.service` 🟥
- L23: `computeSolverStats` from `solverStats.service` 🟥

### 4.2 router.X() linie do zakomentowania (admin.routes.ts)
13 bloków endpointów, łącznie **~75 linii** do zakomentowania:

| Linie | Blok | Endpointów |
|---|---|---|
| 84-93 | foodProduct (CRUD + measures + verify) | 10 |
| 96-99, 102-107 | recipe (search, list, CRUD, bulkUpdate, recomputeScores, findDuplicates, mergeRecipes) | 9 |
| 100-101 | import (bulkRecomputeRecipeNutrition, dataQualityReport) | 2 |
| 183-188 | meal (CRUD + candidates) | 6 |
| 191-198 | template-plans (CRUD + match + meals add/remove) | 8 |
| 201-205, 208-209, 212-213 | import (usda, allergens, dietFlags, recompute, import-jobs, dataQuality, reviewQueue) | 9 |
| 220-224 | diet-cache (stats, templates CRUD, invalidate) | 5 |
| 237-246 | clinical-rules (CRUD + bulk + toggle + history + duplicate + restore) | 10 |
| 249-257 | protocols (CRUD + toggle + assign + duplicate) | 9 |
| 260-265 | protocol-triggers (CRUD + toggle) | 6 |
| 268-273 | protocol-conflicts (CRUD + toggle) | 6 |
| 283-295 | clean-products (CRUD + search + bulk + duplicates + merge + history) | 13 |
| 298-299 | ai-costs (list + getByDietPlan) | 2 |
| 331-338 | scraper-stats inline handler | ~8 linii |
| 342-357 | solver-stats inline handler | ~16 linii |

### 4.3 Strategia (Opcja B z twojej rekomendacji)
Zakomentowuję każdy blok z header'em:
```ts
// TODO(2b-cleanup): removed in 2b cleanup, will be trimmed in admin cleanup step
// import * as foodProductController from '../controllers/foodProduct.controller';
// ...
// adminRouter.get('/food-products/categories', foodProductController.listCategories);
// adminRouter.get('/food-products/search', foodProductController.search);
// ...
```

⚠️ **NIE TYKAM:**
- `admin.controller.ts` (zostaje, choć ma diet-specific endpoints jak `listTenants`, `createDietitian` — to admin cleanup step)
- `blog.controller.ts`, `blogCategory.controller.ts`, `stripeAdmin.controller.ts`, `accounting.controller.ts`, `featureFlag.controller.ts`, `upload.controller.ts` — wszystkie ZOSTAJĄ
- Endpoints `admin.controller`:`listTenants`, `createDietitian`, `getDietitianPatients`, `updateDietitian` itp. (linie 32-50) — dalej action — admin cleanup step

---

## 5. RED FLAGS — webhook.routes.ts (sprawdzenie n8nWebhook mount)

Należy sprawdzić podczas chirurgii czy `webhook.routes.ts` ma `import { n8nWebhook } from '../controllers/n8nWebhook.controller'` i `router.post('/n8n', ...)`. Jeśli tak — zakomentuję analogicznie z TODO.

---

## 6. ACCEPTED LIST (po twojej akceptacji)

### Pliki do `git rm` (28):
```
apps/backend/src/controllers/access.controller.ts
apps/backend/src/controllers/aiCost.controller.ts
apps/backend/src/controllers/checkin.controller.ts
apps/backend/src/controllers/cleanProduct.controller.ts
apps/backend/src/controllers/clinicalRule.controller.ts
apps/backend/src/controllers/dietCache.controller.ts
apps/backend/src/controllers/dietPlan.controller.ts
apps/backend/src/controllers/dietToolkit.controller.ts
apps/backend/src/controllers/dietitianAlerts.controller.ts
apps/backend/src/controllers/dietitianReport.controller.ts
apps/backend/src/controllers/foodProduct.controller.ts
apps/backend/src/controllers/import.controller.ts
apps/backend/src/controllers/interview.controller.ts
apps/backend/src/controllers/labpanel.controller.ts
apps/backend/src/controllers/meal.controller.ts
apps/backend/src/controllers/mealSwap.controller.ts
apps/backend/src/controllers/micronutrient.controller.ts
apps/backend/src/controllers/n8nWebhook.controller.ts
apps/backend/src/controllers/note.controller.ts
apps/backend/src/controllers/noteTemplate.controller.ts
apps/backend/src/controllers/patient.controller.ts
apps/backend/src/controllers/planValidation.controller.ts
apps/backend/src/controllers/protocol.controller.ts
apps/backend/src/controllers/protocolTrigger.controller.ts
apps/backend/src/controllers/rating.controller.ts
apps/backend/src/controllers/recipe.controller.ts
apps/backend/src/controllers/template.controller.ts
apps/backend/src/controllers/tenant.controller.ts
```

### Pliki do **modyfikacji** (zakomentowanie z TODO):
- `apps/backend/src/routes/admin.routes.ts` — 13 imports (linie 5-9, 14-19, 22-23) + ~75 linii router.X()
- `apps/backend/src/routes/webhook.routes.ts` — sprawdzenie + ewentualne zakomentowanie n8nWebhook mount

### Pliki ZOSTAJĄCE (18, dla referencji):
```
accounting, admin (NIE TYKANE w 2b), auth, blog, blogCategory, checkout,
dsar, featureFlag, notificationPreferences, order, profile, referral,
stripeAdmin, subscription, testimonial, upload, user, webhook
```

### Oczekiwany typecheck po 2b
- Akceptowalny: **exit 0** (komentowanie powinno wystarczyć)
- Akceptowalny: tylko "Cannot find module" do świeżo usuniętych controllers (gdybym coś przeoczył w admin.routes.ts lub webhook.routes.ts) — wtedy NAPRAWIAM komentowaniem, ponownie typecheck, commit
- Inne błędy → STOP i raport

### Commit message (proponowany)
```
chore(cleanup): drop diet-specific backend controllers (KROK 2b)

Remove 28 controllers: aiCost (diet-glue on AiCostLog via DietPlan/
Patient joins), n8nWebhook (diet plan callback with THERMOMIX/AIRFRYER
recipe variants), dietitianReport (47-line thin wrapper — service kept
per §5 Q6 decision, controller will be rewritten in phase 4),
access (orphan after 2a — paywall service untouched until 2c), plus
24 pure diet domain controllers (checkin, cleanProduct, clinicalRule,
dietCache, dietPlan, dietToolkit, dietitianAlerts, foodProduct,
import, interview, labpanel, meal, mealSwap, micronutrient, note,
noteTemplate, patient, planValidation, protocol, protocolTrigger,
rating, recipe, template, tenant).

admin.routes.ts has imports + router.X() lines commented out with
TODO(2b-cleanup) markers — full surgical trim happens in dedicated
admin cleanup step. webhook.routes.ts n8n mount handled inline.

admin.controller.ts intentionally untouched (admin cleanup step).
AiCostLog / AiUsageLog Prisma models remain (per §5 Q7, dropped in
KROK 5 only if final schema review decides to).
```

---

## 8. admin.controller.ts deps audit (U2)

| Line | Import | Decyzja |
|---|---|---|
| L5 | `adminService` from `services/admin.service` | ✅ zostaje |
| L6 | `logAudit, type AuditAction` from `services/audit.service` | ✅ zostaje (§1d) |
| L8 | `getAiUsageStats, listAiUsageLogs` from `services/aiUsage.service` | ✅ zostaje — generic infrastructure (`PipelineTimer`, `StepTiming`) per §5 Q7 |
| **L9** | **`processMealReminders` from `services/mealReminder.service`** | 🟥 **USUWANY w 2c** — zakomentuj |
| L10 | `appSettings` from `services/appSettings.service` | ✅ zostaje (§1e) |
| **L11** | **`patientService` from `services/patient.service`** | 🟥 **USUWANY w 2c** — zakomentuj |
| L12 | `securityMonitoring` | ✅ zostaje (§1d) |
| L13 | `adminUnlockAccount` from `services/antiAbuse.service` | ✅ zostaje (§1d) |
| L14 | `deviceFingerprint` | ✅ zostaje (§1d) |
| L15 | `banService` | ✅ zostaje (§1d) |
| L17 | `adminSubscription` from `services/adminSubscription.service` | ✅ zostaje (§1c) |
| L18 | `forgotPassword` from `services/auth.service` | ✅ zostaje (§1c) |

### Handlery do zakomentowania (admin.controller.ts):

- **L613-620 `triggerMealReminders`** — wywołuje `processMealReminders()`. Mount w admin.routes.ts L227.
- **L770-789 `unlockPatientProfile`** (sekcja "39.1.2") — wywołuje `patientService.unlockProfile(id)`. Mount w admin.routes.ts L55. Plus `logAudit({ action: 'UNLOCK_PATIENT_PROFILE', resourceType: 'PATIENT', ... })` — diet-specific audit constant, leci razem z handlerem.

### Dodatkowe linie do zakomentowania w admin.routes.ts (poza listą sekcji 4.2):
- **L55**: `adminRouter.post('/patients/:id/unlock-profile', adminController.unlockPatientProfile);`
- **L227**: `adminRouter.post('/trigger-meal-reminders', adminController.triggerMealReminders);`

---

## 9. Test imports audit (U3)

```
grep -rn "from.*controllers/(aiCost|access|checkin|...|tenant)" apps/backend/__tests__/ apps/backend/src/__tests__/
→ 0 matches
```

**0 test imports** — nie ma testów importujących usuwane controllery. ACCEPTED LIST sekcja 6 pozostaje **28 plików** (zero dodatków z testów).

---

## 10. U1 update — n8nWebhook controller is orphan

```
grep -n "n8nWebhook" w całym apps/backend/src/
→ 1 match: tylko w samym pliku controllera (jego eksport)
```

**n8nWebhook nie jest mountowany w żadnym ZOSTAJĄCYM route.** Był prawdopodobnie mountowany w już-usuniętym route'cie 2a (np. dietPlan.routes.ts). Brak tknięcia `webhook.routes.ts` — controller to czysta sierota po 2a.

---

## 7. CZEKAM NA "ok 2b final"

Po "ok 2b final":
1. `git rm` 28 plików (lista §6)
2. Edit `admin.routes.ts` — zakomentuj 13 imports + ~75 router.X linii (TODO markers)
3. Inspekcja + edit `webhook.routes.ts` jeśli mountuje n8nWebhook
4. `npm run typecheck > TYPECHECK_STEP_2b.log 2>&1`
5. Jeśli exit 0 lub tylko "Cannot find module" do diet controllers (gdybym coś przeoczył w admin) → fix → commit
6. Inne błędy → STOP i raport
