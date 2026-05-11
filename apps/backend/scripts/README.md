# Backend scripts

Ad-hoc and diagnostic tools. Most require `.env` + running Postgres.

## BUG-3: ingredient data hygiene

Audit trail lives in table `IngredientRepairLog` (see roadmap, commit adding migration).

### Diagnose compound / truncated / list-like ingredient names

```bash
cd apps/backend
npm run diagnose:ingredients
```

Prints top N (default 20) problematic `RecipeIngredient.displayName` per category:

- **spice-lists** — names containing `:` and `>30` chars (e.g. `"przyprawy: sól, pieprz, kurkuma..."`)
- **compound-dishes** — `"X w cieście"` / `"X w sosie"`
- **alternatives** — `"X lub Y"` (mostly handled by canonical mapping)
- **truncated** — ALL-CAPS short names (`"BIAŁA"`)
- **standalone-adjective** — dangling participles (`"Mrożone"`, `"Świeże"`)
- **very-long** — >60 chars without structured prefix
- **colon-prefix categories** — `"orzechy: ..."`, `"sery: ..."`, `"dekoracja: ..."`

Flags:

- `--limit=N` — top N per category (default 20)
- `--csv` — write `apps/backend/scripts/data/compound-ingredients.csv`

```bash
npm run diagnose:ingredients:csv   # writes CSV for review
npm run diagnose:ingredients -- --limit=5
```

### Related: recipe instruction steps

```bash
ts-node -r dotenv/config -r tsconfig-paths/register scripts/generate-recipe-steps.ts --missing
```

Uses GPT-4.1-mini to fill in missing `RecipeInstructionStep`. Currently only 16 of 3 009
recipes are missing steps, so running this is **not needed** — kept as emergency utility.

## Scaling / nutrition

- `fix-servings.ts` — one-off scaler fix (see commit history)
- `fix-servings-heuristic.ts`
- `fix-recipe-categories.ts`
- `recompute-nutrition-snapshots.ts`
- `rematch-ingredients.ts`

## Solver / plan testing

- `benchmark-solver.ts`
- `test-solver-direct.ts`
- `test-solver-quick.ts`
- `fetch-plan.ts` — decrypt + print diet plan JSON for a given plan ID
