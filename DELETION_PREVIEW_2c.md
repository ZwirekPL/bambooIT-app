# DELETION_PREVIEW_2c.md — KROK 2c: drop diet-specific backend services

**Status:** PROPOZYCJA. Czekam na "ok 2c final" zanim faktycznie usunę pliki.
**Branch:** `main` (HEAD = `e6a4591`)
**Pliki w `services/` pre-2c:** 110

---

## ⚠️ KRYTYCZNA DECYZJA — sekcja 4 (scope ↔ K3)

W trakcie pre-checku ujawniła się decyzja architektoniczna której nie da się zignorować: **workers/queues/scraper/policies/pdf/scripts/tests są 100% zależne od USUWANYCH services**. Trzy opcje rozwiązania w sekcji 4 — wybierz **przed** "ok 2c final".

---

## 1. GREY-AREA decisions (G1–G6 + 3 dodatkowe)

### G1. `paywall.service.ts` → **USUWAMY**
```
isPaywallEnabled(), checkAccess(userId): AccessStatus,
checkDietGenerationLimit(userId), checkSwapLimit(userId)
```
`AccessStatus.weeklyUsage = { dietsGenerated, swapsUsed }` + `getPlanLimits` z `config/planLimits` (diet) + `SETTING_PAYWALL_ENABLED` z appSettings. **100% diet metrics.** bambooIT subscription gating od zera w fazie 4 (limit godzin obsługi IT, nie dietsGenerated).

### G2. `weekly-summary.service.ts` → **USUWAMY**
```
sendWeeklySummary(patientId), sendWeeklySummariesBatch()
WeeklySummaryData { patientId, currentKcal, trends, tips, adaptationApplied }
```
Wszystkie referencje: `prisma.patient`, `getCheckInTrends`, `getNutritionTargets`, `sendWeeklySummaryEmail`. **100% diet.** Generic email digest jeśli będzie potrzebny — od zera w fazie 4.

### G3. `openai.service.ts` → **USUWAMY**
```
isOpenAiConfigured(), getModelForComplexity(SIMPLE|COMPLEX),
estimateCostUsd(model, prompt, completion), callOpenAI(opts)
```
**Generic wrapper** z fallback chain + cost estimation + model selection. ALE plan §2d explicite: `openai (rebuild → claude)`. Claude API ma inny SDK (`@anthropic-ai/sdk`), inne modele (Haiku 4.5), inne pricing, prompt caching. Przepisanie od zera w fazie 4 jest mniej pracy niż konwertowanie OpenAI-shape wrappera. Plus każdy konsument (`workers/dietGenerate.worker.ts` etc.) i tak idzie do K3.

### G4. `dietitianReport.service.ts` → **PROPONUJĘ USUNIĘCIE** ⚠️
User-stated §5 Q6: "Zostawić szkielet → przemianowanie na `internalReport.service.ts`, logika do przepisania w fazie 4."

**Ale po inspekcji:** plik to 100% diet implementation. `MonthlyReport` ma pola: `patients.total/newThisMonth`, `plans.generated/reviewed/published/manualReviewRequired`, `compliance.averagePercent/checkInsCount`, `goalProgress.patientsWithGoal/patientsReachedGoal`, `patientSummaries[].weightChangeKg/avgCompliance/checkInsCount`. **Nie ma żadnego "szkieletu"** do przepisania — to konkretne queries na `prisma.patient`, `prisma.dietPlan`, `prisma.checkIn`. Plus `dietitianReportPdf.service` (do usunięcia w K3) zależy od typu `MonthlyReport` z tego pliku.

**Propozycja:** zamiast trzymać 100%-diet plik jako "szkielet", **usuwam całkowicie** i w fazie 4 napiszę `internalReport.service.ts` od zera z bambooIT-specific metrics (MRR, churn, active companies, ticket volume). Decyzja Q6 zostaje **zachowana w duchu** (osobny report service w fazie 4) ale wykonanie inne (rebuild zamiast rename).

**Jeśli chcesz literalnie trzymać Q6 → daj znać w "ok 2c final"**, wtedy zostawiam plik z notką "do rebuild w fazie 4" (ale wówczas też trzeba zatrzymać `dietitianReportPdf.service` w K3, bo on dep'uje od tego pliku).

### G5. `aiUsage.service.ts` → **ZOSTAJE** ✅ (potwierdzenie z 2b)
`PipelineTimer`, `StepTiming`, `getAiUsageStats`, `listAiUsageLogs`. Generic infra (per §5 Q7). Brak osobnego `aiCost.service.ts` w repo — istniał tylko aiCost.controller (usunięty w 2b).

### G6. `onboarding.service.ts` + `onboarding.controller.ts` → **USUWAMY OBA** ⚠️
Service: `OnboardingStatus { profileComplete (sex, birthYear, heightCm, weightKg), trialActive, interviewComplete (Interview model) }` + `DietitianOnboardingStatus`. **100% diet roles (PATIENT, DIETITIAN) + Interview model.**

Controller: sierota po 2a (`onboarding.routes.ts` usunięte). Importuje `getOnboardingStatus, getDietitianOnboardingStatus`.

**Propozycja:** Usuwamy **oba w 2c** (service + controller razem). bambooIT onboarding (Company onboarding step) od zera w fazie 4. Plan §1c miał "onboarding (rebuild)" — wykonanie inne (delete + rebuild zamiast keep skeleton).

### G7. `emailCampaign.service.ts` + `emailCampaignWorker.service.ts` + `routes/emailCampaign.routes.ts` → **PROPONUJĘ USUNIĘCIE** ⚠️
Service typy: `WEEKLY_SUMMARY | DIETITIAN_SUMMARY | TRIGGER_PLATEAU | TRIGGER_MILESTONE | TRIGGER_INACTIVE | TRIGGER_PLAN_EXPIRY`. **100% diet workflow** (plateau detection, milestone tracking, plan expiry reminders).

Plan §1e/§2c miał `emailCampaign.routes.ts` jako ZOSTAJE, ale **service i worker są 100% diet**. Routes bez działającego service to nonsense.

**Propozycja:** USUWAMY 3 pliki razem (`emailCampaign.service.ts`, `emailCampaignWorker.service.ts`, `routes/emailCampaign.routes.ts`) + edit `server.ts` (drop mount `/email-campaigns`). Plan §2c trochę naruszony, ale logicznie czysto. Generic email campaign skeleton dla bambooIT (newsletter, ankiety satysfakcji) od zera w fazie 4.

### G8. `dbFeatureFlag.service.ts` → **PROPONUJĘ USUNIĘCIE** ⚠️
Plik nazywa się generic ("DB-first Diet Generation Feature Flag"). Plan §1c miał go jako ZOSTAJE. **Ale zawartość:** modes `OFF | DB_ONLY | DB_FIRST | DB_SOLVER | AB_TEST` dla `db_first_diet_generation` flag — to **diet glue** owijające generic `featureFlag.service.ts`.

`featureFlag.service.ts` (generic) **ZOSTAJE**. `dbFeatureFlag.service.ts` (diet wrapper) — proponuję USUNĄĆ.

### G9. `middleware/paywall.ts` (NIE-service, ale powiązane) → **USUWAMY**
`requireActiveOrder()` middleware używa `checkAccess` z paywall.service. Sierota — `grep middleware/paywall` w `apps/backend/src/` = 0 matches. Wszyscy konsumenci tej middleware byli w `diet-plans`/`interviews`/`orders` route'ach które zostały usunięte w 2a. Plik to czysty dead code.

---

## 2. ZOSTAJĄCE services (29 + 0 grey-area)

```
accounting, admin, adminSubscription, aiUsage, antiAbuse, appSettings,
audit, auditRetention, auth, ban, blog, blogCategory, checkout, consent,
deviceFingerprint, dsar, featureFlag, notificationPreferences, order,
profile, referral, securityMonitoring, stripe, stripeAdmin, subscription,
testimonial, trialFingerprint, user, userCleanup
```

**29 services.** Wszystkie z planu §1b-1e + aiUsage per §5 Q7.

---

## 3. USUWANE services — pogrupowane (81 plików + 3 grey-area + 1 middleware = 85)

### 3.1 Diet planning stack (14)
`dietPlan`, `dietToolkit`, `planEffectiveness`, `planPipeline`, `planPostProcessing`, `planQualityCheck`, `planValidation`, `weekSolver`, `dayRegeneration`, `dbPipeline`, `dbPlanAssembly`, `dbPolicyBridge`, `dietTemplateCache`, `revision`

### 3.2 Recipe stack (8)
`recipe`, `recipeCandidate`, `recipeCandidateCache`, `recipeExtraction`, `recipeMealPrep`, `recipeScaler`, `recipeScoring`, `recipeSwap`

### 3.3 Meal/Food stack (10)
`meal`, `mealDistribution`, `mealPrep`, `mealReminder`, `mealSwap`, `foodProduct`, `cleanProduct`, `gramScaling`, `productSelection`, `productNameStandardization`

### 3.4 Clinical stack (8)
`clinicalRule`, `clinicalSafetyCheck`, `protocol`, `protocolMatcher`, `protocolMerger`, `conflictDetector`, `medicationInteraction`, `medicationInteractions.ts` (no .service suffix)

### 3.5 AI stack (7)
`aiGeneration`, `openai`, `promptBuilder`, `slotRepair`, `softValidation`, `segmentation`, `scoringContext`

### 3.6 Patient/Dietitian/Profile (12)
`patient`, `dietitianAlerts`, `dietitianReportPdf`, `dietitianSettings`, `onboarding`, `interview`, `progress`, `bodyMeasurement`, `checkin`, `checkin-trends`, `checkin-adaptation`, `message`

### 3.7 Nutrition utilities (9)
`nutrition`, `nutritionCalculator`, `dietaryNorms.ts` (no .service), `dietCost`, `micronutrientAnalysis`, `retentionFactors.ts` (no .service — verify content first), `giCorrelation`, `supplement`, `labpanel`

### 3.8 Misc diet (11)
`calendar`, `template`, `tenant`, `note`, `noteTemplate`, `rating`, `n8n`, `paywall`, `weekly-summary`, `scraperStats`, `solverStats`

### 3.9 Grey-area (proponowane USUWAMY, 4)
`dietitianReport`, `emailCampaign`, `emailCampaignWorker`, `dbFeatureFlag`

### 3.10 Non-service incidental (1)
`middleware/paywall.ts` (sierota)

**SUMA: 79 services + 3 .ts files + 1 middleware = 83 plików do usunięcia.**

(Wcześniej powiedziałem 85 — poprawka po policzeniu: 78 .service.ts USUWANYCH (110 − 29 ZOSTAJĄCYCH − 3 grey-area do USUWAMY) + 3 .ts no-suffix + 4 grey-area + 1 middleware = **86**. Sanity recount przed git rm.)

**Plus `routes/emailCampaign.routes.ts`** jeśli G7 = USUWAMY → +1 plik.
**Plus `controllers/onboarding.controller.ts`** (sierota po 2a, G6) → +1 plik.

---

## 4. ⚠️ SCOPE DECISION — K3 zależności

Pre-check ujawnił że **WSZYSTKIE** consumers w `workers/`, `scraper/`, `policies/`, `pdf/`, `src/scripts/`, `src/__tests__/` importują USUWANE services. Po `git rm` services typecheck wybuchnie w tych plikach.

### Pliki **całkowicie zależne** od USUWANYCH services:
- `workers/dietGenerate.worker.ts` (importuje openai, promptBuilder, aiGeneration, planQualityCheck, planValidation)
- `workers/dietPartial.worker.ts` (8 USUWANYCH imports)
- `workers/dietRepair.worker.ts` (3 USUWANE imports)
- `queues/index.ts` (uses QUEUE_NAMES.DIET_GENERATE/DIET_REPAIR/DIET_PARTIAL — diet by name)
- `scraper/` cały folder (pipeline + scrapers — 100% diet recipes)
- `policies/` cały folder (clinical-rules, red-flags, protocol seed-data — 100% diet)
- `pdf/` cały folder (diet-plan-template, meal-card, recipes, shopping-list — 100% diet)
- `src/scripts/` (audit-cuisine-coverage, backfill-recipe-*, gpt-classify-cuisine — 100% diet)
- `src/__tests__/{pdf,policies,scraper,smoke/compose-mode}` (diet tests)

Plus `server.ts` linie:
- L46-48: `import { startDietGenerateWorker, startDietRepairWorker, startDietPartialWorker }` (3 imports z workers/)
- L54: `import { shutdownQueues } from './queues'`
- L203-205: `startDietGenerateWorker(); startDietRepairWorker(); startDietPartialWorker();`

### Opcje:

**🟢 OPCJA B (REKOMENDACJA): Rozszerz scope 2c → usuń też workers/, scraper/, policies/, pdf/, src/scripts/, diet __tests__/, queues/, middleware/paywall**

Plus edit `server.ts` (drop 3 worker imports + 1 queues import + 3 worker startup calls).

Plus `REQUIRED_ENV` w server.ts L57-69 — usunąć `OPENAI_API_KEY` (linia 68) jeśli nie ma innego konsumenta (sprawdzę w trakcie).

**KROK 3 z planu staje się ~empty** (wszystko zrobione w 2c). Zaktualizujemy plan po commicie.

Commit message: `chore(cleanup): drop diet services, workers, scraper, policies, pdf, diet tests (KROK 2c + part of K3)`

**+ Argumenty:** Brak dead code z zakomentowanymi imports. Wszystko diet idzie razem. Logicznie zwarte.
**− Argumenty:** Duży commit (~150+ files removed). Trudniejszy review.

**🟡 OPCJA A: Trzymaj scope = TYLKO services**

Zakomentuj wszystkie imports z USUWANYCH services w workers/scraper/pdf/scripts/tests (i wewnątrz: handlery używające). Server.ts edit: zakomentuj 3 worker startup calls + worker imports z TODO 2c-cleanup. Stare workers zostają jako pseudo-zombie code.

**+ Argumenty:** Mniejszy commit. Disciplined scope per krok.
**− Argumenty:** Masa martwego kodu (cały content workers/pdf/scraper jako komentarze). KROK 3 zrobi DOKŁADNIE TĘ SAMĄ pracę co 2c by się odbyć ale na komentowanym kodzie — bezsensowna podwójna robota.

**🔴 OPCJA C: Trzymaj wąski scope = drop services, ZOSTAW workers/etc. nietknięte → typecheck się sypnie**

Niedopuszczalne (commit nie przejdzie sanity check exit 0).

---

## 5. IMPORTERS table — RED FLAGS w **ZOSTAJĄCYCH** plikach (post-2c, post-K3-cleanup)

| Importer (ZOSTAJE) | Linia | Imports USUWANY service | Action |
|---|---|---|---|
| `controllers/onboarding.controller.ts` | L2 | `onboarding.service` | Usuwamy controller razem z service w 2c (G6) |
| `controllers/order.controller.ts` | L8 | `paywall.service` (`checkAccess`) | Zakomentuj import + handler użycia |
| `controllers/profile.controller.ts` | L5 | `patient.service` | Zakomentuj import + handler użycia |
| `controllers/admin.controller.ts` | L10, L13 | mealReminder, patient (już zakomentowane w 2b) | ✅ no-op |
| `routes/admin.routes.ts` | L25, L26 | scraperStats, solverStats (już zakomentowane w 2b) | ✅ no-op |
| `routes/emailCampaign.routes.ts` | L12, L13 | emailCampaign, emailCampaignWorker | Usuwamy plik razem ze service (G7) |
| `middleware/paywall.ts` | L3 | `paywall.service` | Usuwamy plik (G9 sierota) |

### Co trzeba edytować w `controllers/order.controller.ts` i `controllers/profile.controller.ts`:
Sprawdzę dokładnie podczas chirurgii (znaleźć wszystkie miejsca wywołań `checkAccess`/`patientService`) i zakomentuję z TODO 2c-cleanup.

---

## 6. ACCEPTED LIST (po "ok 2c final" + wybór scope A/B)

### A. Pliki do `git rm` (services + grey-area + middleware + orphan controller + email campaign routes) — **86 plików:**

(Pełna lista wygenerowana podczas chirurgii — wstępna kalkulacja: 78 .service.ts + 3 .ts + 4 grey-area + 1 middleware/paywall.ts + 1 controllers/onboarding.controller.ts (G6) + 1 routes/emailCampaign.routes.ts (G7) — czyli RAZEM 88. Final count w commicie.)

### B. (Jeśli OPCJA B) Dodatkowo do `git rm`:
- `apps/backend/src/workers/` (3 pliki + folder)
- `apps/backend/src/queues/` (1 plik + folder)
- `apps/backend/src/scraper/` (cały folder, kilkadziesiąt plików)
- `apps/backend/src/policies/` (cały folder)
- `apps/backend/src/pdf/` (cały folder)
- `apps/backend/src/scripts/` (cały folder, ~50 diet scripts)
- `apps/backend/src/__tests__/{pdf,policies,scraper,smoke}` + tests services które importują USUWANE (ostrożnie — tu wymaga audit per file)
- ~150 plików total

### C. Pliki do modyfikacji (komentowanie / drop imports):
- `apps/backend/src/server.ts`:
  - Drop 3 imports workers (L46-48) i 1 import queues (L54)
  - Drop 3 worker startup calls (L203-205)
  - Drop `OPENAI_API_KEY` z REQUIRED_ENV jeśli nie ma innego konsumenta
- `apps/backend/src/controllers/order.controller.ts` — komentuj paywall import + handler use
- `apps/backend/src/controllers/profile.controller.ts` — komentuj patientService import + handler use

---

## 8. TESTS AUDIT (B w instrukcjach)

### ZOSTAJĄCE (5 test files)
- `__tests__/services/auth.service.test.ts`
- `__tests__/services/auditRetention.service.test.ts`
- `__tests__/services/userCleanup.service.test.ts`
- `__tests__/utils/encryption.test.ts`
- `__tests__/utils/errors.test.ts`

### USUWANE (52 test files + 1 fixture)
- `__tests__/import/nutrition-snapshot.test.ts` (diet)
- `__tests__/pdf/*.test.ts` (2)
- `__tests__/policies/preferredFoods.test.ts`
- `__tests__/scraper/*.test.ts` (12)
- `__tests__/services/*.test.ts` (33 diet — wszystkie poza auth/auditRetention/userCleanup):
  cleanProduct, conflictDetector, dbPipeline (2), dbPlanAssembly, dbPolicyBridge, dietPlan, dietaryNorms, dietitianSettings, gramScaling, interview, legacy-solver-baseline, mealDistribution (2), nutritionCalculator, patient, pipeline.28.0, planValidation (2), productFiltering, promptBuilder, protocolMatcher, protocolMerger, recipe, recipeCandidate, recipeScaler (2), retentionFactors, shoppingEfficiency, solverStats, swapSuggestions, weekSolver
- `__tests__/smoke/*.test.ts` (3 — api/compose-mode/solver, wszystkie diet)
- `__tests__/utils/{composeMealsFlag,cuisineMapping,ingredientDisplayName,nutrition}.test.ts` (4 — wszystkie diet)
- `__tests__/fixtures/faza-d-test-patients.ts` (1 fixture)

### `__tests__/setup.ts` — **MODIFY** (drop SOLVER_SEED line)
```
- process.env.SOLVER_SEED = '42';  // diet OR-Tools solver
```
ENCRYPTION_KEY, JWT_SECRET, APP_URL zostają (generic test env).

**Brak wątpliwości per test — wszystkie sklasyfikowane.**

---

## 7. CZEKAM NA "ok 2c final" + wybór scope

**Potrzebne decyzje:**
1. ✅/❌ Wszystkie 9 grey-area (G1-G9) zgodnie z propozycjami wyżej?
2. ✅/❌ G4 `dietitianReport.service.ts` — **rebuild (usuń) zamiast keep skeleton** (moja rekomendacja sprzeczna z dosłownym §5 Q6)?
3. ✅/❌ G7 `emailCampaign.*` (3 pliki) — usuwamy razem mimo plan §1e ZOSTAJE dla routes?
4. **SCOPE: A czy B?** (jeśli B → KROK 3 z planu staje się prawie pusty)

Po decyzji wykonuję bez kolejnego "ok":
1. Edit `controllers/order.controller.ts`, `controllers/profile.controller.ts` (komentowanie)
2. Edit `server.ts` (jeśli B)
3. `git rm` 86 plików (+ ~150 jeśli B)
4. `npm run typecheck > TYPECHECK_STEP_2c.log 2>&1`
5. Akceptowalny stan: exit 0 lub Cannot find module tylko do świeżo usuniętych. Inne błędy → STOP.
6. Commit z message z sekcji 4 (depending on scope choice)
