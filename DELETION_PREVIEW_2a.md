# DELETION_PREVIEW_2a.md — KROK 2a: drop diet-specific backend routes

**Status:** PROPOZYCJA. Czekam na "ok 2a" zanim faktycznie usunę pliki.
**Branch:** `main` (HEAD = `3a76e39`)

---

## 1. Mapa zależności (skrót)

- **Cross-route imports w `apps/backend/src/`:** 0 — żaden route nie importuje innego route'a
- **Importerzy route'ów poza `server.ts`:** 0 — żaden controller/service/middleware/test nie importuje plików `routes/*.routes.ts`
- **Jedyne miejsce mount:** [apps/backend/src/server.ts](apps/backend/src/server.ts) — linie 8-41 (imports) + linie 164-197 (`app.use(...)` calls)

**Wniosek:** chirurgia jest izolowana do `routes/*.ts` + `server.ts`. ZERO ryzyka kaskadowego po stronie routes ↔ routes.

⚠️ **Co się posypie po usunięciu 21 route plików:**
controllers/services/middleware importowane wewnątrz tych route'ów (np. `dietPlanController`, `interviewController`, `mealService`, etc.) **same nadal istnieją** — staną się sierotami. To OK i oczekiwane:
- KROK 2b sprzątnie ich controllers
- KROK 2c sprzątnie ich services

Po 2a typecheck będzie zielony (bo zostawione controllers/services dalej są self-consistent — to ROUTES je importują, nie odwrotnie). Routes USUWANE → znikają wraz z ich konsumpcją kontrolerów.

---

## 2. Lista plików do usunięcia (21)

| # | Plik | Powód | Mount path w server.ts |
|---|---|---|---|
| 1 | `access.routes.ts` | access window do diet planów — §2b plan | `/access` |
| 2 | `checkin.routes.ts` | diet check-ins — §2b | `/check-ins`, alias `/progress` |
| 3 | `cleanProduct.routes.ts` | baza produktów spożywczych — §2b | `/clean-products` |
| 4 | `dietPlan.routes.ts` | plany dietetyczne — §2b | `/diet-plans` |
| 5 | `dietitian.routes.ts` | panel dietetyka — §2b | `/dietitian` |
| 6 | `foodProduct.routes.ts` | produkty żywnościowe — §2b | `/food-products` |
| 7 | `interview.routes.ts` | wywiad dietetyczny — §2b | `/interviews` |
| 8 | `labpanel.routes.ts` | wyniki laboratoryjne — §2b | `/lab-panels` |
| 9 | `meal.routes.ts` | posiłki — §2b | `/meals` |
| 10 | `measurement.routes.ts` | pomiary ciała — §2b | `/measurements` |
| 11 | `message.routes.ts` | chat dietetyk↔pacjent — §2b | `/messages` |
| 12 | `note.routes.ts` | notatki dietetyka — §2b | `/notes` |
| 13 | `noteTemplate.routes.ts` | szablony notatek — §2b | `/note-templates` |
| 14 | `onboarding.routes.ts` | diet interview onboarding — §2b (przebudowa od zera w fazie 4) | `/onboarding` |
| 15 | `patient.routes.ts` | model Patient — §2b (wraca w KROK 6 jako `company.routes.ts`) | `/patients` |
| 16 | `rating.routes.ts` | oceny przepisów — §2b | `/ratings` |
| 17 | `recipe.routes.ts` | przepisy — §2b | `/recipes` |
| 18 | **`stats.routes.ts`** | **POTWIERDZONE diet** — endpoint `/stats/database` zwraca CleanProduct count + Recipe count + nutrient coverage (witaminy A/D/E/K, B-complex, makro) dla landing page diet. Używa `prisma.cleanProduct.count()` + `prisma.recipe.count()`. Wewnętrzny dashboard MRR/churn zrobimy od zera w fazie 4. | `/stats` |
| 19 | `supplement.routes.ts` | suplementacja — §2b | `/supplements` |
| 20 | `template.routes.ts` | szablony planów — §2b | `/template-plans` |
| 21 | **`tenant.routes.ts`** | **POTWIERDZONE — usuwamy** (decyzja Q2 §5: bez multi-tenancy) | `/tenants` |

**RAZEM: 21 plików do usunięcia.**

---

## 3. Zmiany w `server.ts` (modyfikacja)

### 3.1 Imports do usunięcia (21 linii w bloku 8-41)
Linie do skasowania:
- `9: statsRouter`
- `10: interviewRouter`
- `11: dietPlanRouter`
- `14: tenantRouter`
- `15: patientRouter`
- `19: labPanelRouter`
- `23: accessRouter`
- `25: mealRouter`
- `26: templateRouter`
- `27: foodProductRouter`
- `28: recipeRouter`
- `29: checkinRouter`
- `31: dietitianRouter`
- `32: noteRouter`
- `33: noteTemplateRouter`
- `35: cleanProductRouter`
- `36: onboardingRouter`
- `37: ratingRouter`
- `38: messageRouter`
- `39: measurementRouter`
- `40: supplementRouter`

### 3.2 `app.use(...)` do usunięcia (22 linie w bloku 164-197)
Linie do skasowania:
- `166: app.use('/stats', statsRouter);`
- `168: app.use('/interviews', requireAuth(), userLimiter, interviewRouter);`
- `169: app.use('/diet-plans', requireAuth(), userLimiter, dietPlanRouter);`
- `170: app.use('/tenants', tenantRouter);`
- `171: app.use('/patients', requireAuth('ADMIN', 'DIETITIAN'), userLimiter, patientRouter);`
- `174: app.use('/access', requireAuth(), userLimiter, accessRouter);`
- `177: app.use('/lab-panels', requireAuth('ADMIN', 'DIETITIAN'), userLimiter, labPanelRouter);`
- `179: app.use('/dietitian', requireAuth('ADMIN', 'DIETITIAN'), userLimiter, dietitianRouter);`
- `180: app.use('/notes', requireAuth('ADMIN', 'DIETITIAN'), userLimiter, noteRouter);`
- `181: app.use('/note-templates', requireAuth('ADMIN', 'DIETITIAN'), userLimiter, noteTemplateRouter);`
- `183: app.use('/food-products', globalLimiter, foodProductRouter);`
- `184: app.use('/clean-products', globalLimiter, cleanProductRouter);`
- `185: app.use('/recipes', globalLimiter, recipeRouter);`
- `186: app.use('/meals', globalLimiter, mealRouter);`
- `187: app.use('/template-plans', globalLimiter, templateRouter);`
- `188: app.use('/check-ins', requireAuth(), userLimiter, checkinRouter);`
- `189: app.use('/progress', requireAuth(), userLimiter, checkinRouter); // 62.1: alias` ← alias do checkinRouter, też pójdzie
- `192: app.use('/onboarding', requireAuth(), userLimiter, onboardingRouter);`
- `193: app.use('/ratings', requireAuth(), userLimiter, ratingRouter);`
- `194: app.use('/messages', userLimiter, messageRouter);`
- `195: app.use('/measurements', userLimiter, measurementRouter);`
- `196: app.use('/supplements', requireAuth(), userLimiter, supplementRouter);`

⚠️ **Linie z DIETITIAN role które ZOSTAJĄ w 2a** (do uporządkowania dopiero w KROK 7 — UserRole rename):
- `176: app.use('/orders', requireAuth('ADMIN', 'DIETITIAN', 'PATIENT'), ...);` ← orderRouter ZOSTAJE, role to oddzielna decyzja
- `178: app.use('/subscriptions', requireAuth('ADMIN', 'DIETITIAN'), ...);` ← subscriptionRouter ZOSTAJE

Tych nie ruszam w 2a.

---

## 4. Pliki ZOSTAJĄCE (13)

| Plik | Mount path |
|---|---|
| `admin.routes.ts` | `/admin` — **NIE TYKAMY w 2a** (osobny krok 2.5 wg twojej instrukcji) |
| `auth.routes.ts` | `/auth` |
| `blog.routes.ts` | `/posts` |
| `checkout.routes.ts` | `/checkout` |
| `emailCampaign.routes.ts` | `/email-campaigns` |
| `health.routes.ts` | `/health` |
| `order.routes.ts` | `/orders` |
| `profile.routes.ts` | `/profile` |
| `referral.routes.ts` | `/referrals` |
| `subscription.routes.ts` | `/subscriptions` |
| `testimonial.routes.ts` | `/testimonials` |
| `user.routes.ts` | `/users` |
| `webhook.routes.ts` | `/webhooks` |

---

## 5. Czerwone flagi

🟥 **CZERWONE (ZOSTAJĄCY plik importuje USUWANY):** 0
Cross-route imports = 0 (potwierdzone grep'em). Żaden plik z listy ZOSTAJE nie importuje plików z listy USUWAMY.

🟨 **ŻÓŁTE (USUWANY plik importuje USUWANY):** N/A
Routes nie importują nawzajem.

✅ **Jedyne miejsce styku:** `server.ts` — przewidywalne, zaplanowane modyfikacje wyżej.

---

## 6. Oczekiwany stan po 2a

### typecheck
- `apps/backend/src/server.ts` — 0 errors (drop imports + drop app.use)
- `apps/backend/src/routes/*` — pliki znikną
- `apps/backend/src/controllers/*` — **DALEJ DZIAŁAJĄ** (samoistne, czekają na 2b)
- `apps/backend/src/services/*` — **DALEJ DZIAŁAJĄ** (samoistne, czekają na 2c)

Akceptowalny stan log'u: **0 errors** (nie spodziewam się "Cannot find module" bo zostające pliki nie importują usuwanych). Jeśli pojawi się błąd typu "Cannot find module" — STOP i raport.

### Commit message (proponowany)
```
chore(cleanup): drop diet-specific backend routes (KROK 2a)

Remove 21 route files (access, checkin, cleanProduct, dietPlan,
dietitian, foodProduct, interview, labpanel, meal, measurement,
message, note, noteTemplate, onboarding, patient, rating, recipe,
stats, supplement, template, tenant) and update server.ts to drop
their imports and mount points.

Controllers and services consumed by these routes remain in place
and will be cleaned up in KROK 2b (controllers) and KROK 2c
(services). admin.routes.ts is intentionally not touched — it has
diet-specific endpoints that need surgical trimming in a separate
step, not bulk removal.

stats.routes.ts confirmed as 100% diet (CleanProduct + Recipe
count + nutrient coverage for landing). tenant.routes.ts removed
per §5 Q2 decision (no multi-tenancy in bambooIT).
```

---

## 8. Additional pre-flight checks

Wykonane po wstępnej akceptacji raportu — typowe blind spoty grep'u:

| # | Check | Komenda (skrót) | Wynik |
|---|---|---|---|
| 1 | Testy / inne pliki backend importujące usuwane routes (poza `server.ts`) | `grep -rn "from.*routes/(access\|checkin\|...)" apps/backend/ \| grep -v "src/server.ts"` | ✅ **0 matches** |
| 2 | Skrypty deploy/seed wołające routes | `grep -rn "from.*routes/\|require.*routes/" scripts/` | ✅ **0 matches** |
| 3 | Frontend referujący backend routes | `grep -rn "apps/backend/src/routes" apps/web/src/` + `grep "from.*'@/.*routes/"` | ✅ **0 matches** (oba pod-checki) |
| 4 | Dynamic imports + routes barrel | `grep -rnE "import\(.*routes/\|require\(.*routes/"` + `ls routes/index.ts` | ✅ **0 matches**, brak `index.ts` w `routes/` |

**Wszystkie 4 czyste — zero blind spotów. Wykonuję 2a bez kolejnego oczekiwania na "ok".**

---

## 7. Czekam na "ok 2a"

Po "ok 2a":
1. `git rm` 21 plików routes/
2. Edit `server.ts` (drop 21 imports + 22 app.use linii)
3. `npm run typecheck > TYPECHECK_STEP_2a.log 2>&1` — sprawdź exit 0
4. Jeśli zielony → commit (message wyżej)
5. Jeśli czerwony → STOP i raport błędów
