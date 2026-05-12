# DELETION_PREVIEW_6a.md — K6a: Patient → Company (backend + schema)

**Status:** PROPOZYCJA. Czekam na "ok 6a final" przed GATE 1 (helper script + edits).
**Branch:** `main` (HEAD = `1e97b6d`)
**Strategy:** Opcja B split — K6a = schema+backend (this preview), K6b = frontend (separate preview after K6a commit).
**Decyzje GATE 0 (lock-in):**
- 1/4 email.ts: **X2 Smart rename** (orphan drop + surviving rename)
- 2/4 Migration: **Plan B** (3 phase migrations w 1 commicie, 5 gates)
- 3/4 URL params: **Hard rename** `:patientId` → `:companyId`, brak aliasów
- 4/4 Helper script: **Helper + manual hot-spots** (analogicznie K5a/b/c)

---

## §0. Pre-flight estimate

**Touchpoints (verified by grep):**
- 19 `prisma.patient.*` calls w 7 plikach backend
- 67 `patientId` refs (non-migration) w 17 plikach
- 31 `Patient\b` type refs (non-migration) w 12 plikach
- ~280 total `patient/Patient` operational touchpoints w 37 plikach

**K6a scope (backend + schema):** ~180-200 touchpoints w ~22 plikach
**K6b scope (frontend) deferred:** ~52 touchpoints w ~9 plikach (oszacowanie patrz §11)

**Wykluczenia z K6a:**
- 6 orphan diet utils (~22 patient refs) → K9
- 70 TODO(*-cleanup) markers (commented blocks) → K9
- 84 historical migration SQL refs → NEVER edit

**Schema verification:**
- `enum Sex` **NIE istnieje** w schemie (`sex` to `String?`) ✅
- **Tylko `Order` model** ma `patientId` FK (verified — żaden inny model nie ma `patientId\s+String/Int`) ✅
- `Subscription` używa `userId`, brak `patientId` ✅

---

## §1. SCHEMA changes (per-phase, Plan B)

### Phase 1 schema edit — drop diet fields + rename contact fields

`packages/database/prisma/schema.prisma:106-126`:

```diff
 model Patient {
   id          String   @id @default(cuid())
   userId      String   @unique
   dietitianId String?
   createdAt   DateTime @default(now())
   updatedAt   DateTime @updatedAt

-  firstName String?
-  lastName  String?
-  sex       String?
-  birthYear Int?
-  birthDate DateTime?
-  heightCm  Int?
-  weightKg      Decimal?  @db.Decimal(6, 2)
+  contactFirstName String?
+  contactLastName  String?

   user             User              @relation("PatientUser", fields: [userId], references: [id], onDelete: Cascade)
   dietitian        User?             @relation("PatientDietitian", fields: [dietitianId], references: [id])
   orders           Order[]

   @@index([dietitianId])
 }
```

**Po phase 1:** Model nadal `Patient`, table w Postgres nadal `Patient`. Same kolumny diff.

### Phase 2 schema edit — rename model

```diff
-model Patient {
+model Company {
   id          String   @id @default(cuid())
   ...
-  user             User              @relation("PatientUser", ...)
-  dietitian        User?             @relation("PatientDietitian", ...)
+  user             User              @relation("CompanyUser", ...)
+  dietitian        User?             @relation("CompanyDietitian", ...)
   orders           Order[]
   @@index([dietitianId])
 }
```

User model (linie 87-88):
```diff
-  patient                 Patient?                 @relation("PatientUser")
-  patientsAsDietitian     Patient[]                @relation("PatientDietitian")
+  company                 Company?                 @relation("CompanyUser")
+  companiesAsDietitian    Company[]                @relation("CompanyDietitian")
```

Order model (linie 175, 183):
```diff
 model Order {
   id                String      @id @default(cuid())
   patientId         String                  // jeszcze patientId — phase 3 rename
   ...
-  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
+  company Company @relation(fields: [patientId], references: [id], onDelete: Cascade)  // relation rename, kolumna nadal patientId
   @@index([patientId])
 }
```

**Po phase 2:** Prisma client używa `prisma.company.*`, Postgres table jest `Company`. Order FK column nadal `patientId` (drobny mismatch — fixed w phase 3).

### Phase 3 schema edit — rename FK column

Order model:
```diff
 model Order {
   id                String      @id @default(cuid())
-  patientId         String
+  companyId         String
   ...
-  company Company @relation(fields: [patientId], references: [id], onDelete: Cascade)
+  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
-  @@index([patientId])
+  @@index([companyId])
 }
```

**Po phase 3:** Pełna spójność `prisma.company` ↔ Postgres `Company` ↔ Order.companyId FK.

### Comments cleanup (deferred do K9)

Linie 516, 520 schema.prisma:
```
// ─── Patient Day Regeneration ─────────────────────
// ─── Patient ↔ Dietitian Chat (79.1) ──────────────
```
**Decyzja:** K9 territory (martwe placeholder comments). Zostawić w K6a.

---

## §2. BACKEND TOUCHPOINTS AUDIT (per-file kategoryzacja)

### §2.1 Pattern types

| Kategoria | Action helper script | Manual review? |
|---|---|---|
| **A** `prisma.patient.` → `prisma.company.` | Bulk | Nie |
| **B** `tx.patient.` → `tx.company.` | Bulk | Nie |
| **C** `patientId` → `companyId` (word boundary) | Bulk | Nie |
| **D** `: Patient` → `: Company` (type annotations) | Bulk | Nie |
| **E** `import { Patient }` → `import { Company }` | Bulk | Nie |
| **F** `patient.firstName/lastName` → `company.contactFirstName/contactLastName` | Bulk (specjalny pattern) | Nie |
| **G** `patient.sex/birthYear/birthDate/heightCm/weightKg` | **DROP line** | TAK — manual selective |
| **H** `assertPatientOwnership` → `assertCompanyOwnership` | Bulk | Nie |
| **I** SELECT/include `{ firstName, lastName, sex, birthYear, ... }` | **Manual line edit** | TAK |
| **J** Error messages `'Patient not found'` → `'Company not found'` | Bulk | Nie |
| **K** Variable names `const patient` → `const company` | Bulk | Nie |
| **L** URL params `:patientId` → `:companyId` | Bulk (route files) | Nie |
| **M** Function params `patientFirstName: string` → `contactFirstName: string` | Bulk (email-specific) | Nie |
| **N** `patientsAsDietitian` → `companiesAsDietitian`, `getDietitianPatients` → `getDietitianCompanies` | Bulk (K7 territory ale rename mechaniczny) | Nie |
| **O** TODO(*-cleanup) commented blocks | **SKIP** (K9 territory) | TAK — verify skip |

### §2.2 Files in K6a scope — touchpoint count + action

| File | Total hits | K6a action |
|---|---|---|
| `services/order.service.ts` | 69 (44 patient + 17 patientId + 8 prisma.patient) | Bulk rename, manual review L48-49 (dietitianId K7-territory) |
| `utils/email.ts` | 32 patient | **Smart drop+rename per §7** — drop 9 orphan funcs, rename 7 keepers |
| `services/checkout.service.ts` | 30 (22 patient + 5 patientId + 3 prisma.patient) | Bulk rename |
| `controllers/order.controller.ts` | 29 (19 patient + 9 patientId + 1 prisma.patient) | Bulk rename |
| `services/admin.service.ts` | 19 (16 patient + 3 prisma.patient) | Bulk rename, **manual L550-557 SELECT diet fields drop** |
| `services/dsar.service.ts` | 16 (13 patient + 2 patientId + 1 prisma.patient) | Bulk rename, **manual L136-143 DSAR export shape change** ⚠️ RODO |
| `controllers/admin.controller.ts` | 15 (14 patient + 1 patientId) | Bulk rename non-TODO refs, skip TODO blocks |
| `services/auth.service.ts` | 10 (6 patient + 2 patientId + 2 prisma.patient) | Bulk rename, **manual L73 JWT claim rename** ⚠️ |
| `services/adminSubscription.service.ts` | 9 patient | Bulk rename |
| `controllers/profile.controller.ts` | 5 patient (all TODO) | **SKIP — K9 territory** (0 K6a hits) |
| `routes/admin.routes.ts` | 14 (9 patient + 5 patientId, mostly TODO) | Skip TODO; L53 K7 territory (mechaniczny rename) |
| `__tests__/services/auth.service.test.ts` | 17 (14 patient + 3 patientId) | Bulk rename fixtures+mocks |
| `__tests__/services/userCleanup.service.test.ts` | 4 patient | Bulk rename |
| `services/userCleanup.service.ts` | 4 (2 patient + 2 Patient) | Bulk rename |
| `routes/order.routes.ts` | 4 (2 patient + 2 patientId) | Bulk rename — URL params hard rename |
| `services/profile.service.ts` | 2 patient | Bulk rename |
| `services/testimonial.service.ts` | 2 patient | Bulk rename |
| `middleware/auth.ts` | 2 (1 patient + 1 patientId) | Bulk rename req.user shape |
| `services/appSettings.service.ts` | 2 patient (`patientRating` weight) | **SKIP — likely K9 (diet scoring config)** |
| `controllers/webhook.controller.ts` | 1 patient (comment) | Bulk rename |
| `routes/checkout.routes.ts` | 1 patient (comment) | Bulk rename |
| `routes/profile.routes.ts` | 1 patient (TODO) | **SKIP — K9** |

### §2.3 Critical hot-spots (manual review required)

Detail w §10.

---

## §3. MIGRATION PHASES (Plan B — 3 migrations w 1 commicie K6a)

### Phase 1: `drop_patient_columns_and_rename_contacts`

**Expected SQL (after `prisma migrate diff`):**
```sql
ALTER TABLE "Patient" DROP COLUMN "sex";
ALTER TABLE "Patient" DROP COLUMN "birthYear";
ALTER TABLE "Patient" DROP COLUMN "birthDate";
ALTER TABLE "Patient" DROP COLUMN "heightCm";
ALTER TABLE "Patient" DROP COLUMN "weightKg";
ALTER TABLE "Patient" RENAME COLUMN "firstName" TO "contactFirstName";
ALTER TABLE "Patient" RENAME COLUMN "lastName" TO "contactLastName";
```

**Sex enum DROP:** Brak — `enum Sex` nie istnieje (`sex` to `String?`).

**SQL count: ~7 statements. ✅ Well under 500 lines.**

**Schema state po phase 1:** Patient model w Prisma (bez 5 dropped + 2 renamed), table w Postgres NADAL "Patient".

### Phase 2: `rename_patient_table_to_company`

**Expected SQL:**
```sql
ALTER TABLE "Patient" RENAME TO "Company";
-- Prisma rename FK constraints + indexes automatically:
-- ALTER INDEX "Patient_userId_key" RENAME TO "Company_userId_key"
-- ALTER INDEX "Patient_dietitianId_idx" RENAME TO "Company_dietitianId_idx"
-- (Foreign keys referencing Patient pkey get auto-renamed by Postgres)
```

**SQL count: ~3-5 statements. ✅**

**Schema state po phase 2:** Prisma client = `prisma.company`, Postgres table = "Company". Order.patientId column NADAL nazywa się `patientId` (mismatch — fixed phase 3).

**⚠️ Uwaga:** Prisma może generate kombinację ALTER TABLE RENAME + auto FK constraint rename. SQL preview w GATE 2 zweryfikuje.

### Phase 3: `rename_order_patientid_to_companyid`

**Expected SQL:**
```sql
ALTER TABLE "Order" RENAME COLUMN "patientId" TO "companyId";
-- Indexes + FK constraint rename automatic:
-- ALTER INDEX "Order_patientId_idx" RENAME TO "Order_companyId_idx"
-- ALTER TABLE "Order" RENAME CONSTRAINT "Order_patientId_fkey" TO "Order_companyId_fkey"
```

**SQL count: ~3 statements. ✅**

**Schema state po phase 3:** Pełna spójność `prisma.company.*` ↔ "Company" table ↔ Order.companyId FK.

### **Łączny szacunek SQL: ~15 statements w 3 migracjach. Bezpiecznie < 500 lines.** ✅

---

## §4. AUTH / NextAuth / JWT changes

### Backend `apps/backend/src/middleware/auth.ts`

Line 14:
```diff
 export interface AuthenticatedUser {
   id: string;
   role: UserRole;
-  patientId?: string;
+  companyId?: string;
 }
```

### Backend `apps/backend/src/services/auth.service.ts`

Line 73 (JWT signing):
```diff
 const token = jwt.sign(
-  { sub: user.id, email: user.email, role: user.role, patientId: patient?.id },
+  { sub: user.id, email: user.email, role: user.role, companyId: company?.id },
   ...
 );
```

Line 97 (response):
```diff
 return {
   user: {
     id: user.id,
     ...
-    patientId: patient?.id ?? null,
+    companyId: company?.id ?? null,
   },
   token
 };
```

Line 150 (signup create):
```diff
-await prisma.patient.create({
+await prisma.company.create({
   data: {
     userId: user.id,
-    firstName: input.firstName ?? null,
-    lastName: input.lastName ?? null,
+    contactFirstName: input.firstName ?? null,    // input field name TBD — likely K10 rename
+    contactLastName: input.lastName ?? null,      // input field name TBD
   },
 });
```

**⚠️ Breaking change:** JWT tokens issued before K6a będą miały `patientId` claim. Po K6a backend expectuje `companyId`. **Safe w dev** (no real users). Prod migration plan: invalidate all tokens lub dual-decode (NOT applicable do K6a).

### Frontend `apps/web/src/auth.ts` + `next-auth.d.ts`

**DEFERRED do K6b.** Frontend nadal czyta `session.user.patientId` z token. Type mismatch ale runtime poradzi sobie z `undefined` (session.user.patientId = undefined po K6a, dopóki K6b nie rename do companyId).

---

## §5. TESTS (backend only — K6a scope)

### Pliki w scope K6a:

**`apps/backend/src/__tests__/services/auth.service.test.ts`** (17 hits)
- L7: `patient: { findUnique: vi.fn(), create: vi.fn() }` → `company: { ... }`
- L32, 42: mock model wiring rename
- L118-198: assertions + mocked return values rename
- Test fixtures: `{ id: 'patient-1' }` → `{ id: 'company-1' }` (uważać — może być inny pattern w test data)

**`apps/backend/src/__tests__/services/userCleanup.service.test.ts`** (4 hits)
- L7, 18, 33: mock setup rename
- L119: `expect(m.patient.updateMany).toHaveBeenCalledWith(...)` — rename

### Pliki BEZ patient refs (nie tykamy):
- `__tests__/services/auditRetention.service.test.ts`
- `__tests__/utils/encryption.test.ts`
- `__tests__/utils/errors.test.ts`
- `__tests__/setup.ts`

### Post-K6a test run:
```bash
npm test -w apps/backend
```
**Wymagane:** wszystkie testy zielone. Jeśli czerwone — fix przed commit.

---

## §6. PRE-MIGRATION code cleanup (Phase 0 — before phase 1 migration)

**Cel:** Zanim cokolwiek apply'ujemy na DB, kod backendu musi być zaktualizowany do nowego API (`prisma.company.*`). Migracja jest stosowana DOPIERO po code rename, żeby między phase apply a code update nie było mismatch.

**Sequence:**

1. **Step 1** — Helper script `k6a-rename-patient.js` run (mechaniczny rename — §9)
2. **Step 2** — Manual hot-spots fix (§10)
3. **Step 3** — Email.ts smart cleanup (§7 — drop 9 orphan funcs, rename 7 keepers)
4. **Step 4** — Run `npm run typecheck` per workspace (oczekiwane: backend exit 0; frontend may be != 0)
5. **Step 5** — Schema edit phase 1 (drop diet fields + rename contacts)
6. **Step 6** — `prisma migrate dev --create-only --name drop_patient_columns_and_rename_contacts` → preview SQL → GATE Phase 1 → apply
7. **Step 7** — Schema edit phase 2 (rename model + User relations + Order.company relation)
8. **Step 8** — `prisma migrate dev --create-only --name rename_patient_table_to_company` → preview → GATE Phase 2 → apply
9. **Step 9** — Schema edit phase 3 (rename Order.patientId → companyId)
10. **Step 10** — `prisma migrate dev --create-only --name rename_order_patientid_to_companyid` → preview → GATE Phase 3 → apply
11. **Step 11** — `npm run typecheck` + `npm run build` + `npm test -w apps/backend`
12. **Step 12** — GATE 5 → atomic commit

**Frontend NIE jest dotykany w K6a.** Frontend typecheck będzie się sypał po K6a — to OK, K6b fixuje.

---

## §7. EMAIL.TS smart rename — X2 categorization

### Lista 16 exported functions w `utils/email.ts`:

| # | Function | Importerzy (active code) | Decision | Reason |
|---|---|---|---|---|
| 1 | `sendPasswordResetEmail` (L24) | `auth.service.ts` | **KEEP + rename** | Auth infrastructure |
| 2 | `sendDietPlanReadyEmail` (L56) | — none — | **DROP orphan** | Diet plan flow dropped K2/K4 |
| 3 | `sendOrderConfirmationEmail` (L91) | `order.service.ts` | **KEEP + rename** | Order flow alive in bambooIT |
| 4 | `sendWeeklySummaryEmail` (L150) | — none — | **DROP orphan** | Diet weekly summary, removed K2/K4 |
| 5 | `sendMealReminderEmail` (L242) | — none — | **DROP orphan** | Diet meal reminder, removed K2/K4 |
| 6 | `sendConsultationPatientEmail` (L285) | `checkout.service.ts` | **KEEP + rename** | CONSULTATION productType still alive (K8 może drop) |
| 7 | `sendConsultationDietitianEmail` (L320) | `checkout.service.ts` | **KEEP + rename** | Same as above, K7 will affect dietitian portion |
| 8 | `sendEmailVerificationEmail` (L369) | `admin.service.ts`, `auth.service.ts`, `profile.service.ts` | **KEEP + rename** | Email verification infrastructure |
| 9 | `sendSubscriptionCancelEmail` (L402) | `order.service.ts` | **KEEP + rename** | Subscription lifecycle alive |
| 10 | `sendAccountDeletionEmail` (L440) | `profile.service.ts` | **KEEP + rename** | RODO infrastructure (account deletion confirmation) |
| 11 | `sendCustomCampaignEmail` (L464) | — none — | **DROP orphan** | Email campaigns dropped K5c |
| 12 | `sendDietitianSummaryEmail` (L491) | — none — | **DROP orphan** | DIETITIAN role + diet summary, K7+K9 territory |
| 13 | `sendPatientInvitationEmail` (L599) | — none — | **DROP orphan** | DIETITIAN→patient invitation, dropped K7 territory |
| 14 | `sendInterviewSubmittedToDietitian` (L646) | — none — | **DROP orphan** | Interview flow dropped K2/K4 |
| 15 | `sendInterviewConfirmationToPatient` (L685) | — none — | **DROP orphan** | Interview flow dropped K2/K4 |
| 16 | `sendInterviewUpdateRequestEmail` (L725) | — none — | **DROP orphan** | Interview flow dropped K2/K4 |

### Summary:
- **7 KEEP + rename:** sendPasswordResetEmail, sendOrderConfirmationEmail, sendConsultationPatientEmail, sendConsultationDietitianEmail, sendEmailVerificationEmail, sendSubscriptionCancelEmail, sendAccountDeletionEmail
- **9 DROP orphan:** sendDietPlanReadyEmail, sendWeeklySummaryEmail, sendMealReminderEmail, sendCustomCampaignEmail, sendDietitianSummaryEmail, sendPatientInvitationEmail, sendInterviewSubmittedToDietitian, sendInterviewConfirmationToPatient, sendInterviewUpdateRequestEmail

### Rename details dla KEEPERS:

- `patientFirstName: string` (param name) → `contactFirstName: string`
- Variable refs `patient.firstName` → `company.contactFirstName`
- Function name `sendConsultationPatientEmail` → **debate**: czy rename do `sendConsultationCompanyEmail` (matches model) lub `sendConsultationContactEmail` (matches concept — to kontakt firmy, nie firma sama)?
  - **Rekomendacja:** `sendConsultationContactEmail` — bardziej semantyczne. Wymaga rename importera w checkout.service.ts.
  - Alternative bardziej konserwatywne: zostawić `sendConsultationPatientEmail` z renamed wewnątrz (function name = K9 cosmetic cleanup)
- Polish copy: "Pacjent: ${data.patientName}" → "Klient: ${data.contactName}" (concept rename — kontakt firmy klienta)
- Template variables: `{{patient.firstName}}` → `{{company.contactFirstName}}` (with `|| 'Klient'` fallback gdy null)

### Akcje w `utils/email.ts`:

1. **DROP funkcje 2, 4, 5, 11, 12, 13, 14, 15, 16** (9 functions, ~LINES 56-89, 150-241, 242-284, 464-491, 491-598, 599-645, 646-684, 685-724, 725-end)
2. **RENAME params/vars in funkcje 1, 3, 6, 7, 8, 9, 10**
3. **POSTPONE function name rename** (np. sendConsultationPatientEmail → ConsultationContactEmail) do K9 — to cosmetic, K6a focus na model rename consistency
4. **Polish copy update** w surviving templates — "Pacjent" → "Klient"

**Łączne LOC change w email.ts:** drop ~400 lines (9 orphan funcs), edit ~30 lines (rename params/vars w 7 keepers).

---

## §8. BACKUP strategy

**Decyzja:** **JEDEN backup przed phase 1**, każda kolejna phase ma git rollback option (revert do poprzedniego commit między phases). Phase-by-phase backup byłby overkill.

```bash
mkdir -p backup
docker exec bambooit_postgres pg_dump -U bambooit_user -d bambooit > backup/backup_pre_6a_$(date +%Y%m%d_%H%M%S).sql
```

**Gitignore:** `backup/backup_pre_*.sql` (analogicznie do K5a/b/c).

**Restore command (na rollback):**
```bash
docker exec -i bambooit_postgres psql -U bambooit_user -d bambooit < backup/backup_pre_6a_<timestamp>.sql
```

**Backup size estimate:** ~5-15 MB (dev DB, few seed records).

---

## §9. HELPER SCRIPT scope

**File:** `scripts/cleanup-helpers/k6a-rename-patient.js`

### Bulk patterns (Node.js find/replace w `apps/backend/src/**/*.ts`):

#### Group A: Prisma client + model refs
```js
// prisma.patient. → prisma.company.
/\bprisma\.patient\b/g → 'prisma.company'
// tx.patient. → tx.company.
/\btx\.patient\b/g → 'tx.company'
```

#### Group B: Field refs
```js
// patientId → companyId (word boundary)
/\bpatientId\b/g → 'companyId'
// patientIds → companyIds
/\bpatientIds\b/g → 'companyIds'
```

#### Group C: Type annotations + imports
```js
// : Patient → : Company
/:\s*Patient\b/g → ': Company'
// <Patient> → <Company>
/<Patient>/g → '<Company>'
// import { Patient } / import { ..., Patient, ... }
/(import\s*\{[^}]*?)\bPatient\b/g → '$1Company'
```

#### Group D: Specific compound identifiers
```js
// assertPatientOwnership → assertCompanyOwnership
/\bassertPatientOwnership\b/g → 'assertCompanyOwnership'
// patientIdParamSchema → companyIdParamSchema
/\bpatientIdParamSchema\b/g → 'companyIdParamSchema'
// patientsAsDietitian → companiesAsDietitian
/\bpatientsAsDietitian\b/g → 'companiesAsDietitian'
// getDietitianPatients → getDietitianCompanies (K7 will drop entirely)
/\bgetDietitianPatients\b/g → 'getDietitianCompanies'
```

#### Group E: Specific field accesses (NOT generic .firstName/.lastName — those are also on User)
```js
// patient.firstName → company.contactFirstName (must scope to patient/company context)
// patient.lastName → company.contactLastName
// patient.sex/birthYear/birthDate/heightCm/weightKg → REMOVE LINE (more complex)

// Approach: regex match `\bpatient(?:\?)?\.(firstName|lastName|sex|birthYear|birthDate|heightCm|weightKg)\b`
// → if firstName: replace with company?.contactFirstName
// → if lastName: replace with company?.contactLastName
// → if other: FLAG for manual review (line context needed)
```

#### Group F: Variable names (careful — only same case)
```js
// const patient = → const company =
/\bconst\s+patient\s*=/g → 'const company ='
// let patient = → let company =
/\blet\s+patient\s*=/g → 'let company ='
```

#### Group G: Error messages
```js
// 'Patient not found' → 'Company not found'
/'Patient not found'/g → "'Company not found'"
// "Patient profile not found" → "Company profile not found"
/"Patient profile not found"/g → '"Company profile not found"'
// itd. — list patterns
```

### SKIP patterns (NIE rename):
- Comments containing TODO(*-cleanup) — leave untouched (K9 territory)
- Lines inside `/* ... */` block comments — depends on intent (likely skip)
- Test files: same rename applied (`apps/backend/src/__tests__/**/*.ts`)
- Files in `utils/` orphan list (cuisineMapping, composeMealsFlag, scaleRecipeSteps, mealSchedule, ingredientDisplayName, templateRenderer) — SKIP, K9 drops these entirely

### Output: dry-run report
Helper script first runs in dry-run mode:
```
[k6a-rename] dry-run results:
  - 23 files would be modified
  - 167 patterns replaced
  - 12 files require manual review:
    - apps/backend/src/services/admin.service.ts (SELECT diet fields drop)
    - apps/backend/src/services/dsar.service.ts (DSAR export shape)
    - apps/backend/src/utils/email.ts (smart cleanup §7)
    ...
```

User confirms dry-run → second invocation `--apply` to write.

### Email.ts smart cleanup (separate logic):
Email.ts smart drop is NOT mechanical rename — needs AST-aware (or careful line range) edit. Implemented as separate function in helper, or **manually with Edit tool** post-bulk.

---

## §10. HOT-SPOTS (manual review po helper run)

### 1. `apps/backend/src/services/admin.service.ts:550-557` — SELECT diet fields
```ts
patient: {
  select: {
    firstName: true,    // → contactFirstName (rename)
    lastName: true,     // → contactLastName (rename)
    sex: true,          // ❌ DROP — field deleted
    birthYear: true,    // ❌ DROP
    heightCm: true,     // ❌ DROP
    weightKg: true,     // ❌ DROP
  },
},
```
**Action:** Manual Edit — drop 4 lines, rename 2.

### 2. `apps/backend/src/services/dsar.service.ts:136-143` — DSAR export shape ⚠️ RODO
```ts
patient: patient
  ? {
      firstName: patient.firstName,    // → contactFirstName
      lastName: patient.lastName,      // → contactLastName
      sex: patient.sex,                // ❌ DROP
      birthYear: patient.birthYear,    // ❌ DROP
      heightCm: patient.heightCm,      // ❌ DROP
      weightKg: patient.weightKg ? Number(patient.weightKg) : null,  // ❌ DROP
    }
  : null,
```
**Action:** Manual Edit — drop 4 lines, rename 2 + rename outer `patient` → `company`.
**RODO impact:** Drop pól, których nie zbieramy. ZGODNE z prawem. DPIA may need update (K9 territory).

### 3. `apps/backend/src/services/auth.service.ts:73` — JWT claim ⚠️ Breaking
```ts
const token = jwt.sign(
  { sub: user.id, email: user.email, role: user.role, patientId: patient?.id },
  ...
);
```
**Action:** Rename `patientId` claim → `companyId`. Breaking for existing tokens (dev only — safe).

### 4. `apps/backend/src/utils/email.ts` — smart drop+rename (§7 logic)

### 5. `apps/backend/src/services/auth.service.ts:150` — signup create
```ts
await prisma.patient.create({
  data: {
    userId: user.id,
    firstName: ...,
    lastName: ...,
  },
});
```
**Action:** Rename to `prisma.company.create` + `firstName→contactFirstName, lastName→contactLastName`.

### 6. `apps/backend/src/services/userCleanup.service.ts:59` — dietitianId nullify
```ts
await tx.patient.updateMany({ where: { dietitianId: userId }, data: { dietitianId: null } });
```
**Action:** Rename `tx.patient` → `tx.company`. Logika K7 territory (dietitianId field drop w K7), K6a rename only.

### 7. `apps/backend/src/services/admin.service.ts:303` — patient backfill (?)
**Action:** Verify context — likely orphan or legitimate seed. Read full function before deciding.

### 8. `apps/backend/src/routes/order.routes.ts:21, 23` — URL params
```ts
orderRouter.post('/:patientId', ...);  // → /:companyId
orderRouter.get('/:patientId', ...);   // → /:companyId
```
**Action:** Hard rename (decyzja 3/4).

### 9. `apps/backend/src/services/checkout.service.ts` — patient.dietitian block (L174-181)
K7 territory but K6a rename mechaniczny do `company.dietitian`.

### 10. `apps/backend/src/services/appSettings.service.ts:59, 74` — patientRating
**Action:** SKIP w K6a — `patientRating` to scoring weight pole AppSettings, likely K9 (diet solver residue). Verify usage w K9.

### 11. Comment context renames
- `// patient can proceed to interview` (order.service:93) → `// company can proceed` (lub drop — interview dropped)
- `// DIETITIAN can only see orders of their own patients` (order.controller:120) → `// ...their own companies` (K7 territory ale rename mechaniczny)

### 12. `apps/backend/src/services/admin.service.ts:362, 380` — `patientsAsDietitian`
```ts
_count: { select: { patientsAsDietitian: true } }
// p.user._count.patientsAsDietitian
```
**Action:** Rename do `companiesAsDietitian` (per schema rename). K7 territory ale rename mechaniczny.

---

## §11. K6b scope estimate (frontend — deferred preview)

### Files in K6b (post-K6a commit):

| File | Hits | Action |
|---|---|---|
| `apps/web/src/auth.ts` | 5 patient | NextAuth session shape rename |
| `apps/web/src/types/api.ts` | 10 (7 patient + 3 patientId) | Mirror types `Patient` → `Company`, `patientId` → `companyId` |
| `apps/web/src/types/next-auth.d.ts` | 2 patient | Session type augmentation |
| `apps/web/src/lib/api.ts` | 9 (8 patient + 1 patientId) | API client methods rename |
| `apps/web/src/components/admin/UsersTable.tsx` | 8 patient | Component props + render rename |
| `apps/web/src/components/admin/AdminTestimonials.tsx` | 2 patient | Minor display refs |
| `apps/web/src/components/admin/audit-labels.ts` | 2 Patient | Audit log label rename |
| `apps/web/src/__tests__/lib/sentry-scrub.test.ts` | 6 patient | Test fixtures rename |
| `apps/web/src/app/llms-full.txt/route.ts` | 1 patient | LLM context text rename |
| `apps/web/src/app/[locale]/admin/email-kampanie/page.tsx` | 13 patient | **Verify orphan** — email campaigns dropped K5c. Likely K9 drop entirely. |

### K6b estimate: ~52 touchpoints w 9 plikach (excluding email-kampanie if orphan).

K6b workflow analogiczny do K6a ale BEZ migration step (frontend only). 3 gates:
1. "ok 6b final"
2. "ok edits 6b" (after helper script + manual)
3. "ok commit 6b"

**Po K6b commit:** Full Patient → Company rename complete across stack. Backend + frontend + DB spójne.

---

## §12. ROLLBACK plan

### Per-phase rollback (between phases):

**Phase 1 applied, rollback before phase 2:**
```bash
# Code rollback: phase 1 schema edit revert
git checkout HEAD~ packages/database/prisma/schema.prisma  # if committed locally already
# DB rollback:
docker exec -i bambooit_postgres psql -U bambooit_user -d bambooit < backup/backup_pre_6a_*.sql
# Remove failed migration from history:
docker exec bambooit_postgres psql -U bambooit_user -d bambooit -c "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%drop_patient_columns%';"
# Delete migration file:
rm -rf packages/database/prisma/migrations/*drop_patient_columns*/
```

**Phase 2/3 applied, rollback before commit:**
Same pattern. DB restore + remove migrations + revert schema.

### Post-commit rollback (full K6a revert):

```bash
git revert <K6a-commit-hash>
docker exec -i bambooit_postgres psql -U bambooit_user -d bambooit < backup/backup_pre_6a_*.sql
# Remove K6a migrations from _prisma_migrations table:
docker exec bambooit_postgres psql -U bambooit_user -d bambooit -c "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%rename_patient%' OR migration_name LIKE '%drop_patient_columns%' OR migration_name LIKE '%rename_order_patient%';"
```

### Risk: ŚREDNI
K6a jest duża (~180-200 touchpoints, 3 migracje DB), ale każda phase ma backup + git history. Po commicie typecheck+build+tests są gating — zła zmiana nie zmierzy.

---

## §13. 5 GATES dla K6a

### GATE 0 — Pre-flight (current state)
**Status:** This preview. Czekam na "ok 6a final".

### GATE 1 — Code prep ready (przed phase 1 migrate)
Po:
- Backup created
- Helper script `k6a-rename-patient.js` napisany + dry-run preview pokazany
- Helper apply → 23 plików zmodyfikowanych
- Manual hot-spots fixed (§10 lista)
- Email.ts smart cleanup applied (drop 9 + rename 7 funcs)
- `npm run typecheck` — **backend exit 0** (frontend != 0 acceptable)
- `npm test -w apps/backend` — all green

**Pokażę:**
- Backup file size + location
- Helper dry-run report
- Diff stat (files changed, lines +/-)
- Top 5 hot-spot edits (code diff)
- Typecheck log
- Test log

**Czekam na:** "ok phase 1" → proceed phase 1 schema edit.

### GATE 2 — Phase 1 ready (drop fields + rename contacts)
Po:
- Schema edit phase 1 (drop 5 + rename 2)
- `npx prisma migrate dev --create-only --name drop_patient_columns_and_rename_contacts`

**Pokażę:**
- Schema diff (phase 1)
- SQL z `migration.sql` (oczekuję ~7 statements)
- `npm run typecheck` log (powinien być OK)

**Czekam na:** "ok phase 2" → apply phase 1 + schema edit phase 2.

### GATE 3 — Phase 2 ready (rename table)
Po:
- Phase 1 applied (`prisma migrate dev` from create-only)
- Schema edit phase 2 (model rename + User relations + Order.company relation)
- `npx prisma migrate dev --create-only --name rename_patient_table_to_company`

**Pokażę:**
- Schema diff (phase 2)
- SQL z `migration.sql` (oczekuję ~3-5 statements)
- Typecheck log

**Czekam na:** "ok phase 3" → apply phase 2 + schema edit phase 3.

### GATE 4 — Phase 3 ready (rename FK column)
Po:
- Phase 2 applied
- Schema edit phase 3 (Order.patientId → companyId)
- `npx prisma migrate dev --create-only --name rename_order_patientid_to_companyid`

**Pokażę:**
- Schema diff (phase 3)
- SQL z `migration.sql` (oczekuję ~3 statements)
- Typecheck log
- DB sanity check (`prisma db pull` lub manual query — verify columns)

**Czekam na:** "ok commit 6a" → apply phase 3 + final tests + commit.

### GATE 5 — Atomic commit
Po:
- Phase 3 applied
- `npm run typecheck` + `npm run build` exit 0
- `npm test -w apps/backend` all green
- DB sanity: tables Company (renamed from Patient), Order has companyId column, dropped columns gone, renamed columns present

**Pokażę:**
- Final typecheck + build logs
- Final test output
- DB schema dump excerpt:
  ```
  Table "public.Company"
   Column            | Type
  -------------------+-------------------------
   id                | text
   userId            | text
   dietitianId       | text (K7 drop pending)
   createdAt         | timestamp(3)
   updatedAt         | timestamp(3)
   contactFirstName  | text
   contactLastName   | text
  ```
- Migration files diff (3 new migrations)

**Czekam na:** "ok commit final 6a" → atomic commit.

---

## 🚦 Aktualnie GATE 0 — czekam na "ok 6a final"

**Wszystkie decyzje GATE 0 (1-4) zalockowane.**

Po "ok 6a final":
1. Create backup
2. Write helper script `k6a-rename-patient.js`
3. Dry-run preview
4. Wait for approval to apply

**STOP w razie:**
- SQL preview > 500 linii w którejkolwiek phase (oczekuję ~15 total)
- Helper dry-run pokazuje > 50 files modified (oczekuję ~23)
- Typecheck po helper > 100 errors (oczekuję few dozen manual fixes)

Lecimy.
