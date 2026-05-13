# DELETION_PREVIEW_8.md v3 — K8: ProductType + SubscriptionPlan enum reform (atomic pakiety)

**Status:** PROPOZYCJA v3 (post-uściśleń A/B/C). Czekam na "ok 8 final".
**Branch:** `main` (HEAD = `60ad1a5`)
**Strategy:** Atomic enum reform per D-007 + D-018 — bambooIT MVP ma 3 monthly subscription tiers, atomic K8 touches BOTH Order.productType AND Subscription.plan.

**Decyzje GATE 0 (lock-in):**
- 1/5 Final enums: ProductType `{ START, FIRMA, FIRMA_PLUS }` + SubscriptionPlan `{ START, FIRMA, FIRMA_PLUS }` (separate enums, semantic copy)
- 2/5 Trial infra: keep, drop FREE_7 enum value only
- 3/5 planLimits.ts: K9 defer
- 4/5 PRODUCT_LABELS Polish: rename w K8 atomic
- 5/5 Workflow: 4 gates

**Uściślenia v2:**
- A) Order semantics: Wariant A (Order = transakcja kupna pakietu). bambooIT MVP każdy Order = subscription signup.
- B) Drop, NIE rename: Wszystkie diet enum values są DROP. Tylko PRICE_MAP/PRODUCT_LABELS/PRICE_ENV_MAP są **rebuild constants**.
- C) CONSULTATION cleanup atomic: audit.service CONSULTATION_SLOT + endpoints + Order.consultationPhone column DROP w K8.

**Uściślenia v3:**
- **A) SubscriptionPlan w K8 atomic** (nie K9 defer) — per D-018 "3 products: START, FIRMA, FIRMA_PLUS". Dwa osobne enums (ProductType + SubscriptionPlan), ten sam zestaw values dla MVP. Future-proof: Order może rozszerzyć w fazie 4 (AUDIT, WEBSITE) bez wpływu na Subscription.
- **B) @default drop:** Subscription.plan obecnie ma `@default(FREE)` → DROP. Order.productType nie ma defaulta (verified). Subscription tworzona zawsze przez Stripe webhook z explicit plan.
- **C) Migration name:** `replace_enums_pakiety_and_drop_consultation_phone` — single migration, 3 phases wewnątrz.

---

## §0. Pre-flight estimate (v3 — extended)

**Touchpoints:** ~180-190 operational w 22-23 plikach
- Backend: ~135 hits w ~14 plikach (added: subscription.service 12 hits, adminSubscription +7 SubscriptionPlan filters, subscription.controller 1, admin.service +2)
- Frontend: ~60 hits w ~9 plikach (added: types/api.ts +2 SubscriptionPlan union, lib/api.ts +1 createCheckout signature)
- Schema changes: 2 enum reforms + 1 column drop + 1 @default drop
- SKIP: planLimits.ts (22 hits — K9)

**DB sanity:** Order + Subscription tables 0 rows → zero data loss.

---

## §1. SCHEMA changes v3

### §1.1 ProductType enum reform (schema.prisma:15-30)

```diff
 enum ProductType {
-  FREE_7
-  OPIEKA_MIESIECZNA
-  OPIEKA_ROCZNA
-  PLAN_2W
-  PLAN_4W
-  CONSULTATION
-  // Legacy values
-  PREMIUM
-  CONSULTATION_1W
-  AI_2W
-  AI_4W
-  SUBSCRIPTION_1M
-  CONSULTATION_2W
-  CONSULTATION_4W
+  START
+  FIRMA
+  FIRMA_PLUS
 }
```

### §1.2 SubscriptionPlan enum reform (schema.prisma:50-54) — **NEW v3**

```diff
 enum SubscriptionPlan {
-  FREE
-  PRO_MONTHLY
-  PRO_YEARLY
+  START
+  FIRMA
+  FIRMA_PLUS
 }
```

### §1.3 Order.consultationPhone column DROP (schema.prisma:152)

```diff
 model Order {
   ...
   status            OrderStatus @default(PENDING_PAYMENT)
-  consultationPhone String?     @db.VarChar(20)
   stripeInvoiceId   String?
   ...
 }
```

### §1.4 Subscription.plan @default DROP (schema.prisma:267) — **NEW v3**

```diff
 model Subscription {
   ...
-  plan                 SubscriptionPlan   @default(FREE)
+  plan                 SubscriptionPlan
   ...
 }
```

Rationale: Subscription tworzona zawsze przez Stripe webhook z explicit plan. Auto-FREE było diet residue.

### §1.5 NOT touched

- `OrderStatus` enum (PENDING_PAYMENT/PAID/ACTIVE/COMPLETED/CANCELLED) — generic, bambooIT-compatible
- `SubscriptionStatus` enum (TRIALING/ACTIVE/PAST_DUE/CANCELED/INCOMPLETE) — generic
- Order.status default `PENDING_PAYMENT` — generic
- Subscription model structure (other fields) — unchanged

---

## §2. CODE TOUCHPOINTS AUDIT v3

### §2.A Pattern categorization

| Group | Pattern | Files | Action |
|---|---|---|---|
| **A** | TS enum union narrow (ProductType + SubscriptionPlan) | 4 (types/api.ts, order.service.ts, subscription.service.ts, lib/api.ts) | Rewrite unions |
| **B** | Drop dead logic branches | 9 | Drop conditionals/cases/handlers |
| **C** | Rebuild constants (PRICE_MAP, PRODUCT_LABELS, PRICE_ENV_MAP, planFromPriceId) | 4 | Replace constant content |
| **D** | Drop one-off product UI/queries | 3 | Drop one-off dialogs/counters |
| **E** | Drop /admin/consultations + CONSULTATION_SLOT audit | 3 | Drop endpoints + audit types |
| **F** | consultationPhone column refs | 2-3 | Drop refs |
| **G** | SubscriptionPlan-side rebuild — planFromPriceId, createCheckout, webhook plan resolution | 1 (subscription.service.ts) | Multi-section rebuild |
| **H** | SubscriptionPlan filters/counts (admin views) | 2 | Drop FREE filters + rebuild count queries |
| **SKIP** | planLimits.ts | 1 | K9 |

### §2.B Backend (14 plików operacyjnych — v3 extended)

**ProductType side (12 plików, unchanged from v2):**

| File | Hits | Group | Action |
|---|---|---|---|
| services/order.service.ts | 25+ | A+B+C+F | Union narrow + PRICE_MAP rebuild + drop conditionals + drop consultationPhone refs |
| services/checkout.service.ts | 23+ | B+C+F | PRICE_ENV_MAP rebuild + drop FREE_7 + TRIAL_DB_MAP simplify + drop CONSULTATION |
| services/adminSubscription.service.ts | 12 | D | Drop ORDER_PRODUCT_TYPES + one-off counters/filters |
| services/audit.service.ts | 8 | E | Drop CONSULTATION_SLOT/BOOK_CONSULTATION audit types |
| utils/email.ts | 8 | C | PRODUCT_LABELS rebuild |
| controllers/checkout.controller.ts | 8 | B | Drop zod enum values → 3 |
| controllers/order.controller.ts | 6 | A+B+F | Narrow + drop branches |
| services/admin.service.ts | 5 (+2 SubscriptionPlan) | B+H | Drop CONSULTATION query + drop `plan !== 'FREE'` filters L62, L110 |
| controllers/admin.controller.ts | 2 | E | Drop /admin/consultations |
| controllers/webhook.controller.ts | 1 | A | TS ref |
| services/subscription.service.ts | (12 SubscriptionPlan) | A+C+G | See §2.D detail |
| controllers/subscription.controller.ts | (1 SubscriptionPlan) | B | zod enum: `['PRO_MONTHLY', 'PRO_YEARLY']` → `['START', 'FIRMA', 'FIRMA_PLUS']` |

**SubscriptionPlan side detail (v3 NEW):**

| File | Hits | Action |
|---|---|---|
| services/subscription.service.ts | 12 | Multi-section refactor (see §2.D) |
| services/adminSubscription.service.ts | +7 | Drop count per plan queries L25-26 (rebuild for 3 tiers OR aggregate); drop `plan: { not: 'FREE' }` filters L31, L41, L111, L172 (no FREE tier in bambooIT — filter moot); coerce L112 typing |
| services/admin.service.ts | +2 | Drop `plan !== 'FREE'` checks L62 (where clause), L110 (sub.plan !== FREE conditional w stats display) |
| controllers/subscription.controller.ts | 1 | zod enum: `['PRO_MONTHLY', 'PRO_YEARLY']` → `['START', 'FIRMA', 'FIRMA_PLUS']` |

### §2.C Frontend (9 plików — v3 extended)

| File | Hits | Group | Action |
|---|---|---|---|
| components/admin/SubscriptionStatsCards.tsx | 20 | D | Drop one-off dialog cards (~50 LOC) |
| types/api.ts | 16 + 2 SubPlan | A | ProductType narrow + CheckoutProductType drop TRIAL_YEARLY + SubscriptionPlan union L86 narrow |
| components/admin/SubscriptionTable.tsx | 10 | D | Drop filter SelectItems |
| lib/api.ts | 3 + 1 SubPlan | A | Import refs + createCheckout signature L267: `'PRO_MONTHLY' \| 'PRO_YEARLY'` → `'START' \| 'FIRMA' \| 'FIRMA_PLUS'` |
| components/admin/UsersTable.tsx | 3 | — | Mostly i18n |
| app/[locale]/zamow/page.tsx | 3 | G | K9 i18n bundle |
| components/checkout/CheckoutSuccess.tsx | 2 | B | Drop isConsultation + FREE_7 fallback |

### §2.D Hot-spots manual review (8 spots — v3 extended)

1. **`order.service.ts:331-337` PRICE_MAP rebuild:**
   ```ts
   { START: 390, FIRMA: 690, FIRMA_PLUS: 1190 }
   ```

2. **`checkout.service.ts:16-25, 37-38, 69-72, 144` PRICE_ENV_MAP + drops:**
   - Drop FREE_7/CONSULTATION blocks
   - TRIAL_DB_MAP: `{ TRIAL: 'START' }` (drop TRIAL_YEARLY)
   - PRICE_ENV_MAP: 3 new entries + TRIAL fallback to START

3. **`email.ts:3-9` PRODUCT_LABELS rebuild:**
   ```ts
   { START: 'Pakiet Start', FIRMA: 'Pakiet Firma', FIRMA_PLUS: 'Pakiet Firma Plus' }
   ```

4. **`SubscriptionStatsCards.tsx`** — drop one-off dialog cards (~50 LOC).

5. **`admin.controller.ts:706,753` + `admin.routes.ts`** — drop /admin/consultations.

6. **`audit.service.ts:101-106, 168-169`** — drop CONSULTATION_SLOT/BOOK_CONSULTATION.

7. **`subscription.service.ts:10-30, 78-80` (NEW v3) — multi-section rebuild:**
   ```ts
   // BEFORE
   function planFromPriceId(priceId): SubscriptionPlan {
     if (!priceId) return 'PRO_MONTHLY';
     if (priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) return 'PRO_YEARLY';
     return 'PRO_MONTHLY';
   }
   // L23: data: { userId, plan: 'FREE', status: 'TRIALING' }
   // L28: createCheckout(userId, email, plan: 'PRO_MONTHLY' | 'PRO_YEARLY')
   // L78-80: const plan: SubscriptionPlan = ... PRO_YEARLY/PRO_MONTHLY

   // AFTER
   function planFromPriceId(priceId): SubscriptionPlan {
     if (priceId === process.env.STRIPE_PRICE_FIRMA_PLUS) return 'FIRMA_PLUS';
     if (priceId === process.env.STRIPE_PRICE_FIRMA) return 'FIRMA';
     return 'START';  // default fallback
   }
   // L23: data: { userId, plan: 'START', status: 'TRIALING' }  
   //   (or drop default-FREE creation entirely — was diet trial concept)
   // L28: createCheckout(userId, email, plan: 'START' | 'FIRMA' | 'FIRMA_PLUS')
   // L78-80: rebuild plan resolution dla 3 tiers
   ```
   
   **Manual decision needed:** L22-23 default Subscription creation (default FREE plan was diet trial signup pattern). Re-evaluate:
   - **Option a:** Drop entire `createDefaultSubscription` function — bambooIT nie ma free tier
   - **Option b:** Rename `createDefaultSubscription` → `createPlaceholderSubscription` for users awaiting Stripe webhook (transient state). Plan = 'START' as placeholder until real plan known.
   
   **Recommendation Option b** — preserves pattern for Stripe webhook flow. Rebuild content with placeholder plan.

8. **`adminSubscription.service.ts:25-26, 31, 41, 111, 172` (NEW v3) — count queries + filter rebuilds:**
   ```ts
   // BEFORE — count per tier
   prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'PRO_MONTHLY' } }),
   prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'PRO_YEARLY' } }),

   // AFTER — count per bambooIT tier
   prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'START' } }),
   prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'FIRMA' } }),
   prisma.subscription.count({ where: { status: 'ACTIVE', plan: 'FIRMA_PLUS' } }),
   ```
   
   Plus drop `{ plan: { not: 'FREE' } }` filters (no FREE tier).

### §2.E .env.example update v3

```diff
-# STRIPE_PRICE_OPIEKA_MIESIECZNA=price_...
-# STRIPE_PRICE_OPIEKA_ROCZNA=price_...
-# STRIPE_PRICE_PLAN_2W=price_...
-# STRIPE_PRICE_PLAN_4W=price_...
-# STRIPE_PRICE_CONSULTATION=price_...
-# STRIPE_PRO_YEARLY_PRICE_ID=price_...
+# STRIPE_PRICE_START=price_...      # 390 zł netto/mies (D-007 Pakiet Start)
+# STRIPE_PRICE_FIRMA=price_...      # 690 zł netto/mies (D-007 Pakiet Firma)
+# STRIPE_PRICE_FIRMA_PLUS=price_... # 1190 zł netto/mies (D-007 Pakiet Firma Plus)
```

### §2.F Tests audit

Preliminary grep: 0 ProductType + 0 SubscriptionPlan refs in test fixtures.

**Expected impact: zero test changes** (backend 63/63 unchanged, frontend 42/54 unchanged).

### §2.G SKIP w K8 (deferred K9)

- `config/planLimits.ts` (22 hits)
- Trial infrastructure (trialFingerprint, antiAbuse, stripe trial periods)

---

## §3. MIGRATION strategy v3

### Plan A: Single migration

**Migration name:** `replace_enums_pakiety_and_drop_consultation_phone`

**Expected SQL (~14-15 statements, 3 phases):**

```sql
-- Phase 1: ProductType reform (drop diet residue, keep 3 bambooIT tiers)
BEGIN;
CREATE TYPE "ProductType_new" AS ENUM ('START', 'FIRMA', 'FIRMA_PLUS');
ALTER TABLE "Order" ALTER COLUMN "productType" DROP DEFAULT;  -- no-op (no default)
ALTER TABLE "Order" ALTER COLUMN "productType" TYPE "ProductType_new"
  USING ('START'::"ProductType_new");
ALTER TYPE "ProductType" RENAME TO "ProductType_old";
ALTER TYPE "ProductType_new" RENAME TO "ProductType";
DROP TYPE "public"."ProductType_old";
COMMIT;

-- Phase 2: SubscriptionPlan reform (NEW v3)
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('START', 'FIRMA', 'FIRMA_PLUS');
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new"
  USING ('START'::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "public"."SubscriptionPlan_old";
COMMIT;
-- @default(FREE) dropped, no SET DEFAULT for new column

-- Phase 3: Drop diet-specific Order column
ALTER TABLE "Order" DROP COLUMN "consultationPhone";
```

**~15 statements total** (analogiczne do K7 UserRole reform pattern, but with 2 enum reforms).

**Production-future caveat:** Same as K7 + K8 v1 — pre-migration script needed jeśli Order/Subscription would have rows w old enum values. Dev DB 0 rows → trivially safe.

### Data loss analysis

```
SELECT COUNT(*) FROM "Order"; → 0 rows
SELECT COUNT(*) FROM "Subscription"; → 0 rows
```

✅ Zero data loss.

---

## §4. HELPER SCRIPT v3 (drop-only)

**File:** `scripts/cleanup-helpers/k8-enum-reform.js`

**Strategy:** FLAG REPORTER only (drop-first, no semantic mapping).

**Flagged values (15 dropped):**

ProductType (12): `FREE_7`, `OPIEKA_MIESIECZNA`, `OPIEKA_ROCZNA`, `PLAN_2W`, `PLAN_4W`, `CONSULTATION`, `PREMIUM`, `CONSULTATION_1W`, `AI_2W`, `AI_4W`, `SUBSCRIPTION_1M`, `CONSULTATION_2W`, `CONSULTATION_4W`

SubscriptionPlan (3 NEW v3): `FREE`, `PRO_MONTHLY`, `PRO_YEARLY`

**Helper SKIP:**
- `config/planLimits.ts` (K9)
- TODO(*-cleanup) blocks
- Trial infrastructure (FREE_7 already in main flag set)

---

## §5. HOT-SPOTS (8 spots — patrz §2.D)

---

## §6. STRIPE CONFIG NOTE v3

K8 aligns code/schema. `.env.example` rename (6 diet STRIPE_PRICE_* envs → 3 new bambooIT envs).

Actual Stripe Dashboard config (3 products × 1 price each) → **faza 4 build phase**.

---

## §7. TESTS update

Zero changes expected.

---

## §8. BACKUP strategy

```bash
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db > backup/backup_pre_8_$(date +%Y%m%d_%H%M%S).sql
```

---

## §9. K8 commit message proposal (v3)

```
chore(rename): replace ProductType + SubscriptionPlan enums with bambooIT pakiety (KROK 8)

Atomic enum reform per D-007 + D-018. Replaces both Order.productType
and Subscription.plan enum values with bambooIT 3 monthly subscription
tiers (START 390 zł, FIRMA 690 zł, FIRMA_PLUS 1190 zł). Drops diet
CONSULTATION residue (audit action types + admin endpoints + Order.
consultationPhone column).

Wariant A confirmed: Order = subscription signup transaction record.
Both Order.productType and Subscription.plan use same value set
(separate enums for future-proofing — Order może rozszerzyć w fazie 4
do AUDIT/WEBSITE bez wpływu na Subscription).

Schema changes (3 phases w 1 migracji):
- enum ProductType: 14 values → 3 (START, FIRMA, FIRMA_PLUS)
- enum SubscriptionPlan: 3 diet values (FREE/PRO_MONTHLY/PRO_YEARLY)
  → 3 bambooIT values (same as ProductType)
- Subscription.plan @default(FREE) DROP (no default — Stripe webhook
  always sets explicit plan)
- Order.consultationPhone column DROP (diet residue, no CONSULTATION
  in MVP)

Migration: single Plan A (replace_enums_pakiety_and_drop_consultation_
phone). 14-15 SQL statements, 3 BEGIN/COMMIT phases.

Code changes:
[Backend ProductType — order.service, checkout.service, email.ts,
adminSubscription, audit.service, admin.controller, controllers/order
+ webhook + checkout — details]

[Backend SubscriptionPlan — subscription.service rebuild (planFromPriceId
maps Stripe price ID → START/FIRMA/FIRMA_PLUS); adminSubscription count
queries rebuild for 3 tiers; admin.service drop `plan !== 'FREE'`
filters; subscription.controller zod enum]

[Frontend — types/api.ts ProductType + SubscriptionPlan unions narrow;
lib/api.ts createCheckout signature; SubscriptionStatsCards drop one-off
dialogs; SubscriptionTable drop filter SelectItems; CheckoutSuccess
drop isConsultation + FREE_7 fallback]

[.env.example: 6 diet STRIPE_PRICE_* envs → 3 bambooIT envs]

Tests: backend 63/63 unchanged (no enum refs in fixtures); frontend
42/54 unchanged (12 pre-existing K6b failures still deferred K9).

Remaining ProductType/SubscriptionPlan refs (K9 territory):
- config/planLimits.ts (22 hits — drop entire file w K9)
- Trial infrastructure refs — keep, only FREE_7 enum value dropped

Schema after K8: 100% bambooIT-aligned. K9 final cleanup (planLimits
+ orphan diet utils + frontend test failures + i18n bundle keys).
```

---

## §10. ROLLBACK plan

Standard. Risk: NISKI (2 small enum reforms + 1 column drop, all 0 data).

---

## §11. 4 GATES dla K8

1. **GATE 0** (this v3) → "ok 8 final"
2. **GATE 1** — Code prep (helper flag + manual + typecheck/tests) → "ok migrate 8"
3. **GATE 2** — Schema + SQL preview (15 statements) → "ok commit 8"
4. **GATE 3** — Apply + verify → "ok commit final 8"

---

## §12. K9 follow-up note (v3 — SubscriptionPlan removed)

After K8 v3, K9 territory:
- `apps/backend/src/config/planLimits.ts` (22 hits — entire file drop)
- 6 orphan diet utility files in `apps/backend/src/utils/`
- 19 remaining `patient/Patient/PatientInvoice` refs (K7 leftover)
- 12 pre-existing frontend test failures
- TODO(*-cleanup) blocks
- i18n bundle keys (apps/web/messages/pl.json)
- PatientInvoice decision (drop or rename CompanyInvoice)
- Stripe Dashboard setup → **NOT K9** (faza 4)

(SubscriptionPlan removed from K9 list — addressed in K8 v3 atomic.)

---

## 🚦 Aktualnie GATE 0 v3 — czekam na "ok 8 final"

Po zgodzie:
1. Backup → `backup/backup_pre_8_*.sql`
2. Helper script `k8-enum-reform.js` (FLAG REPORTER, 15 dropped values)
3. Manual edits w ~22-23 plikach (8 hot-spots)
4. Typecheck + tests
5. GATE 1 report

**STOP triggery:**
- Helper > 35 plików (oczekuję ~22-23)
- Manual edits sezonują > 30 unexpected downstream refs
- Typecheck > 30 errors (oczekuję ~10-15 Prisma enum mismatch)
