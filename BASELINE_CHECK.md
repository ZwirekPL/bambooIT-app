# BASELINE_CHECK.md — KROK 0

**Data:** 2026-05-11
**Status:** ✅ ZIELONY — baseline gotowy do KROK 1

---

## 1. Rollback target

- **Tag:** `baseline-before-cleanup`
- **Commit:** `6741ccc docs: add PLAN_CZYSZCZENIA.md — cleanup roadmap from DietetykDEV to bambooIT`
- **Branch:** `main` (tracking `origin/main`, clean przed startem)

Powrót do baseline:
```bash
git reset --hard baseline-before-cleanup
```

---

## 2. Niezgodność z instrukcjami (rozstrzygnięta przed startem)

Twoje instrukcje używały `pnpm`, ale repo jest na **npm workspaces** (`package-lock.json`, `workspaces` w root `package.json`, brak `pnpm-lock.yaml`). Ustaliliśmy w pytaniach pre-flight:

- Zostajemy na **npm**
- Dodaję root scripts `typecheck` + `build` (pre-flight decision)
- Mapowanie `pnpm install` → `npm install`, `pnpm typecheck` → `npm run typecheck`, `pnpm build` → `npm run build`

---

## 3. Zmiany w workdir wprowadzone podczas KROK 0

Niecommitowane (czekam na "ok krok 1" → wtedy commit razem ze startem):

### `package.json` (root) — dodane skrypty
```diff
+ "typecheck": "npm run generate --workspace=database && npm run build --workspace=database && npm run build --workspace=backend && npm run type-check --workspace=web",
+ "build": "npm run generate --workspace=database && npm run build --workspace=database && npm run build --workspace=backend && npm run build --workspace=web",
```

**Uzasadnienie kolejności:**
1. `database: generate` — generuje `@prisma/client` types (bez tego TS nie widzi enums)
2. `database: build` — kompiluje `packages/database/dist/` (backend importuje przez `@db` → `dist/index`)
3. `backend: build` — `tsc` (wymaga dist `@db`)
4. `web: build` / `web: type-check` — Next.js / `tsc --noEmit`

### `BASELINE_CHECK.md` (ten plik)
### `TYPECHECK_BASELINE.log`, `BUILD_BASELINE.log` (artefakty)

---

## 4. Wyniki sanity check

| Krok | Komenda | Wynik | Czas | Log |
|---|---|---|---|---|
| 4.1 | `npm install` | ✅ 950 packages added | ~55s | inline w tej sekcji |
| 4.2 | `npm run generate --workspace=database` | ✅ Generated Prisma Client v6.19.2 | <1s | — |
| 4.3 | `npm run typecheck` (root) | ✅ EXIT 0 | ~kilkadziesiąt s | `TYPECHECK_BASELINE.log` (41 linii) |
| 4.4 | `npm run build` (root) | ✅ EXIT 0 | ~kilkadziesiąt s | `BUILD_BASELINE.log` (145 linii) |

### 4.1 `npm install` — uwagi

- **Deprecated transitive deps** (info, nie blocker): `inflight@1.0.6`, `rimraf@2.7.1`, `string-similarity@4.0.4`, `glob@7.2.3`, `whatwg-encoding@3.1.1`, `jpeg-exif@1.1.4`
- **Vulnerabilities:** 17 total (8 moderate, 9 high) — do późniejszego `npm audit fix` w osobnej fazie czyszczenia
- Workspaces zlinkowane: `database`, `backend`, `web`

### 4.2 Prisma generate — uwaga

Przy pierwszym uruchomieniu typecheck wysypał się na `error TS2305: Module '"@prisma/client"' has no exported member 'DayRegenReason'` — dlatego że świeży klon nie miał wygenerowanego klienta. **Naprawione poprzez dodanie `generate` na początku skryptu `typecheck`** — od teraz `npm run typecheck` jest idempotentny po świeżym `npm install`.

Drobne ostrzeżenie z Prismy:
> `The configuration property package.json#prisma is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., prisma.config.ts).`
→ Do osobnego ticketa, nieblokujące.

### 4.3 Typecheck (root)
- `database` (`tsc -p tsconfig.json`) → 0 errors
- `backend` (`tsc`) → 0 errors
- `web` (`tsc --noEmit`) → 0 errors

### 4.4 Build (root)
- `database` → emit do `packages/database/dist/`
- `backend` → emit do `apps/backend/dist/`
- `web` → Next.js production build, wszystkie route'y diet-stack zbudowane (ale to docelowo do usunięcia w krokach 2g i 5)

---

## 5. Lista routes z `web build` — preview tego co spada w krokach 2f/2g

(Z `BUILD_BASELINE.log`, dla orientacji jak duża chirurgia czeka frontend.)

Route'y diet-stack w aktualnym `web` build:
- `/[locale]/dashboard/*` (cały panel pacjenta)
- `/[locale]/dietetyk/*` (cały panel dietetyka)
- `/[locale]/onboarding/*`
- `/[locale]/oferta/*` (do rebuild → `/pakiety`)
- `/[locale]/slownik`, `/[locale]/faq`, `/[locale]/jak-to-dziala`, `/[locale]/o-nas`, `/[locale]/konsultacja`
- `/[locale]/admin/*` (część zostaje wg §2f — analiza w kroku osobnym)
- `/[locale]/blog/[slug]` (szkielet zostaje wg twojej decyzji §5.3)

Route'y które **zostają** (auth/legal/checkout):
- `/[locale]/zaloguj`, `/rejestracja`, `/resetuj-haslo`, `/zapomnialem-hasla`, `/zweryfikuj-email`
- `/[locale]/dokumenty-prawne/*`
- `/[locale]/zamow`, `/zamowienie/sukces`, `/zamowienie/anulowano`
- `/api/auth/[...nextauth]`, `/api/proxy/[...path]`
- `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/opengraph-image`

---

## 6. Co dalej

Czekam na **"ok krok 1"** żeby ruszyć z:

> **chore(cleanup): remove apps/solver + data + diet docs** (już częściowo zrobione)

Plan szczegółowy KROK 1 (proponowany, do zatwierdzenia razem z "ok krok 1"):
1. `apps/solver/` — sprawdzić czy nadal istnieje (PLAN_CZYSZCZENIA mówi że już usunięty)
2. `data/` (281 MB) — **najpierw `Glob/Grep` na obecność skryptów backupowych**, jeśli są → wyciągnięcie do `scripts/backup/`, potem `rm -rf data/`
3. Diet docs (`docs/clinical-rules.md`, `dietitian-protein-caps-spec.md`, etc. — pełna lista z §2j)
4. `PRD-DietetykDEV.md` (root)
5. Po kroku: `npm run typecheck` → `TYPECHECK_STEP_1.log`
6. Commit `chore(cleanup): remove apps/solver + data + diet docs`

**Sygnał błędu (dla wszystkich kroków):** jeśli typecheck/build sypie z powodu innego niż "Cannot find module X" gdzie X to świeżo usunięty diet kod → STOP i raport.
