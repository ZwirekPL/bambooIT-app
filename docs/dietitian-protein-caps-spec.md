# Protein-Source Weekly Caps & Minimums — Dietitian Spec

**Status:** Approved 2026-04-29 (Recipe Overhaul Master Plan, Partia 1)
**Audience:** Dietitians, solver maintainers, anyone touching `recipeCandidate` /
`weekSolver` / planning constraints.
**Scope:** A 7-day plan's distribution of recipes by protein source category,
driven by the patient's `preferredFoods` interview answers and the eight
canonical protein buckets enforced inside the solver.

---

## Why caps + minimums + decay (not a hard filter)

`preferredFoods` was previously decorative — the interview captured it but no
constraint or scoring path consumed the signal. Adding caps as **HARD**
filters would routinely render plans infeasible (e.g. patient who picks only
`fish` + `legumes` cannot fill 7 × 3 main-meal slots from a small pool).
Instead we apply three coordinated soft levers (master plan §SC30):

1. **PROTEIN_WEEKLY_CAPS** — soft penalty when a category exceeds a clinical
   ceiling. The solver still has the option to violate the cap if no
   alternative is feasible; cost-of-violation reflects clinical risk
   (red-meat cap is harsher than poultry cap).
2. **PREFERRED_BONUS_DECAY** — per-occurrence bonus that *decays* over the
   week. Patient-preferred categories earn `+200` on the first hit, `+100`
   second, `+50` third, then `0` — so we reward variety within preferences
   without flooding the plan with the same item.
3. **PROTEIN_WEEKLY_MINS** — soft floor for clinically valuable categories
   (legumes, fish-total) so omnivores still hit fibre and ω-3 targets.

A small auto-relax kicks in when the candidate pool is tight (`pool_size < 30`
after dietary/allergen filters): caps × 1.5, decay bonuses × 0.5. This stops
restrictive diets (vegan + indyjska + diabetic) from infeasibility while
keeping clinical tilt in normal-pool cases.

---

## Eight canonical protein buckets

The solver expects every protein-bearing recipe to map to **one** of these
buckets via `proteinSourceCanonicalMap(cleanProductId | ingredientName)`:

| Bucket | Examples (PL / EN) | Rationale |
|---|---|---|
| `fish_fatty` | łosoś, makrela, śledź, sardynki, tuńczyk (świeży/mrożony) | EPA/DHA-rich; PTNF: 2–3×/week therapeutic. Mercury cap (see `fish_total`). |
| `fish_white` | dorsz, mintaj, halibut, sandacz, morszczuk, pstrąg | Lean protein, low-mercury; safer for heavier weekly intake. |
| `seafood` | krewetki, małże, ostrygi, kalmary, krab, homar | High purine (gout); high cholesterol shellfish; allergen-heavy. |
| `poultry` | kurczak, indyk, kaczka, gęś, drób-skrzydła/udka | Lean-protein default for omnivores. |
| `red_meat` | wołowina, wieprzowina, jagnięcina, baranina, dziczyzna, podroby | WHO IARC group 2A (carcinogenic); WCRF cap ≤350 g/week cooked = ≈2 main-meal portions. |
| `eggs` | jajko (każdy stan), żółtko, białko | Cholesterol context; multi-condition flexible. |
| `legumes` | ciecierzyca, soczewica (czerwona/zielona/czarna), fasola, groch, bób, edamame | Fibre / folate / iron; minimum-floor target. |
| `tofu` | tofu, tempeh, seitan, soja teksturowana | Plant-protein category, distinct from legumes (different macro/iso profile). |

Notes:
- **`dairy`, `nuts/seeds`, `grains`, `vegetables`** — not protein-bucket'd.
  They appear elsewhere (RecipeDietFlag, allergen, ingredient signals) but
  not under SC30 caps.
- **Mixed dishes** (e.g. *kurczak z fasolą*): the canonical bucket is the
  argmax-protein-contribution category from the existing `proteinSource.ts`
  classifier, then projected onto these 8 buckets:
  * `proteinSource: poultry` → `poultry`
  * `proteinSource: beef` / `pork` / `lamb` → `red_meat`
  * `proteinSource: fish` → split into `fish_fatty` vs `fish_white` via
    cleanProductId / name (see `FATTY_FISH_NAMES` set)
  * `proteinSource: seafood` → `seafood`
  * `proteinSource: egg` → `eggs`
  * `proteinSource: legume` → `legumes`
  * `proteinSource: tofu` → `tofu`
  * `proteinSource: dairy` / `nuts` / `grain` / `vegetable` / `other` → null
    (no bucket; not subject to SC30)

---

## Weekly caps (soft, per 7-day plan)

| Bucket | Cap (servings/week) | Penalty per overage | Why |
|---|---|---|---|
| `fish_fatty` | 3 | -200 | Mercury-vs-EPA balance. AHA: 2 servings of fatty fish/week therapeutic; cap at 3 leaves room for high-EPA need (cardio, IBD, mood) without methylmercury risk in pregnancy / fertility patients. |
| `fish_white` | 3 | -150 | Lean ω-3 source, minimal methylmercury — softer cap than fatty. |
| `fish_total` | 4 (Σ fatty + white) | -250 | EFSA combined fish guidance; max 4 main-meal protein slots from any fish to leave variety for legumes/poultry. |
| `seafood` | 1 | -300 | High purine + cholesterol + allergen risk. One serving/week is treat-tier. |
| `red_meat` | 2 | -400 | WCRF: ≤350 g/wk cooked = ~2 main meals. Tighter than fish caps because IARC 2A. |
| `poultry` | 4 | -100 | Default omnivore protein — light cap to enforce variety, not avoidance. |
| `eggs` | 7 | -100 | One egg/day baseline; cap discourages cholesterol-driven over-use as primary protein. |
| `tofu_tempeh` | 4 | -50 | Light cap — encourage variety with legumes for plant-protein patients. |
| `legumes` | None | n/a | No upper cap. Fibre/folate / iron value — encouraged. |

The penalties above are SCORE-units (same scale as existing solver
constraints). Sum of all SC30 penalties caps at -1500 per plan to stop a
single bucket from dominating the objective.

### Combined caps (Σ-rules)

- `red_meat + pork ≤ 2/week` — already implicit in `red_meat` bucket
  (pork is folded into `red_meat`).
- `fish_fatty + fish_white ≤ 4/week` — explicit `fish_total` cap above.

---

## Weekly minimums (soft floor)

| Bucket | Min (servings/week) | Penalty per shortfall | Applies when |
|---|---|---|---|
| `legumes` | 2 | -150 | Always (vegans, omnivores, vegetarians). |
| `fish_total` | 1 | -100 | Omnivores only (skipped when `dietType ∈ {vegan, vegetarian}`). |

Vegans/vegetarians legitimately have zero fish; omitting the floor avoids
a permanent -100 against their plan.

---

## Preferred-bonus decay (per-week aggregation)

When `cuisinePreferences[bucket]` evaluates true (patient picked a category
in `preferredFoods`), each occurrence in the week earns a decreasing bonus:

```
PREFERRED_BONUS_DECAY = [200, 100, 50, 0, 0, 0, 0]   # per-week index 0..6
```

The 1st occurrence in the week scores +200, the 2nd +100, the 3rd +50, the
4th and beyond add nothing. This rewards "patient gets what they like" up
to a sane variety threshold, then stops nudging.

The decay is **per bucket**, so a patient who picks both `fish` and
`legumes` and gets two of each on the week earns
`(200 + 100) + (200 + 100) = 600`. Independent buckets accumulate.

`preferredFoods` codes (interview EN) project onto canonical buckets via
`mapPreferredFoodsToCanonical()` (see [P1.2 mapping](#p12-interview-codes--canonical-buckets)).

---

## Auto-relax for tight pools

When the post-filter candidate pool for a week falls below `pool_size < 30`,
the solver applies:

| Lever | Multiplier |
|---|---|
| `PROTEIN_WEEKLY_CAPS` | × 1.5 (caps grow, fewer recipes get penalized) |
| `PREFERRED_BONUS_DECAY` | × 0.5 (smaller bonuses; decay flattens) |
| `PROTEIN_WEEKLY_MINS` | unchanged (clinical floors stay enforced) |

Triggers: vegan + indyjska + diabetic + low-budget combinations where the
default 30-recipe pool target is unreachable. Without auto-relax these go
INFEASIBLE; with it, plans degrade gracefully (solver picks the best of a
small bag instead of crashing).

The `30` threshold matches Faza-D's typical pool size after HC2 (allergen) +
HC5 (mealType) + HC6 (cuisine) gating; below it, scoring resolution drops
materially because every candidate is desired.

---

## Vegan / vegetarian guard

`preferredFoods` from the interview can carry contradictory entries — e.g.
patient self-reported `dietType=vegan` but ticked `chicken` in
`preferredFoods` (form drift, multi-step navigation, accidental clicks).

The backend `mapPreferredFoodsToKeywords()` (see [P1.2](#p12-interview-codes--canonical-buckets))
filters incompatible codes **before** they reach the solver:

| `dietType` | Allowed `preferredFoods` codes |
|---|---|
| `vegan` | `legumes`, `tofu_tempeh`, `nuts_seeds`, `rice_groats`, `pasta`, `potatoes`, `bread`, `oatmeal`, `salads_raw`, `cooked_veg`, `fruits`, `smoothies`, `soups` |
| `vegetarian` | vegan list **+** `eggs`, `dairy` |
| `pescatarian` | vegetarian list **+** `fish`, `seafood` |
| anything else (omnivore default) | all 19 codes |

Filtered codes are still surfaced in `AuditLog` (`PREFERRED_FOODS_FILTERED`)
so dietitians can see the patient ticked something incompatible — useful for
a follow-up clarification message rather than silent ignore.

---

## P1.2 — interview codes ↔ canonical buckets

`preferredFoods` form codes (19) project onto the 8 canonical buckets:

| Interview code | Canonical bucket(s) | Notes |
|---|---|---|
| `poultry` | `poultry` | direct |
| `beef_pork` | `red_meat` | combined bucket |
| `fish` | `fish_fatty` + `fish_white` | both fish buckets — patient doesn't distinguish |
| `seafood` | `seafood` | direct |
| `eggs` | `eggs` | direct |
| `legumes` | `legumes` | direct |
| `tofu_tempeh` | `tofu` | direct |
| `dairy` | (none) | dairy is not a SC30 protein bucket; only ingestion of dairy-rich recipes (twaróg main, sernik etc.) is influenced via existing scoring paths |
| `nuts_seeds` | (none) | snack-tier, not a protein-cap bucket |
| `rice_groats`, `pasta`, `potatoes`, `bread`, `oatmeal` | (none) | carbohydrate-side preferences; consumed by other scoring paths |
| `salads_raw`, `cooked_veg`, `fruits` | (none) | vegetable preferences; consumed by `bogate-w-warzywa` tag bonus |
| `smoothies`, `soups` | (none) | dish-style, no protein cap impact |

The mapper additionally emits **lexical keywords** that join the existing
`excludeKeywords` / disliked-foods keyword search — but with a positive sign.
This gives a per-recipe lexical bonus on top of the per-bucket SC30 decay
when the recipe matches a preferred ingredient in title or tags.

---

## Sign-off requirements before merge

Per master plan §0.7 / §1.11:

1. **Validation report** (`scripts/validate-recipe-tags.ts`) PASS — already
   green after Partia 0.
2. **Gold-standard fixtures** (existing 11 + 4 new — `fish_lover`,
   `vegan_legume_lover`, `red_meat_lover`, `pregnant_fish_avoider`) all
   FEASIBLE under the new constraints.
3. **Owner sign-off** on:
   - the eight buckets and their split definitions (this doc),
   - the cap / minimum / decay numeric values (this doc),
   - the gold-standard re-snapshots (next session).
