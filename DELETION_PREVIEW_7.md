# DELETION_PREVIEW_7.md — K7: drop DIETITIAN role + DietitianProfile + PATIENT→CLIENT rename

**Status:** PROPOZYCJA. Czekam na "ok 7 final" przed GATE 1 (helper + edits).
**Branch:** `main` (HEAD = `cf7001e`)
**Strategy:** Atomic K7 — drop DIETITIAN (role + model + Company.dietitianId) + rename PATIENT → CLIENT in single commit + single migration.
**Decyzje GATE 0 (lock-in):**
- 1/5 Scope: drop DIETITIAN (role/model/Company.dietitianId/User.companiesAsDietitian) + rename PATIENT → CLIENT — atomic UserRole reform
- 2/5 Migration: single migration `drop_dietitian_role_and_rename_patient_to_client`
- 3/5 Scoring residue: drop appSettings.patientRating w K7 razem z DietitianProfile.scoringWeightsOverride/greyListWindow
- 4/5 Helper: `scripts/cleanup-helpers/k7-drop-dietitian.js` z Groups A-F
- 5/5 Workflow: 4 gates standard

---

## §0. Pre-flight estimate

**Touchpoints:**
- 49 DIETITIAN-related hits (42 backend / 7 frontend)
- 42 PATIENT-related hits (32 backend / 10 frontend)
- 4 patientRating refs (appSettings.service + admin.controller TODO markers)
- Plus AuditLogTable.tsx audit action labels (~10 entries DIETITIAN/PATIENT-related)
- **TOTAL: ~100 touchpoints in ~25 files**

**DB state pre-flight:**
- `User` table: **0 rows** (0 DIETITIAN, 0 PATIENT)
- `DietitianProfile` table: **0 rows**
- `Company.dietitianId` column: all NULL (0 rows in Company)
- **Zero data loss risk** for all K7 operations.

---

## §1. SCHEMA changes (`packages/database/prisma/schema.prisma`)

### §1.1 Drop DietitianProfile model (linie 61-73)

```diff
-model DietitianProfile {
-  id                      String   @id @default(cuid())
-  userId                  String   @unique
-  code                    String   @unique
-  firstName               String?
-  lastName                String?
-  scoringWeightsOverride  Json?
-  greyListWindow          Int      @default(1)
-  createdAt               DateTime @default(now())
-  updatedAt               DateTime @default(now()) @updatedAt
-
-  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
-}
```

### §1.2 UserRole enum reform (linie 10-14)

```diff
 enum UserRole {
   ADMIN
-  DIETITIAN
-  PATIENT
+  CLIENT
 }
```

### §1.3 User model — drop dietitianProfile + companiesAsDietitian relations + change default

```diff
 model User {
   ...
-  role          UserRole  @default(PATIENT)
+  role          UserRole  @default(CLIENT)
   ...
-  patient                 Company?                 @relation("CompanyUser")
+  company                 Company?                 @relation("CompanyUser")  (already done K6a)
-  companiesAsDietitian    Company[]                @relation("CompanyDietitian")
   dietitianProfile        DietitianProfile?     ← DROP
```

(Default role changed from PATIENT to CLIENT consistent with rename.)

### §1.4 Company model — drop dietitianId field + relation + index (linie 109, 117, 120)

```diff
 model Company {
   id          String   @id @default(cuid())
   userId      String   @unique
-  dietitianId String?
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt

   contactFirstName String?
   contactLastName  String?

   user             User              @relation("CompanyUser", fields: [userId], references: [id], onDelete: Cascade)
-  dietitian        User?             @relation("CompanyDietitian", fields: [dietitianId], references: [id])
   orders           Order[]

-  @@index([dietitianId])
 }
```

### §1.5 Final Company state po K7

```prisma
model Company {
  id          String   @id @default(cuid())
  userId      String   @unique
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  contactFirstName String?
  contactLastName  String?
  user   User    @relation("CompanyUser", fields: [userId], references: [id], onDelete: Cascade)
  orders Order[]
}
```

Czysta forma. K10 doda nowe pola (name, nip, industry, employeeCount, etc.).

---

## §2. CODE TOUCHPOINTS AUDIT (per-file kategoryzacja)

### §2.A Pure DIETITIAN drop files (DROP ops, no PATIENT rename)

| File | Hits | Action |
|---|---|---|
| `apps/backend/src/services/profile.service.ts` | 3 | 3× `prisma.dietitianProfile.*` calls — DROP całych operacji w funkcji updateUserProfile (dietitian-specific code path) |
| `apps/web/src/components/auth/LoginForm.tsx` | 1 | L77: `else if (role === 'DIETITIAN')` redirect branch — DROP entire else-if branch |
| `apps/web/src/app/[locale]/admin/uzytkownicy/page.tsx` | 1 | L44: `excludeRole: 'DIETITIAN'` filter param — DROP (no longer needed) |

### §2.B Pure PATIENT → CLIENT rename files (rename only)

| File | Hits | Action |
|---|---|---|
| `apps/backend/src/controllers/order.controller.ts` | 1 PATIENT | Rename role check (likely zod schema or comment) |
| `apps/backend/src/services/audit.service.ts` | 1 PATIENT | Rename role reference |
| `apps/backend/src/services/auth.service.ts` | 1 PATIENT (1 of 4 DIETITIAN-related) | Rename + drop DIETITIAN logic |
| `apps/web/src/__tests__/components/auth/RegisterForm.test.tsx` | 3 PATIENT | Rename test fixtures `role: 'PATIENT'` → `'CLIENT'` |
| `apps/web/src/__tests__/lib/api.test.ts` | 2 PATIENT | Rename test fixtures |
| `apps/web/src/__tests__/lib/sentry-scrub.test.ts` | 2 PATIENT | Rename test fixtures + scrubbing test data |

### §2.C Mixed files (both DIETITIAN drop + PATIENT→CLIENT rename)

| File | DIETITIAN | PATIENT | Action |
|---|---|---|---|
| `apps/backend/src/middleware/auth.ts` | 1 | 1 | L8: `UserRole = 'ADMIN' \| 'CLIENT'` |
| `apps/backend/src/server.ts` | 2 | 1 | L144 `/orders` mount: `requireAuth('ADMIN', 'CLIENT')`; L145 `/subscriptions`: `requireAuth('ADMIN')` (drop DIETITIAN access — admin-only post-K7) |
| `apps/backend/src/routes/order.routes.ts` | 4 | 9 | 9× `'PATIENT'` → `'CLIENT'`; L20-24 `('ADMIN', 'DIETITIAN')` → `('ADMIN')` (admin manages company orders) |
| `apps/backend/src/controllers/admin.controller.ts` | 3 | 4 | zod enums L49,50,71: `'ADMIN'\|'CLIENT'`; audit action constants L172,247,268 `CREATE_DIETITIAN`/`UPDATE_DIETITIAN`/`ROTATE_DIETITIAN_CODE` — DROP entire functions consuming these |
| `apps/backend/src/services/admin.service.ts` | **19** | 2 | **Heaviest file** — see §2.D special cases |
| `apps/backend/src/services/auth.service.ts` | 4 | 1 | L67-69 DIETITIAN role check + dietitianProfile firstName fallback — DROP; L112 `dietitianCode?` param — DROP; L135-140 dietitianCode block — DROP; rename PATIENT default → CLIENT |
| `apps/backend/src/__tests__/services/auth.service.test.ts` | 5 | 8 | 5× mock `dietitianProfile` — DROP (mock object setup, test cases for DIETITIAN); 8× `role: 'PATIENT'` → `'CLIENT'` fixtures + JWT payload mocks |
| `apps/backend/src/__tests__/services/userCleanup.service.test.ts` | 1 | 4 | L142 `role: 'DIETITIAN'` fixture — DROP entire test case (DIETITIAN cleanup obsolete); 4× `role: 'PATIENT'` → `'CLIENT'` |
| `apps/web/src/types/api.ts` | 3 | 1 | L7 `UserRole = 'ADMIN' \| 'CLIENT'`; **DROP entire interfaces** `DietitianAlertPatient` (L244-249) i `PatientReportSummary` (L255-266) (no consumers); `AdminStats` (L117-124) — drop `dietitians`, rename `patients` → `clients` |
| `apps/web/src/components/admin/UsersTable.tsx` | 2 | 2 | L63 `filterPatient` → `filterClient`; L68 DIETITIAN color map entry — DROP; L69 PATIENT → CLIENT color; L162 `useState<UserRole>('CLIENT')`; L196 DIETITIAN SelectItem — DROP; L197 PATIENT → CLIENT |

### §2.D Special cases (manual review)

#### `services/admin.service.ts` — **19 hits, najszerszy refactor**

Functions to DROP entirely (DIETITIAN-only operations):
- L171: `prisma.user.count({ role: 'DIETITIAN' })` w stats — drop dietitians counter
- L243-260: `createDietitianAccount(...)` — DROP entire function (admin creates dietitian)
- L348-380: `listDietitians(...)` — DROP entire function
- L387-415: `getDietitianPatients(...)` — DROP entire function (K6a renamed to getDietitianCompanies, K7 drops it)
- L421-450: `updateDietitian(...)` — DROP entire function
- L477-500: `rotateDietitianCode(...)` — DROP entire function
- L513-527: `promoteToDietitian(...)` w changeUserRole — DROP if-branch (no DIETITIAN role to promote to)
- L552: `dietitianProfile: { select: { code: true } }` w user detail — DROP include

Functions to KEEP (with edits):
- L11: `UserRole` type — `'ADMIN' \| 'CLIENT'`
- L245: `createAccount` — DROP `role: 'DIETITIAN'` line, but if function is admin-creating CLIENT users, KEEP as `role: 'CLIENT'`
- L287-304: `signupWithDietitianCode`-style logic — DROP `dietitianCode` resolution + `dietitianId` assignment (Company.dietitianId field gone)

**Estimate:** ~150 LOC drop, ~30 LOC rename.

#### `services/auth.service.ts` — signup flow refactor

Lines 112-140:
```ts
// CURRENT:
async function register(
  email: string,
  password: string,
  dietitianCode?: string,   ← DROP
  firstName?: string,
  lastName?: string,
  ...
) {
  ...
  let dietitianId: string | null = null;
  if (dietitianCode) {
    const profile = await prisma.dietitianProfile.findFirst({...});
    if (!profile) throw new AppError(400, 'INVALID_DIETITIAN_CODE', ...);
    dietitianId = profile.userId;
  }
  ...
  await prisma.company.create({
    data: { userId: user.id, dietitianId, contactFirstName, contactLastName },  ← drop dietitianId
  });
}
```

After K7:
```ts
async function register(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  ...
) {
  ...
  await prisma.company.create({
    data: { userId: user.id, contactFirstName, contactLastName },
  });
}
```

Lines 67-69 (login firstName fallback):
```ts
// CURRENT:
if (!firstName && user.role === 'DIETITIAN') {
  const dietitianProfile = await prisma.dietitianProfile.findUnique({ where: { userId: user.id } });
  firstName = dietitianProfile?.firstName ?? null;
}
```
DROP entire block — no DIETITIAN role post-K7.

#### `services/userCleanup.service.ts:59` — dietitianId nullification

```ts
// CURRENT:
await tx.company.updateMany({ where: { dietitianId: userId }, data: { dietitianId: null } });
```

DROP entire line — Company.dietitianId field dropped, nullification obsolete.

Also DROP K9-territory comment block above (L13-17) referencing `Patient.dietitianId`, `SupplementPrescription.dietitianId`, `NutritionProtocol.dietitianId` — cleanup razem.

#### `middleware/auth.ts:8`

```diff
-export type UserRole = 'ADMIN' | 'DIETITIAN' | 'PATIENT';
+export type UserRole = 'ADMIN' | 'CLIENT';
```

JWT payload type stays same shape (role field), just enum values change. **No JWT claim breaking change** (unlike K6a patientId→companyId rename).

⚠️ **Existing JWT tokens with `role: 'PATIENT'`** would deserialize fine (JWT is just JSON) but fail `requireAuth` checks since 'PATIENT' is no longer valid UserRole. Effective behavior: existing sessions get 401, must re-login. **Acceptable w dev (0 users).** For prod future, mass session invalidation needed.

#### `controllers/admin.controller.ts:172, 247, 268` — audit action constants

```ts
action: 'CREATE_DIETITIAN'      ← DROP (no more dietitian creation)
action: 'UPDATE_DIETITIAN'      ← DROP
action: 'ROTATE_DIETITIAN_CODE' ← DROP
```

Cały functions producing these audit actions drop (per §2.D admin.service section). Action labels w frontend AuditLogTable.tsx również drop.

### §2.E Frontend audit table labels (`components/admin/AuditLogTable.tsx`)

Audit action enum labels — multiple entries to drop:

| Line | Entry | Action |
|---|---|---|
| L38 | `VIEW_PATIENT: 'Podgląd pacjenta'` | DROP (action obsolete) |
| L39 | `UPDATE_PATIENT: 'Aktualizacja pacjenta'` | DROP |
| L40 | `DELETE_PATIENT: 'Usunięcie pacjenta'` | DROP |
| L45 | `CREATE_DIETITIAN: 'Utworzenie dietetyka'` | DROP |
| L46 | `UPDATE_DIETITIAN: 'Aktualizacja dietetyka'` | DROP |
| L47 | `ROTATE_DIETITIAN_CODE: 'Rotacja kodu dietetyka'` | DROP |
| L111 | `UNLOCK_PATIENT_PROFILE: 'Odblokowanie profilu pacjenta'` | DROP |
| L119 | `PATIENT: 'Klient'` (role label map) | rename key: `CLIENT: 'Klient'` |
| L132 | `DIETITIAN_NOTE: 'Notatka'` | DROP |
| L165 | `actions: ['VIEW_PATIENT', 'UPDATE_PATIENT', 'DELETE_PATIENT', ...]` group | DROP entire 'Klienci' actions group (all entries diet-specific) |
| L167 | `{ label: 'Dietetycy', actions: [...] }` group | DROP entire group |
| L172 | `'UNLOCK_PATIENT_PROFILE'` reference | DROP from 'Inne' actions array |

**Estimate:** ~25 LOC drop, ~2 LOC rename.

### §2.F appSettings.patientRating drop

`services/appSettings.service.ts`:
- L56-69: `ScoringWeights` interface — DROP `patientRating: number` field (L59 + K9 TODO comment block L58-62)
- L71-84: `DEFAULT_SCORING_WEIGHTS` constant — DROP `patientRating: 0.08` field (L74 + K9 TODO block)

`controllers/admin.controller.ts`:
- L555-557: zod schema `patientRating` w `patchScoringWeightsSchema` — DROP field

Plus drop entire `ScoringWeights` interface jeśli to całe diet residue (verify usage). Quick check needed — może być używany przez K9-territory solver code.

**Decyzja:** Drop tylko `patientRating` field z 3 lokacji (per uściślenie 3 — K7 atomic z DIETITIAN drop). Pozostały scoring weights interface zostaje (K9 territory dla solver cleanup).

### §2.G Special K9-territory orphan utils (NIE tykamy w K7)

Helper SKIP list (analogicznie do K6a/K6b):
- `apps/backend/src/utils/cuisineMapping.ts`
- `apps/backend/src/utils/composeMealsFlag.ts`
- `apps/backend/src/utils/scaleRecipeSteps.ts`
- `apps/backend/src/utils/mealSchedule.ts`
- `apps/backend/src/utils/ingredientDisplayName.ts`
- `apps/backend/src/utils/templateRenderer.ts`

(K9 drops these files entirely.)

---

## §3. MIGRATION strategy

### Plan A: single migration (preferred per user decision)

**Expected SQL (z `prisma migrate dev --create-only`):**

```sql
-- Drop FK constraints + indexes that depend on dropped columns/tables
ALTER TABLE "Company" DROP CONSTRAINT "Company_dietitianId_fkey";
DROP INDEX "Company_dietitianId_idx";

-- Drop DietitianProfile table (cascade auto-drops its FK to User)
DROP TABLE "DietitianProfile";

-- Drop Company.dietitianId column
ALTER TABLE "Company" DROP COLUMN "dietitianId";

-- UserRole enum reform:
-- Step 1: Rename PATIENT → CLIENT
ALTER TYPE "UserRole" RENAME VALUE 'PATIENT' TO 'CLIENT';
-- Step 2: Drop DIETITIAN (workaround — Postgres doesn't support ALTER TYPE DROP VALUE)
-- Prisma typically generates:
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'CLIENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
```

**SQL count:** ~10-15 statements (single migration).

### Potential anomaly (Postgres limitation)

`ALTER TYPE ... DROP VALUE` is **not supported** in any Postgres version (only `ADD VALUE` works). Prisma migrate generates the workaround above (CREATE new enum + ALTER COLUMN + DROP old). This is **expected behavior**, not destructive — preserves existing role data because at apply time:
- All existing `PATIENT` values renamed to `CLIENT` (step 1)
- All `DIETITIAN` rows must be migrated/deleted before (or zero rows like our dev DB)

### Plan B: split into 2 migrations (fallback if Plan A SQL chaos)

**Migration 1:** `drop_dietitian_profile_and_relations`
- Drop DietitianProfile model
- Drop Company.dietitianId

**Migration 2:** `rename_user_role_patient_to_client_and_drop_dietitian`
- ALTER TYPE rename + enum workaround

### Decision per GATE 3 (after `migrate diff` SQL preview)

Try Plan A first. Jeśli SQL chaos (np. unexpected DROP/CREATE TABLE) → switch Plan B w GATE 3.

### Data loss analysis

```
SELECT role, COUNT(*) FROM "User" GROUP BY role; → 0 rows total
SELECT COUNT(*) FROM "DietitianProfile";          → 0 rows
SELECT COUNT(*) FROM "Company" WHERE dietitianId IS NOT NULL; → 0 (Company table empty)
```

✅ **Zero data loss risk.** All operations safe.

---

## §4. PRE-MIGRATION code cleanup (before migration apply)

**Sequence:**

1. Helper script `k7-drop-dietitian.js` dry-run + apply (Groups A-F)
2. Manual hot-spots (§2.D special cases):
   - admin.service.ts: drop 7+ dietitian functions (~150 LOC)
   - auth.service.ts signup: drop dietitianCode param + block + DIETITIAN firstName fallback
   - userCleanup.service.ts:59: drop dietitianId nullification line
   - controllers/admin.controller.ts: drop audit action constants + dependent functions
   - AuditLogTable.tsx: drop ~12 audit label entries + 2 group definitions
3. Schema edit (§1 changes)
4. `prisma validate` → "schema is valid"
5. `prisma migrate dev --create-only --name drop_dietitian_role_and_rename_patient_to_client`
6. SQL preview → GATE 3 → apply

**Cel:** Code must use new API (`'CLIENT'` literals, no `DIETITIAN` checks, no `prisma.dietitianProfile.*`) BEFORE migration applies. Otherwise runtime errors during apply window.

---

## §5. AUTH refactor details

### §5.1 Login flow (`auth.service.ts`)
- DROP L67-69 (DIETITIAN role firstName fallback via dietitianProfile)
- KEEP firstName resolution from Company (already done K6a)

### §5.2 Signup flow (`auth.service.ts:register`)
- DROP `dietitianCode?` parameter (L112) + entire `if (dietitianCode)` block (L135-140)
- DROP `dietitianId` variable + assignment
- DROP `dietitianId` z prisma.company.create data
- Result: signup creates User (role='CLIENT' default) + Company (basic profile, no dietitian link)

### §5.3 JWT impact
- JWT claim shape unchanged (`{ sub, email, role, companyId, iat, exp }`)
- Only `role` value enum changes (`PATIENT` → `CLIENT`, no more `DIETITIAN`)
- Existing tokens: deserialize OK (JSON), but `role: 'PATIENT'` fails enum check at runtime → user gets 401 → re-login
- **Dev impact: ZERO** (0 users)
- **Prod future:** mass session invalidation strategy needed (TODO marker in middleware/auth.ts can document this — analogiczne do K6a JWT TODO)

### §5.4 requireAuth() call rewrites
- `requireAuth('PATIENT')` → `requireAuth('CLIENT')` (8 occurrences in routes/order.routes.ts)
- `requireAuth('ADMIN', 'DIETITIAN', 'PATIENT')` → `requireAuth('ADMIN', 'CLIENT')` (server.ts:144)
- `requireAuth('ADMIN', 'DIETITIAN')` → `requireAuth('ADMIN')` (server.ts:145, routes/order.routes.ts:21-24)

---

## §6. TESTS update

### Backend tests
- `__tests__/services/auth.service.test.ts`:
  - DROP entire `dietitianProfile` mock setup (L8, 33, 42, 151, 175)
  - Rename 8× `role: 'PATIENT'` → `'CLIENT'` fixtures (L79, 126, 159, 166, 177, 192, 341, etc.)
  - DROP test cases for `dietitianCode` signup flow (verify count)
- `__tests__/services/userCleanup.service.test.ts`:
  - DROP DIETITIAN test fixture L142 (entire test case if dependent)
  - Rename 4× `role: 'PATIENT'` → `'CLIENT'`

### Frontend tests
- `__tests__/components/auth/RegisterForm.test.tsx`: 3× rename
- `__tests__/lib/api.test.ts`: 2× rename
- `__tests__/lib/sentry-scrub.test.ts`: 2× rename + L30 username field

**Expected post-K7 test status:** Backend 65/65 → likely ~50/50 (drop ~15 dietitian-specific tests). Frontend pre-existing 12 fails remain pre-existing (not addressed in K7).

---

## §7. appSettings.patientRating drop (per uściślenie 3)

### Files to edit:

1. `apps/backend/src/services/appSettings.service.ts`:
   - L56-69 `ScoringWeights` interface: drop `patientRating` field + surrounding TODO(K9-cleanup) comment
   - L71-84 `DEFAULT_SCORING_WEIGHTS`: drop `patientRating: 0.08` entry + TODO comment

2. `apps/backend/src/controllers/admin.controller.ts`:
   - L552-558 `patchScoringWeightsSchema` zod: drop `patientRating` field + surrounding TODO comment

3. DB: no migration needed — `appSettings` table stores scoring weights as JSON (not column). Existing JSON blob may have `patientRating` key — handled gracefully by missing-field on read; or include in K7 migration as `UPDATE "AppSettings" SET value = value - 'patientRating' WHERE key = 'scoring_weights'` for cleanup. **Decyzja:** skip JSON cleanup w K7 — handled by code (missing field on read = ignored).

---

## §8. BACKUP strategy

```bash
mkdir -p backup
docker exec bambooit_postgres pg_dump -U bambooit -d bambooit_db > backup/backup_pre_7_$(date +%Y%m%d_%H%M%S).sql
```

Gitignored (`backup/` rule). Restore command:
```bash
docker exec -i bambooit_postgres psql -U bambooit -d bambooit_db < backup/backup_pre_7_<timestamp>.sql
```

---

## §9. K7 commit message proposal

```
chore(rename): drop DIETITIAN role + DietitianProfile, rename PATIENT → CLIENT (KROK 7)

Atomic UserRole reform: bambooIT has no dietitian role concept and uses
"CLIENT" semantics (per ADR-009). This commit:
- Drops DietitianProfile model + all references
- Drops Company.dietitianId column + relation + index
- Drops User.companiesAsDietitian relation
- Drops DIETITIAN from UserRole enum
- Renames PATIENT → CLIENT in UserRole enum + all consumers
- Drops appSettings.patientRating field (diet-specific scoring weight)

Single migration: drop_dietitian_role_and_rename_patient_to_client
- DROP TABLE DietitianProfile
- ALTER TABLE Company DROP COLUMN/CONSTRAINT/INDEX dietitianId
- ALTER TYPE UserRole RENAME VALUE PATIENT → CLIENT
- Enum reform workaround for DROP VALUE (CREATE new + ALTER COLUMN + DROP old)

DB state pre-K7: 0 users, 0 dietitian profiles, 0 companies — zero data loss.

Helper script: scripts/cleanup-helpers/k7-drop-dietitian.js
Patterns: UserRole substitutions, DIETITIAN drop, DietitianProfile refs,
companiesAsDietitian relation, Polish UI copy, specific orphans
(appSettings.patientRating, dietitianCode signup param, greyListWindow).

Code touchpoints: ~100 across ~25 files (49 DIETITIAN + 42 PATIENT + 4
patientRating + AuditLogTable.tsx ~10 audit labels). Helper handled ~80
patterns; ~15 manual hot-spots (admin.service dietitian functions,
auth.service signup refactor, AuditLogTable label drops).

Auth refactor:
- auth.service.register: drop dietitianCode param + block
- auth.service.login: drop DIETITIAN firstName fallback
- middleware/auth.ts: UserRole = 'ADMIN' | 'CLIENT'
- JWT: role enum values change (PATIENT→CLIENT, no DIETITIAN); existing
  tokens with old role values get 401 → re-login (dev only)

TODO(K7-deploy) marker added in middleware/auth.ts to document prod
session invalidation needed at deploy time (analogous to K6a-deploy
JWT note).

Frontend tests: 12/54 pre-existing failures remain (not addressed in K7).
Backend tests: pre-K7 65/65 → expected ~50/50 (drop ~15 dietitian-specific
test cases).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## §10. ROLLBACK plan

### Per-step rollback (between gates)

1. **Before migration apply:** `git reset --hard cf7001e` undoes all code changes
2. **After migration applied (rollback needed):**
   ```bash
   docker exec -i bambooit_postgres psql -U bambooit -d bambooit_db < backup/backup_pre_7_<timestamp>.sql
   docker exec bambooit_postgres psql -U bambooit -d bambooit_db -c "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%drop_dietitian%';"
   rm -rf packages/database/prisma/migrations/*drop_dietitian*/
   git reset --hard cf7001e
   ```

### Post-commit rollback (full K7 revert)

```bash
git revert <K7-commit-hash>
# Then DB restore + migration cleanup as above
```

**Risk:** ŚREDNI. Largest single migration (DROP TABLE + ALTER TYPE workaround). Backup secured.

---

## §11. 4 GATES dla K7

### GATE 0 — Pre-flight (this preview)
Czekam na **"ok 7 final"** → start GATE 1.

### GATE 1 — Code prep ready (helper + manual + typecheck + tests)

Po:
- Backup created (`backup/backup_pre_7_*.sql`)
- Helper script `k7-drop-dietitian.js` napisany + dry-run preview
- Helper applied (~80 patterns w ~20 plikach)
- Manual hot-spots fixed (~15 spots — admin.service, auth.service, AuditLogTable)
- appSettings.patientRating drop
- `npm run typecheck` — backend exit 0 (TS errors expected dla `prisma.dietitianProfile.*` calls until migration apply — analogously K6a)
- `npm test -w apps/backend` — backend tests pass (with dietitian fixtures removed)

**Pokażę:**
- Backup status
- Helper dry-run report
- Diff stat (files changed, lines +/-)
- Top 5 hot-spot edits
- Typecheck log
- Test log

**Czekam na:** "ok edits 7" → proceed schema edit.

### GATE 2 — Migrate ready (schema edit + migration preview)

Po:
- Schema edit (§1 changes)
- `npx prisma migrate dev --create-only --name drop_dietitian_role_and_rename_patient_to_client`

**Pokażę:**
- Schema diff
- `prisma validate` output
- `migration.sql` preview (~10-15 statements expected)
- Sanity że SQL nie destructive beyond expected enum workaround

**Decyzja:** Plan A vs Plan B based on SQL analysis.

**Czekam na:** "ok migrate 7" → apply migration.

### GATE 3 — Final verification (post-apply)

Po:
- Migration applied
- `prisma generate` final refresh
- `npm run typecheck` exit 0
- `npm run build` exit 0
- `npm test -w apps/backend` pass
- DB sanity:
  - `\dt` — DietitianProfile gone (19 user tables expected, down from 20)
  - `\d "Company"` — no dietitianId column
  - `\dT "UserRole"` — only ADMIN + CLIENT values
  - `_prisma_migrations` — 9 entries

**Pokażę:**
- Migration.sql actual
- Typecheck + build logs
- Test results
- DB schema snapshots
- Remaining `DIETITIAN/PATIENT` references list (powinno być short — only K9 territory)

**Czekam na:** "ok commit 7" → atomic commit.

### GATE 4 — Commit

```bash
git add -A
git commit -m <per §9 message>
git log --oneline -25
git show --stat HEAD
```

---

## 🚦 Aktualnie GATE 0 — czekam na "ok 7 final"

Po zgodzie:
1. Create backup → `backup/backup_pre_7_*.sql`
2. Write helper script `k7-drop-dietitian.js`
3. Dry-run preview
4. Wait for approval to apply

**Triggery STOP w trakcie:**
- Helper dry-run > 60 plików (oczekuję ~20)
- Manual hot-spots > 25 (oczekuję ~15)
- SQL preview > 50 lines (oczekuję ~10-15)
- Typecheck errors > 50 post-helper (oczekuję 30-40 dietitianProfile-related, resolves po migration)

Lecimy gdy potwierdzisz.
