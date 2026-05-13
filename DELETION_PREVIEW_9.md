# DELETION_PREVIEW_9.md — K9: Final cleanup (planLimits + orphan utils + TODO blocks + i18n + PatientInvoice rename + frontend tests)

**Status:** PROPOZYCJA. Czekam na "ok 9 final".
**Branch:** `main` (HEAD = `4671ba4`)
**Strategy:** Final cleanup phase — pure tech-debt, NO schema/migration changes. Last cleanup step before CLEANUP_COMPLETE.md.

**6 decyzji lock-in:**
- 1/6 planLimits.ts — DROP entire file + checkout.service.ts inline simplification (drop isTrialProduct/isSubscriptionProduct/TRIAL_PERIOD_DAYS checks; Stripe handles trials)
- 2/6 Orphan diet utils — DROP 6 + DROP dietPlanCache.ts (verified ZERO consumers, also orphan)
- 3/6 patient/Patient refs — DROP TODO blocks + historical comments + lib/api K7-leftovers; KEEP middleware/auth deploy markers; RENAME PatientInvoice → CompanyInvoice
- 4/6 Frontend tests — DROP RegisterForm.test.tsx (9 tests, dietitianCode UI removed); INVESTIGATE+fix-if-quick LoginForm (2) + api.test (1), else document
- 5/6 TODO(*-cleanup) blocks — DROP wholesale all 57 hits across 20 files (commented dead code, git log audit trail)
- 6/6 i18n bundle — pl.json drop ~40 diet keys + rename ~10-15 patient→client; en.json sync (default fallback per D-023 — keep stub structure, sync drops/renames)

---

## §0. Pre-flight estimate (final scope)

**Touchpoints:** ~90-110 file changes
- Backend: ~15-20 plików (planLimits drop, 7 orphan utils drop, ~9 TODO sweep files, deploy markers intact)
- Frontend: ~20 plików (RegisterForm tests drop, ~11 TODO sweep files, audit-labels drop, lib/api K7-leftovers, PatientInvoice rename consumers)
- i18n: 2 files (pl.json + en.json sync)

**LOC drop estimate:** ~1100-1400 LOC drop net
- planLimits.ts: -107 LOC
- 6 orphan utils: -658 LOC
- dietPlanCache.ts: -45 LOC
- TODO blocks sweep: ~-200-300 LOC (commented dead code)
- RegisterForm.test.tsx: ~-100-200 LOC (entire test file)
- i18n keys: ~-50-80 LOC (40 keys × ~1-2 lines)
- patient/Patient cleanup: ~-50-80 LOC

**Schema/migration changes:** ZERO (pure tech-debt cleanup)

### §0.A en.json strategy — confirmed KEEP + SYNC

**Discovery from DECISION_LOG.md D-023:**
> "Zostawić next-intl + PL + EN, ale EN wyłączone w `i18n/config.ts`** (tylko PL aktywne)"
> "messages/en.json pusty/minimalny, messages/pl.json z całością treści"

**Current state mismatch:**
- `apps/web/src/i18n/routing.ts:4`: `locales: ['pl', 'en']` — BOTH locales **active** in routing
- `apps/web/messages/en.json`: 712 LOC (NOT stub — full mirror of pl.json)
- Inconsistent z D-023 intent (en should be stub, PL only active)

**K9 decision (per Twoje default fallback):**
- **KEEP en.json + SYNC drop/rename changes** with pl.json
- D-023 alignment (drop 'en' from routing + reduce to stub) → **K10 scope** (faza 4 build phase) — not pure cleanup

**Rationale:** Touching routing.ts to drop 'en' locale would require:
- Update `[locale]` segment handling
- Verify all `Link` components
- Bigger structural change, exceeds K9 cleanup scope

K9 keeps en.json in sync with pl.json structure — preserves future option for activating EN without restoring removed diet keys.

### §0.B dietPlanCache.ts orphan verification

```bash
grep -rn "from.*dietPlanCache" apps/ 2>/dev/null
# → No matches
```

✅ Zero consumers. **DROP** (45 LOC).

### §0.C Final touchpoints + LOC counts

| Scope | Files | LOC drop |
|---|---|---|
| planLimits.ts drop | 1 | 107 |
| Orphan diet utils (7) | 7 | 703 |
| TODO blocks sweep | ~20 | 200-300 |
| RegisterForm.test.tsx | 1 | 100-200 |
| pl.json + en.json | 2 | 50-80 each = 100-160 |
| patient/Patient drop (audit-labels, llms-full, comments) | 5-8 | 50-80 |
| PatientInvoice → CompanyInvoice rename | 2 | minor (~5 changes) |
| checkout.service.ts inline simplification | 1 | ~10-15 |
| LoginForm/api.test investigate | 2 | maybe fixes, maybe document |
| **TOTAL** | **~40 files** | **~1300-1500 LOC** |

---

## §1. planLimits.ts drop + checkout.service.ts simplification

### §1.1 DROP `apps/backend/src/config/planLimits.ts` (entire file)

107 LOC, single consumer (checkout.service.ts:11).

### §1.2 `checkout.service.ts` inline simplification

**Current imports + uses:**
```ts
import { isSubscriptionProduct, isTrialProduct, TRIAL_PERIOD_DAYS } from '../config/planLimits';

// later:
if (isTrialProduct(productType)) { ... trial abuse check ... }
const mode = isSubscriptionProduct(productType) ? 'subscription' : 'payment';
trialPeriodDays: isTrialProduct(productType) ? TRIAL_PERIOD_DAYS : undefined,
```

**After K9 simplification:**
```ts
// Drop import line
// const TRIAL_PERIOD_DAYS = 7;  // inline if needed for Stripe trial config

// Trial abuse check:
if (productType === 'TRIAL') { ... trial abuse check ... }

// All bambooIT products are subscriptions:
const mode = 'subscription';  // OR drop conditional, hardcode

// Stripe trial:
trialPeriodDays: productType === 'TRIAL' ? 7 : undefined,
```

**Alternative:** Drop entire trial logic if bambooIT MVP nie ma free trial (per D-007 "390 zł dolna granica rentowności"). Per K8 decision "trial infra keep for future" — sprawdź czy `productType === 'TRIAL'` jeszcze jest możliwa wartość.

Po K8 CheckoutProductType = `ProductType | 'TRIAL'`, więc 'TRIAL' jest valid checkout-only value. **Zachowaj inline trial check w K9.**

### §1.3 Verify all planLimits.ts exports consumers

Grep wszystkich exported names z planLimits.ts:
- `PlanLimits` interface — likely zero TS consumers
- `PLAN_LIMITS` const — zero consumers
- `ACTIVE_PRODUCT_TYPES`, `ActiveProductType` — verify
- `SUBSCRIPTION_PRODUCTS`, `TRIAL_PRODUCTS` — only used inside planLimits.ts helper funcs
- `TRIAL_PERIOD_DAYS` — checkout.service.ts only
- `isTrialProduct`, `isSubscriptionProduct`, `getPlanLimits` — checkout.service.ts only

Helper script scan w GATE 1 dla final confirmation.

---

## §2. 7 orphan files drop

| File | LOC | Action |
|---|---|---|
| `utils/cuisineMapping.ts` | 94 | DROP — interview EN↔Recipe PL cuisine codes |
| `utils/composeMealsFlag.ts` | 53 | DROP — Faza D per-patient composeMeals gating |
| `utils/scaleRecipeSteps.ts` | 118 | DROP — Scale weight refs in recipe instructions |
| `utils/mealSchedule.ts` | 118 | DROP — mealRhythm interview → schedule |
| `utils/ingredientDisplayName.ts` | 27 | DROP — Strip qty+unit from legacy displayName |
| `utils/templateRenderer.ts` | 248 | DROP — Email block-based template renderer (sendCustomCampaignEmail dropped K6a, no consumers) |
| `utils/dietPlanCache.ts` | 45 | DROP — Plan ID/match cache (DietPlan model dropped K5b) |

**Total: 703 LOC drop, zero consumers ✅.**

---

## §3. patient/Patient refs strategy

### §3.A DROP (commented dead code + historical comments)

**Backend (5 file edits):**
- `controllers/admin.controller.ts:14-15, 474-482` — TODO(2b-cleanup) commented patientService import + unlockPatientProfile handler
- `routes/admin.routes.ts:281-292` — TODO commented solver stats route (patientId query param)
- `controllers/profile.controller.ts:5-28` — TODO(2c-cleanup) commented getMyProfile/updateMyProfile handlers
- `routes/profile.routes.ts` — TODO(2c-cleanup) marker
- `services/admin.service.ts:139-140` — Tenant historical comment ("patients count" wording)
- `services/dsar.service.ts:107` — Outdated comment "Patient zostaje" (false post-K6a)

**Frontend (3 file edits):**
- `components/admin/audit-labels.ts:6, 60` — "Patient→Company rename in phase 4" historical comments
- `app/llms-full.txt/route.ts:82` — "diabetic patients" diet text in LLM context
- `app/[locale]/admin/email-kampanie/page.tsx` — placeholder TODO comment mention

### §3.B KEEP (intentional)

- `middleware/auth.ts:10-32` — TODO(K6a-deploy) + TODO(K7-deploy) + TODO(K8-deploy) production guidance markers

### §3.C RENAME (PatientInvoice → CompanyInvoice)

**`types/api.ts:89-100`:**
```ts
// BEFORE
export interface PatientInvoice {
  id: string;
  date: string;
  productType: string;
  amount: number;
  stripeInvoiceId: string | null;
}

// AFTER
export interface CompanyInvoice {
  id: string;
  date: string;
  productType: string;
  amount: number;
  stripeInvoiceId: string | null;
}
```

**Consumers update:**
- `types/api.ts:89` — export name
- `lib/api.ts:6` — import
- `lib/api.ts:165` — type parameter `apiFetch<{ ok: boolean; invoices: PatientInvoice[] }>` → `CompanyInvoice[]`

### §3.D DROP (lib/api.ts K7-territory leftovers)

**`lib/api.ts` drops:**
- L349: `patientsAffected: number` response key — drop entire toggle-active endpoint OR rename `clientsAffected`
- L374-376: `getDietitianPatients` method + `/admin/dietitians/:id/patients` URL — DROP entire method (K7 dropped backend endpoint)
- L581-583: consultations response `patientFirstName/Last/Email` keys — DROP entire consultations API method (K8 dropped backend endpoint)

**Plus:** verify any other diet-leftover methods in lib/api.ts (admin.dietitians.*, admin.consultations.*).

---

## §4. Frontend tests strategy

### §4.A `RegisterForm.test.tsx` — DROP ENTIRE FILE (9 tests)

**Rationale:**
- All 9 tests fail at `RegisterForm.tsx:269:14` (component error propagation)
- Tests reference dropped `dietitianCode` UI field (K7 dropped)
- Component post-K7 = minimal email+password+name register
- bambooIT signup needs rebuild w faza 4 (NIP, industry, employeeCount fields per D-007 Company model planning)

**Action:** Delete `apps/web/src/__tests__/components/auth/RegisterForm.test.tsx`.

**TODO.md entry:** "Rebuild RegisterForm tests dla bambooIT signup w faza 4 (cover: email/password/name register, NIP validation when added in K10, error states)"

### §4.B `LoginForm.test.tsx` — INVESTIGATE QUICK FIX (2 tests)

Tests fail:
1. "calls signIn with credentials on form submit" — vi.fn() mock assertion timeout
2. "redirects to /pl/dashboard on successful login" — redirect not happening

Read test file, attempt 5-min quick fix:
- Update signIn mock signature
- Update redirect URL expectation (post-K7 may redirect to /panel instead of /dashboard)
- If can't fix in 5 min → document, leave for faza 4 rebuild

### §4.C `api.test.ts:50` — INVESTIGATE QUICK FIX (1 test)

"includes Authorization header when token provided" — assertion expected 'Bearer my-token' got undefined.

Read test, attempt quick fix:
- apiFetch mock setup issue OR API signature changed
- 5-min quick fix attempt OR document

### §4.D Acceptable outcome

- Tests post-K9: minimum 42/45 pass (drop 9 RegisterForm tests, 2-3 LoginForm/api.test fixed or stay broken)
- If unable to fix LoginForm/api.test in 5 min total → K9 leaves as-is, TODO.md entry "Fix 2-3 frontend tests (LoginForm + api.test) — auth mock + API utility refactor"

---

## §5. TODO(*-cleanup) wholesale sweep — 57 hits w 20 plików

### §5.A Backend (38 hits w 9 plików)

| File | Hits | Strategy |
|---|---|---|
| `routes/admin.routes.ts` | 14 | Drop commented route blocks (TODO 2b/2c/5x-cleanup) |
| `controllers/admin.controller.ts` | 10 | Drop commented handler imports + handler stubs |
| `services/dsar.service.ts` | 3 | Drop commented K5b cleanup hints |
| `routes/profile.routes.ts` | 3 | Drop commented routes |
| `controllers/order.controller.ts` | 2 | Drop comments |
| `services/order.service.ts` | 2 | Drop comments |
| `controllers/profile.controller.ts` | 2 | Drop commented handlers |
| `services/admin.service.ts` | 1 | Drop comment |
| `services/accounting.service.ts` | 1 | Drop comment |

### §5.B Frontend (19 hits w 11 plików)

| File | Hits | Strategy |
|---|---|---|
| `lib/api.ts` | 4 | Drop TODO markers + commented methods |
| `types/api.ts` | 3 | Drop TODO markers (PatientInvoice rename per §3.C) |
| `components/admin/audit-labels.ts` | 3 | Drop historical TODO comments |
| `components/layout/Header.tsx` | 2 | Drop K7 historical comments |
| `components/layout/Footer.tsx` | 1 | Drop TODO |
| `components/admin/AdminSidebar.tsx` | 1 | Drop TODO |
| `components/blog/BlogCtaButton.tsx` | 1 | Drop TODO |
| `hooks/useUnreadCount.ts` | 1 | Drop TODO |
| `app/[locale]/admin/email-kampanie/page.tsx` | 1 | Drop TODO (page is placeholder K9 already) |
| `app/[locale]/admin/page.tsx` | 1 | Drop TODO |
| `app/[locale]/zamow/page.tsx` | 1 | Drop TODO |

### §5.C Sweep approach

**Helper script `k9-todo-sweep.js`:**
- Detect multi-line TODO(*-cleanup) blocks (start with `// TODO(...cleanup)` comment, continues with consecutive `//` lines until non-comment line or blank line)
- Drop entire block + any commented dead code immediately following
- Preserve middleware/auth.ts TODO(K6a/K7/K8-deploy) markers (protect via whitelist or different pattern)

**Manual review hot-spots:**
- Files w/ >5 TODO hits (admin.routes, admin.controller, lib/api) — verify helper drops correctly, no false positives
- Header.tsx K7 historical "DIETITIAN role removed in K7" — drop per Twoja decyzja

---

## §6. i18n bundle (pl.json + en.json sync)

### §6.A pl.json drops (~40 keys)

**Auth/Register UI (dietitianCode dropped K7):**
- `dietitianCodeLabel`, `dietitianCodePlaceholder`, `dietitianCodeHint`, `errorInvalidDietitianCode` (4 keys)

**Admin labels:**
- `patients` (admin counter), `dietitians` (admin counter) — drop OR rename to `clients` (decyzja per consumer)
- `filterDietitian` — DROP (no DIETITIAN role)
- `filterPatient` — RENAME to `filterClient`
- `roleDietitian` — DROP
- `rolePatient` — RENAME to `roleClient`
- `createDietitianCode`, `createDietitianCodePlaceholder` (2 keys) — DROP (admin create dietitian endpoint dropped K7)
- `roleDietitian` w pricing/admin contexts — DROP

**Audit log labels (drop entire diet-specific):**
- VIEW_PATIENT, UPDATE_PATIENT, DELETE_PATIENT
- CREATE_DIETITIAN, UPDATE_DIETITIAN, ROTATE_DIETITIAN_CODE
- UNLOCK_PATIENT_PROFILE
- DIETITIAN_NOTE
- CREATE_CONSULTATION_SLOT, DELETE_CONSULTATION_SLOT, BOOK_CONSULTATION, CANCEL_CONSULTATION, COMPLETE_CONSULTATION, UPDATE_CONSULTATION
- CONSULTATION_SLOT, CONSULTATION (resource types)
- All recipe/dietPlan/interview audit labels (if any remain — verify w sweep)

**Other diet UI strings:**
- products.FREE_7, products.OPIEKA_MIESIECZNA, products.OPIEKA_ROCZNA, products.PLAN_2W, products.PLAN_4W, products.CONSULTATION
- dialogPlan2wTitle, dialogPlan4wTitle, dialogConsultationTitle (SubscriptionStatsCards drop K8)
- plan2w, plan4w, consultationCount (stats labels)
- dialogConsultation* strings
- consultationPhone* strings (drop K8)

**Total estimated drops:** ~40-50 keys (vary based on actual content found).

### §6.B pl.json renames (~10-15 keys)

- `filterPatient` → `filterClient`
- `rolePatient` → `roleClient`
- `patients` (admin count label) → `clients`
- Plus add new keys for bambooIT products: `products.START`, `products.FIRMA`, `products.FIRMA_PLUS` (z labels "Pakiet Start" itp.)

### §6.C en.json sync

KEEP file structure, mirror pl.json changes:
- Drop same ~40-50 keys (English values like "Patient", "Dietitian", "Consultation")
- Rename same keys (`filterClient`, `roleClient`, etc. — English values "Client", "Filter Client")
- Add products.START/FIRMA/FIRMA_PLUS English labels ("Start Package", "Firma Package", "Firma Plus Package")

### §6.D Helper approach

**Helper script `k9-i18n-sweep.js`:**
- Read pl.json + en.json
- Define drop list (~40-50 keys, hierarchical paths)
- Define rename map (patient → client patterns)
- Apply to both files, validate JSON structure
- Output diff report

---

## §7. CompanyInvoice rename

Already detailed in §3.C. Atomic rename:
1. `types/api.ts:94` — `export interface PatientInvoice` → `CompanyInvoice`
2. `lib/api.ts:6` — import update
3. `lib/api.ts:165` — usage update
4. Drop pre-existing TODO(K9-cleanup) marker w types/api.ts:89-93 (decision executed)

**Total changes:** 3-4 lines across 2 files.

---

## §8. BACKUP strategy

```bash
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db > backup/backup_pre_9_$(date +%Y%m%d_%H%M%S).sql
```

Gitignored. Standard procedure.

**Sanity check:** K9 NO schema changes, but backup unconditional preserves rollback option (mimo zero risk for DB).

---

## §9. Helper script scope

Two helper scripts (K9 is multi-target):

### §9.A `scripts/cleanup-helpers/k9-todo-sweep.js`

**Purpose:** Detect + drop multi-line TODO(*-cleanup) commented blocks.

**Logic:**
- Scan apps/backend/src/**/*.ts + apps/web/src/**/*.{ts,tsx}
- For each line matching `// TODO\([A-Za-z0-9._]+-cleanup\)`:
  - Identify entire block: line itself + consecutive `//` comment lines below until non-comment OR blank line
  - Capture block range (start..end line numbers)
  - Drop entire range
- **PROTECT:** middleware/auth.ts TODO(K6a/K7/K8-deploy) markers (whitelist patterns NOT *-cleanup but *-deploy)
- Dry-run output: list of files + block counts before APPLY

### §9.B `scripts/cleanup-helpers/k9-i18n-sweep.js`

**Purpose:** Drop/rename i18n keys w pl.json + en.json synchronously.

**Logic:**
- Read both JSON files
- Apply DROP list (~40-50 keys)
- Apply RENAME map (patient → client patterns)
- Optionally add new keys (products.START/FIRMA/FIRMA_PLUS)
- Validate JSON structure post-edits
- Output diff report (drops/renames/adds per file)

### §9.C Manual editing approach

Files NOT covered by helpers (manual):
- `planLimits.ts` drop (use `rm` command)
- 7 orphan utils drop (use `rm` commands)
- `checkout.service.ts` inline simplification (manual Edit)
- `RegisterForm.test.tsx` drop (use `rm`)
- `LoginForm.test.tsx` + `api.test.ts` quick fixes (manual Edit, time-boxed)
- `audit-labels.ts` historical comments drop (manual Edit)
- `llms-full.txt/route.ts` diet text drop (manual Edit)
- `dsar.service.ts:107` outdated comment drop (manual Edit)
- `PatientInvoice → CompanyInvoice` rename (manual Edit, 3 spots)
- `lib/api.ts` K7-leftover methods drop (manual Edit)

---

## §10. HOT-SPOTS manual review

1. **`checkout.service.ts` inline simplification** — Verify że drop isTrialProduct/isSubscriptionProduct nie zostawi orphan w/ branches. Read full flow.

2. **TODO sweep manual review per file** — admin.routes.ts (14 hits), admin.controller.ts (10) — biggest files, ensure helper drops correctly without losing legitimate code.

3. **i18n bundle pl.json + en.json structure** — Multi-level nested JSON. Helper must navigate correctly. Validate JSON post-edit.

4. **LoginForm.test.tsx + api.test.ts time-boxed fix** — 5 min each, document if can't fix.

5. **`lib/api.ts` K7-leftover audit** — patientsAffected, getDietitianPatients, /admin/consultations API method — drop entire methods, not just rename. Verify consumers (frontend pages that called these) — likely already broken since K7 backend drop.

6. **`RegisterForm.test.tsx` outright DELETE** — verify test file exists w git history (for future audit), then `rm` the file.

7. **dsar.service.ts:107 false comment "Patient zostaje"** — replace OR drop entirely. Drop entirely (git log ma audit, comment is misleading).

8. **routing.ts en locale KEEP decision** — verify że en.json sync nie wymaga routing.ts edits.

---

## §11. K9 commit message proposal

```
chore(cleanup): final cleanup — drop planLimits + orphan diet utils + TODO blocks + i18n diet keys + frontend tests (KROK 9 final)

Final cleanup phase. Pure tech-debt — NO schema changes, NO Prisma
migrations. Last step before CLEANUP_COMPLETE.md milestone doc.

Categories (per 6 decisions documented in DELETION_PREVIEW_9.md):

1. planLimits.ts (107 LOC) DROP entire file + checkout.service.ts
   inline simplification (isTrialProduct → productType === 'TRIAL',
   isSubscriptionProduct → always true for bambooIT, TRIAL_PERIOD_DAYS
   inlined as 7-day Stripe trial config)

2. 7 orphan diet utility files (703 LOC total) DROP:
   - utils/cuisineMapping.ts (94 LOC — interview ↔ Recipe cuisine codes)
   - utils/composeMealsFlag.ts (53 LOC — per-patient meal composition)
   - utils/scaleRecipeSteps.ts (118 LOC — recipe weight scaling)
   - utils/mealSchedule.ts (118 LOC — mealRhythm computation)
   - utils/ingredientDisplayName.ts (27 LOC — legacy displayName helper)
   - utils/templateRenderer.ts (248 LOC — email template renderer for
     dropped sendCustomCampaignEmail)
   - utils/dietPlanCache.ts (45 LOC — DietPlan cache, model dropped K5b)

   All zero consumers verified (orphans since K2c-K5b).

3. patient/Patient refs final cleanup:
   - DROP backend TODO commented blocks (admin.controller L14-15 +
     L474-482 patientService import + unlockPatientProfile;
     admin.routes L281-292 solver stats; profile.controller L5-28
     getMyProfile/updateMyProfile; profile.routes TODO marker;
     admin.service L139-140 Tenant historical; dsar.service L107
     outdated "Patient zostaje" false post-K6a)
   - DROP frontend historical comments (audit-labels Patient→Company
     rename phase 4; llms-full.txt diabetic patients diet text;
     email-kampanie placeholder TODO)
   - DROP lib/api.ts K7-leftover methods: patientsAffected response
     key, getDietitianPatients method + /admin/dietitians URLs,
     consultations API method + patientFirstName/Last/Email keys
     (backends dropped K7/K8, frontend client methods orphan)
   - KEEP middleware/auth.ts TODO(K6a/K7/K8-deploy) markers
     (intentional production guidance, 3 markers preserved)
   - RENAME types/api.ts PatientInvoice → CompanyInvoice + lib/api.ts
     consumers (generic invoice shape per existing TODO marker
     self-recommendation)

4. Frontend tests:
   - DROP entire __tests__/components/auth/RegisterForm.test.tsx
     (9 tests, all fail referencing dropped dietitianCode UI/API).
     Rebuild scheduled for faza 4 when bambooIT signup form gets
     real fields (NIP, industry, employeeCount).
   - INVESTIGATE LoginForm.test.tsx (2 tests) + api.test.ts (1 test)
     — quick fix attempts if <5 min each; otherwise documented in
     TODO.md as faza 4 follow-up

5. TODO(*-cleanup) wholesale sweep — DROP all 57 hits across 20 files:
   - Backend (9 files, 38 hits): commented dead code blocks from K2-K5
     era (commented imports, commented handlers, commented routes)
   - Frontend (11 files, 19 hits): TODO markers + historical comments
   - Helper script scripts/cleanup-helpers/k9-todo-sweep.js detects
     multi-line TODO blocks, drops entire range, preserves
     middleware/auth.ts *-deploy markers (whitelist)

6. i18n bundle cleanup (pl.json + en.json synced):
   - DROP ~40-50 keys: dietitianCode UI (4), filter/role diet labels
     (~10), audit action labels (~20), products diet variants (~6),
     dialog/stats one-off product labels (~10)
   - RENAME ~10-15 keys: filterPatient → filterClient, rolePatient
     → roleClient, patients (admin count) → clients
   - ADD products.START/FIRMA/FIRMA_PLUS labels (bambooIT)
   - en.json KEEP file + sync changes (D-023 stub structure
     preserved — locales: ['pl', 'en'] still active in routing.ts;
     full en→stub reduction is K10 territory)
   - Helper script scripts/cleanup-helpers/k9-i18n-sweep.js processes
     both files atomically with JSON validation

Helper script learning notes:
- K9 used 2 helper scripts (TODO sweep + i18n sweep) for different
  domains. K6-K8 used single helpers. Multi-helper pattern OK for
  K9 cleanup scope diversity.
- TODO sweep helper requires careful whitelist for *-deploy markers
  (vs *-cleanup) — middleware/auth.ts production guidance preserved.

DB state: unchanged. 10 Prisma migrations from baseline. Backend
tests 63/63 pass. Frontend tests 42/45 expected (down from 42/54
— 9 RegisterForm tests dropped intentionally, 2-3 LoginForm/api
fix attempts time-boxed).

Schema: 100% bambooIT-aligned (since K8). K9 = pure code cleanup.

Repo state after K9:
- 26 cleanup commits from baseline
- 0 diet residue refs (excluding intentional production markers)
- 0 commented dead code blocks
- i18n bundle clean (PL active, EN stub preserved)
- 7 orphan utility files removed
- planLimits config replaced with inline simple checks
- PatientInvoice → CompanyInvoice rename complete

Next steps:
- CLEANUP_COMPLETE.md final summary doc
- TODO.md operating manual for autonomous Claude Code work in faza 4
- Faza 4 build phase ready start (Hero, /pakiety, /audyt, Claude AI
  chat, Fakturownia, Stripe Dashboard setup)
```

---

## §12. ROLLBACK plan

**Per-step rollback (between gates):**
- `git reset --hard 4671ba4` — undo all code changes (K8 last commit)
- DB unchanged (no migrations) — no DB restore needed
- Backup `backup/backup_pre_9_*.sql` exists for safety, restore not expected

**Post-commit rollback:**
```bash
git revert <K9-commit-hash>
# DB unchanged — no migration cleanup needed
```

**Risk:** **NISKI** — pure code/config cleanup, no schema/migration changes. Largest risk = helper script TODO sweep over-aggressive drop (verified via dry-run before apply).

---

## §13. 3 GATES dla K9

### GATE 0 — Pre-flight (this preview)
Czekam na **"ok 9 final"**.

### GATE 1 — Code prep ready
Po:
- Backup created (sanity, no DB changes expected)
- Helper scripts written + dry-runs (TODO sweep + i18n sweep)
- planLimits.ts drop + checkout.service.ts inline simplification
- 7 orphan utils dropped
- patient/Patient drops (TODO blocks, comments, K7-leftover methods)
- PatientInvoice → CompanyInvoice rename
- RegisterForm.test.tsx dropped
- LoginForm/api.test investigated + fixed-if-quick OR documented
- TODO sweep applied (57 hits across 20 files)
- i18n bundles synced (pl.json + en.json)
- `npm run typecheck` — expected exit 0
- `npm run build` — expected exit 0
- Backend tests — expected 63/63
- Frontend tests — expected 42/45 (or 39/45 if LoginForm/api stayed broken)

**Pokażę:**
- Dry-run reports (TODO sweep + i18n sweep counts)
- Files dropped list (7 utils + planLimits + RegisterForm.test)
- Inline simplification diffs (checkout.service)
- PatientInvoice rename consumers (2 files)
- TODO sweep applied stats
- i18n drop+rename stats
- Typecheck/build/tests status
- LoginForm/api.test outcome (fixed vs documented)

**Czekam na:** "ok commit 9" → final commit.

### GATE 2 — Commit
Po:
- All edits verified
- Tests/build green (per expected)

**Atomic commit** z message per §11 template.

### GATE 3 — Post-commit sanity (jeśli wymagane)
- `git log --oneline -30`
- `git show --stat HEAD` (sporo plików — OK)
- Final remaining-refs sanity scan (should be near-zero diet residue)

---

## 🚦 Aktualnie GATE 0 — czekam na "ok 9 final"

Po Twojej zgodzie:
1. Backup → `backup/backup_pre_9_*.sql`
2. Write helper scripts (k9-todo-sweep + k9-i18n-sweep)
3. Helper dry-runs
4. Apply helpers + manual edits (file drops + inline simplifications + renames)
5. LoginForm/api.test time-boxed fix attempts
6. Typecheck + build + tests
7. GATE 1 report → "ok commit 9"

**Triggery STOP w trakcie:**
- Helper dry-run drops > 30 files (oczekuję ~25)
- Manual edits sezonują > 50 unexpected downstream refs
- Typecheck > 20 errors post-edits (oczekuję 0 — pure cleanup)
- Tests regression below 63 backend OR > 12 frontend fails

Lecimy gdy potwierdzisz.
