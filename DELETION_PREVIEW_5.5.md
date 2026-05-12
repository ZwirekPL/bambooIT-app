# DELETION_PREVIEW_5.5.md — K5.5: remove unused npm dependencies

**Status:** PROPOZYCJA. Czekam na "ok 5.5 final" + per-item decision dla ⚪ NIEPEWNE.
**Branch:** `main` (HEAD = `df42016`)

---

## §1. depcheck output per workspace

### root (`package.json`)
**No depcheck issue.** (root ma tylko `concurrently` w devDeps używany przez `npm run dev`)

### `apps/backend`
```
Unused dependencies:
  * database
  * p-queue
Unused devDependencies:
  * @types/pdfkit
  * @types/string-similarity
  * @vitest/coverage-v8
  * cross-env
  * tsconfig-paths
```

### `apps/web`
```
Unused dependencies:
  * @dnd-kit/core
  * @dnd-kit/sortable
  * @dnd-kit/utilities
  * @radix-ui/react-navigation-menu
  * qrcode.react
  * recharts
  * undici
Unused devDependencies:
  * @vitest/coverage-v8
  * autoprefixer
  * postcss
```

### `packages/database`
**No depcheck issue.** ✅

---

## §2. KATEGORYZACJA (4 grupy)

### 🟢 PEWNE DO DROP (verified by additional grep — zero usage in current code)

#### `apps/backend` deps (4)
| Package | Powód |
|---|---|
| `bullmq` ⚠️ | **NIE — queues/ jest active dla maintenance worker** (audit retention, user cleanup). FALSE POSITIVE — depcheck nie flaguje, dodaję tylko jako reminder że zostaje. |
| `cheerio` | scraper dropped K2c. Zero usage now. |
| `ioredis` | depcheck NIE flaguje. Sprawdziłem: nadal użyteczne przez `rate-limit-redis` + `queues/index.ts` BullMQ. ZOSTAJE. |
| `openai` | `services/openai.service.ts` dropped K2c. Anthropic SDK od zera w fazie 4. |
| `p-queue` | flagged unused. Was scraper helper. **DROP.** |
| `pdfkit` | `utils/pdf.ts` dropped K2c (`generateDietPlanPdf`). **DROP.** |
| `string-similarity` | diet ingredient matching dropped K2c. Zero usage. **DROP.** |
| `multer` | ⚠️ FILE UPLOADS — sprawdzić, jeśli upload.controller dropped to też DROP. Verify below. |

#### `apps/backend` devDeps (3)
| Package | Powód |
|---|---|
| `@types/pdfkit` | pdfkit dropped — DROP |
| `@types/string-similarity` | string-similarity dropped — DROP |
| `@vitest/coverage-v8` | flagged unused, ale `test:coverage` script jeszcze w package.json. **Pytanie — DROP czy keep?** Coverage tool dla pozostałych 6 testów (auth, auditRetention, userCleanup, encryption, errors). |

#### `apps/web` deps (5)
| Package | Powód |
|---|---|
| `@dnd-kit/core` | drag-drop usunięty (dietitian recipe plan editor) — 0 matches in src. **DROP.** |
| `@dnd-kit/sortable` | jak wyżej. **DROP.** |
| `@dnd-kit/utilities` | jak wyżej. **DROP.** |
| `@radix-ui/react-navigation-menu` | 0 matches w src (Header używa Sheet, nie Radix nav-menu). **DROP.** |
| `qrcode.react` | 0 matches — diet pewnie session QR. **DROP.** |
| `recharts` | 0 matches — diet body measurement charts. **DROP.** |
| `driver.js` ⚠️ | depcheck NIE flaguje (used by `hooks/useTour.ts` + `useMultiPageTour.ts`). **ALE oba hooki są sieroty** — tours/ dropped K4, zero callers w pozostałym kodzie. **DROP + drop 2 hooks files** |

### 🟡 DO WERYFIKACJI (depcheck flagged ale potencjalnie ZOSTAJE)

| Package | Workspace | Comment |
|---|---|---|
| `database` | apps/backend | depcheck nie wykrywa workspace dep `file:../../packages/database` używanej przez `@db` tsconfig alias. **FALSE POSITIVE — ZOSTAJE.** |
| `tsconfig-paths` | apps/backend | używany w `dev` script `ts-node-dev -r tsconfig-paths/register` (resolves `@db`/`@policies`). **FALSE POSITIVE — ZOSTAJE.** |
| `cross-env` | apps/backend | używany w `test:goldstandard` i `test:compose-smoke` scripts ale **te testy zostały dropowane w K2c**. Decyzja: **DROP + edit package.json scripts section** (usuń te 2 diet test scripts). |
| `undici` | apps/web | used in `app/api/proxy/[...path]/route.ts:172,182` for stream body forwarding. **FALSE POSITIVE — ZOSTAJE.** |
| `autoprefixer` | apps/web | Tailwind CSS dependency (przez postcss config). **FALSE POSITIVE — ZOSTAJE.** |
| `postcss` | apps/web | Tailwind CSS dependency. **FALSE POSITIVE — ZOSTAJE.** |

### 🔴 FALSE POSITIVES (nie były flagged, dla porządku)

| Package | Workspace | Reason |
|---|---|---|
| `@playwright/test` | apps/web devDeps | e2e tests (`auth.spec.ts`, `responsive.spec.ts`) — ZOSTAJE |
| `@types/*` | wszystkie | TS compiler types — ZOSTAJĄ |
| `vitest`, `vitejs/plugin-react`, `jsdom`, `@testing-library/*` | apps/web | unit tests — ZOSTAJĄ |
| `@tailwindcss/typography` | apps/web | Tailwind plugin dla blog content — ZOSTAJE |
| `sharp` | apps/web | Next.js image optimization — ZOSTAJE |
| `geist`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` | apps/web | UI stack — ZOSTAJĄ |
| `react-markdown`, `remark-gfm` | apps/web | `LegalMarkdown.tsx` — ZOSTAJE |
| `@fingerprintjs/fingerprintjs` | apps/web | `hooks/useDeviceFingerprint.ts` — ZOSTAJE |
| `@sentry/nextjs` | apps/web | Sentry monitoring — ZOSTAJE |

### ⚪ NIEPEWNE — pytania do user'a

#### Q1. `multer` (apps/backend deps)
File upload library. Plan §1c wymienił `upload.controller.ts` jako ZOSTAJE. Sprawdziłem: `upload.controller.ts` istnieje, używany przez `admin.routes.ts` (`uploadBlogImage` dla `/admin/blog/upload-image`). **ZOSTAJE.** (verified)

#### Q2. `@vitest/coverage-v8` (oba workspaces)
Coverage tool dla `npm run test:coverage` script. Po cleanup zostały tylko podstawowe testy (auth, audit, user, encryption, errors).

**Opcje:**
- **DROP** w obu workspaces — `test:coverage` script też usunąć
- **KEEP** — coverage przydatny przy rozbudowie bambooIT testów w fazie 4

Domyślnie: **KEEP** (re-enable coverage w fazie 4 development). Daj znać jeśli DROP.

#### Q3. Apps/backend scripts section — diet legacy
W `apps/backend/package.json` są diet-only scripts które wymagają `cross-env`:
```
test:goldstandard      → diet solver baseline test (dropped)
test:compose-smoke     → diet 3-tuple meal composition (dropped)
test:scraper           → scraper tests (dropped)
diagnose:ingredients   → diet ingredient diagnosis (dropped)
suggest:ingredient-repairs   → diet (dropped)
apply:ingredient-repairs     → diet (dropped)
analyze:shopping-efficiency  → diet (dropped)
verify:bug4                  → diet (dropped)
```

**Propozycja: DROP wszystkie 8 scripts + cross-env dep.** OK?

---

## §3. PER-PACKAGE.JSON change matrix

### `apps/backend/package.json`
**Dependencies to remove (5):**
- `cheerio`
- `openai`
- `p-queue`
- `pdfkit`
- `string-similarity`

**devDependencies to remove (3):**
- `@types/pdfkit`
- `@types/string-similarity`
- `cross-env`

**Scripts to remove (8):**
- `test:scraper`, `test:goldstandard`, `test:compose-smoke`
- `diagnose:ingredients`, `diagnose:ingredients:csv`
- `suggest:ingredient-repairs`, `apply:ingredient-repairs`
- `analyze:shopping-efficiency`
- `verify:bug4`

### `apps/web/package.json`
**Dependencies to remove (6):**
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `@radix-ui/react-navigation-menu`
- `qrcode.react`
- `recharts`
- `driver.js`

**Files to remove (orphan tour hooks):**
- `apps/web/src/hooks/useTour.ts`
- `apps/web/src/hooks/useMultiPageTour.ts`

**devDependencies:** no changes (all used by tests/Tailwind)

### `packages/database/package.json` + root `package.json`
**No changes.**

---

## §4. Total estimated impact

| Workspace | Deps dropped | DevDeps dropped | Scripts dropped |
|---|---|---|---|
| apps/backend | 5 | 3 | 8 |
| apps/web | 7 (6 deps + 1 driver.js) | 0 | 0 |
| packages/database | 0 | 0 | 0 |
| root | 0 | 0 | 0 |
| **Total** | **12 deps + 3 devDeps = 15 packages** | | **8 backend scripts** |

Plus **2 orphan files** w apps/web/src/hooks (useTour, useMultiPageTour).

**Estimated node_modules reduction:** trudno precyzyjnie przed npm install — najgrubsze dropy: `cheerio` (+dependencies), `pdfkit` (+pngjs, etc.), `recharts` (+d3 family ~5MB), `openai`, `@dnd-kit` (~3MB), `driver.js` (~500KB). Szacunek **30-50 MB redukcja w node_modules**.

---

## §5. 3 GATES

1. **"ok 5.5 final"** + decyzje na ⚪ pytania (Q2 coverage, Q3 scripts) → start uninstall
2. **🛑 Gate 2**: po uninstall + `npm install` + `npm run typecheck` + `npm run build`. CZEKAM na "ok commit 5.5".
3. **Commit** + raport (typecheck/build status, node_modules size delta).

### Pełna sekwencja po "ok 5.5 final"

1. **Per-workspace uninstall** (3 osobne komendy żeby czyste diff per package.json):
   ```bash
   npm uninstall cheerio openai p-queue pdfkit string-similarity \
     @types/pdfkit @types/string-similarity cross-env \
     --workspace=backend

   npm uninstall @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
     @radix-ui/react-navigation-menu qrcode.react recharts driver.js \
     --workspace=web
   ```

2. **Edit `apps/backend/package.json` scripts**: drop 8 diet scripts

3. **Remove orphan hook files**:
   ```bash
   git rm apps/web/src/hooks/useTour.ts apps/web/src/hooks/useMultiPageTour.ts
   ```

4. **Refresh**: `npm install` (lockfile sync)

5. **Verify**: `npm run typecheck` + `npm run build`

6. **Gate 2 report**: package.json diffs + install warnings + typecheck status

7. **Commit K5.5** with message listing all drops per workspace

---

## §6. Commit message proposal

```
chore(cleanup): remove unused npm dependencies after diet domain cleanup (K5.5)

Cleanup of orphan dependencies left after K1-K5c diet domain removal.
Categorized via `npx depcheck` per workspace + manual verify.

apps/backend (8 packages dropped):
- Dependencies: cheerio, openai, p-queue, pdfkit, string-similarity
- DevDependencies: @types/pdfkit, @types/string-similarity, cross-env
- Scripts dropped: test:scraper, test:goldstandard, test:compose-smoke,
  diagnose:ingredients(:csv), suggest:ingredient-repairs,
  apply:ingredient-repairs, analyze:shopping-efficiency, verify:bug4
  (all referenced scripts deleted in K2c)

apps/web (7 packages dropped):
- Dependencies: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities,
  @radix-ui/react-navigation-menu, qrcode.react, recharts, driver.js
- Orphan files removed: hooks/useTour.ts, hooks/useMultiPageTour.ts
  (driver.js consumers — tours/ folder dropped in K4)

False positives kept (depcheck flagged but actually used):
- apps/backend: database (workspace file: link, used via @db alias),
  tsconfig-paths (used in dev script ts-node-dev -r register)
- apps/web: undici (api/proxy stream forwarding), autoprefixer, postcss
  (Tailwind CSS PostCSS config)
- @vitest/coverage-v8 (KEPT in both workspaces — coverage tool for
  remaining 6 unit tests + fazy 4 test rebuild)
- @playwright/test, vitest, testing-library/*, @tailwindcss/typography,
  sharp, geist, lucide-react, react-markdown, @fingerprintjs/fingerprintjs

Verification: npm install (lockfile sync), npm run typecheck exit 0,
npm run build exit 0.

node_modules reduction: ~30-50 MB (cheerio + d3 family from recharts +
pdfkit + dnd-kit + openai SDK + driver.js).

REMAINING TODO post-K5.5:
- Lockfile-level transitive deps audit (low priority, post-cleanup)
- bullmq + ioredis kept for maintenance queue (audit retention,
  user cleanup); drop in faza 4 if BullMQ replaced with Redis pubsub
  or different queue stack
- multer kept for upload.controller.ts (admin blog image upload)
```

---

## §7. CZEKAM NA "ok 5.5 final"

**Decyzje wymagane przed start:**
1. ✅/❌ Drop 15 packages zgodnie z listą 🟢
2. ✅/❌ Drop 8 diet scripts w apps/backend/package.json
3. ✅/❌ Drop 2 orphan hook files (useTour, useMultiPageTour)
4. Q2: Keep `@vitest/coverage-v8` w obu workspaces? (default: KEEP)
5. Q3: Drop wszystkie 8 diet scripts + cross-env? (default: YES)

Po decyzjach wykonuję sequencję bez kolejnego "ok" do Gate 2.
