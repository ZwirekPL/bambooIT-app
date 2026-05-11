# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start everything (API + Web concurrently)
```bash
npm run dev
```

### Individual apps
```bash
npm run dev:api   # Express API on port 4000
npm run dev:web   # Next.js on port 3000
```

### Database (packages/database)
```bash
cd packages/database
npm run generate        # prisma generate (after schema change)
npm run migrate:dev     # create + apply migration
npm run migrate:deploy  # apply migrations in prod-like
npm run studio          # Prisma Studio
npm run build           # compile TS → dist/
```

### Frontend (apps/web)
```bash
cd apps/web
npm run lint
npm run type-check   # tsc --noEmit
npm run build
```

### Backend (apps/backend)
```bash
cd apps/backend
npm run build   # tsc
```

### Infrastructure
```bash
docker-compose up -d    # start PostgreSQL (5432) and Redis (6379)
```

## Architecture

### Monorepo layout
```
DietetykDEV/
├── apps/
│   ├── backend/      # Express.js API — port 4000
│   └── web/          # Next.js 15 frontend — port 3000
└── packages/
    └── database/     # Prisma ORM singleton, shared by backend
```

### packages/database
- Exports `prisma` (singleton client) and `Prisma` (namespace) via `src/index.ts`
- Must be built (`npm run build` in `packages/database`) before the backend can import it
- Backend imports **only** via the path alias `@db` — never import `@prisma/client` directly in `apps/backend`
- Any schema change requires: `migrate:dev` → `generate` → `npm run build`

### apps/backend
- Entry: `src/server.ts` — env validation, CORS, rate limiting, router mounts, global error handler
- Error responses always use `{ "error": { "code": "ERROR_CODE", "message": "..." } }` — use `apiError()` from `src/utils/errors.ts`
- Sensitive data (Interview.answers, Interview.medicalFlags, DietPlan.content) is encrypted via `encryptJson()` / `decryptJson()` from `src/utils/encryption.ts` (AES-256-GCM)
- Path alias `@db` resolves to `../../packages/database/dist/index` (tsconfig.json + tsconfig-paths at runtime)
- All endpoints validate input with Zod; URL params validated with `z.string().cuid()`
- `src/middleware/errorHandler.ts` — global Express error handler (must be last middleware)
- `src/utils/errors.ts` — `apiError()` helper + `AppError` class
- `src/utils/encryption.ts` — `encryptJson()` / `decryptJson()` (handles legacy plaintext gracefully)

### apps/web
- Next.js 15 App Router with `[locale]` segment — all pages live under `src/app/[locale]/`
- i18n: `next-intl` with `pl` (default) and `en`; routing config in `src/i18n/routing.ts`
- Navigation: always import from `@/i18n/navigation` (createNavigation), not directly from next-intl
- Translations: `messages/pl.json` and `messages/en.json`
- Auth: NextAuth v5 Credentials provider; calls `API_URL/auth/login` (server-side); JWT session strategy with `role` propagated to token/session
- `src/auth.ts` — NextAuth config + handlers; `src/auth.config.ts` — base config (used in middleware)
- API calls: use `apiFetch` / `api.*` from `src/lib/api.ts` (typed wrapper, returns typed models from `src/types/api.ts`)
- Brand: all names/domain/social/SEO come from `config/brand.ts` → `BRAND.*`; never hardcode brand strings
- UI: shadcn/ui components in `src/components/ui/`; Tailwind CSS + class-variance-authority

## Key Rules (from RULES.md)

- **Odpowiadaj zawsze po polsku** — wszystkie odpowiedzi do użytkownika muszą być w języku polskim, niezależnie od języka pytania
- **Code and comments in English; domain discussions in Polish**
- **TypeScript strict mode** — no `any`, no `@ts-ignore` (use `@ts-expect-error // reason` if absolutely needed)
- **Never log** raw medical/interview data, diet plan content, or API keys
- **Never commit `.env`** — keep `.env.example` up to date; app must exit with a clear error on missing required vars
- **Shared DB logic only in `packages/database`** — import via `@db` alias
- **Prefer small, modular files** (< 1000 lines)
- **Every endpoint validates input** with Zod; URL params too (`.cuid()`)
- **Never trust AI output** — validate and sanitize before saving to DB
- **Encrypt medical data** — always use `encryptJson()` for `Interview.answers`, `Interview.medicalFlags`, `DietPlan.content`
- **Commit format**: `stepXX: description` or `feat(scope): description` (English)
- TODOs must reference an issue: `// TODO(#123): description`

## Environment Variables

### apps/backend (`apps/backend/.env`)
```
DATABASE_URL=postgresql://dietetyk:dietetyk123@localhost:5432/dietetyk_ai?schema=public
ENCRYPTION_KEY=<openssl rand -hex 32>   # 64 hex chars = 32 bytes
CORS_ORIGIN=http://localhost:3000
PORT=4000
```

### apps/web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000
API_URL=http://localhost:4000
```

### packages/database (`packages/database/.env`)
```
DATABASE_URL=postgresql://dietetyk:dietetyk123@localhost:5432/dietetyk_ai?schema=public
```

## Data Model (Prisma)

| Model | Key fields |
|-------|-----------|
| `Tenant` | `id` (cuid), `slug` (unique), `name`, `ownerId?` (FK→User) |
| `User` | `id` (cuid), `email` (unique), `passwordHash?`, `role`, `deletedAt?` (soft delete) |
| `Patient` | `userId` (FK→User), `tenantId?` (FK→Tenant), health profile fields |
| `Interview` | `patientId`, `tenantId?`, `answers: Json` (encrypted), `medicalFlags: Json?` (encrypted) |
| `DietPlan` | `patientId`, `tenantId?`, `source` (AI/MANUAL), `status` (GENERATED/REVIEWED/SENT), `content: Json` (encrypted), macros |

## Multi-Tenant

- `tenantId` is on `Patient`, `Interview`, `DietPlan` — currently nullable (optional), **must always be provided** in new records
- All data queries for tenant-scoped resources must filter by `tenantId`
- Tenant identified by URL path `/t/<tenantSlug>/` (frontend routing — not yet implemented)

## Faza D — Solver refactor in progress (started 2026-04-26)

**Goal:** every LUNCH/DINNER plan slot becomes a `{main, carb_side, veg_side}` composition (3-tuple) instead of a single recipe — the solver gains macro-driven joint scaling and 8 new patient-input constraints (D1-D8). Master plan: `memory/faza-d-solver-refactor-plan.md`.

- **Compose rule:** `mealType ∈ {LUNCH, DINNER} AND slot.pctOfDaily ≥ 18%`. Other slots stay 1-element.
- **Feature flag:** `ENABLE_3_TUPLE_COMPOSITION` (default false during rollout per phased migration).
- **Backward compat:** all existing plans rendered by frontend `MealCard` items.map and shopping list aggregation work unchanged. PDF needs 2 small fixes (meal-card.ts + diet-plan-template.ts) for multi-item rendering — Phase 1 deliverable.
- **Pipeline gap (Phase 0 audit):** 6/8 D1-D8 patient-input fields exist in `PatientContext` but are not propagated to `AssemblyInput`/`SolverRequest`. Phase 1 priority #1 fixes this.
- **Test infrastructure:** gold standard snapshots in `__tests__/services/legacy-solver-baseline.test.ts.snap` lock pre-refactor solver behaviour. Run `npm run test:goldstandard` before/after refactor — flag-OFF must produce identical snapshots.
- **Solver determinism:** `SOLVER_SEED` env var (test-only). Production behaviour unchanged when unset.
- **Joint scaler:** `scaleMealComposition()` in `recipeScaler.service.ts` — allocates kcal shares per element (60/28/12 for full 3-tuple) and reconciles macros via existing per-recipe scaler.

**Phase 0 baseline tag:** `baseline/pre-faza-d-solver-refactor` — rollback target.

## What's Missing / In-Progress

- Auth guards / JWT middleware on protected endpoints
- Service/controller layer (logic currently inline in routes)
- Audit log (login, interview view, plan generation, approval, export, delete)
- Tenant routing on frontend (`/t/<slug>/`)
- Soft delete enforcement (filter `deletedAt: null` in all user queries)
- Redis integration
- PDF generation
- Stripe integration
- n8n / AI workflow integration
