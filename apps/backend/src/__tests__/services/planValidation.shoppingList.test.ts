import { describe, it, expect } from 'vitest';
import {
  normalizeIngredientName,
  categorizeIngredient,
  buildCategorizedShoppingList,
} from '../../services/planValidation.service';
import type { PlanContent } from '../../services/planValidation.service';

// ────────────────────────────────────────────────────────────────────────────
// KROK 1: CANONICAL_PRODUCTS — aggregacja duplikatów
// ────────────────────────────────────────────────────────────────────────────

describe('BUG-1 Krok 1: aggregation of duplicates', () => {
  it('sos sojowy: 3 warianty gramatyczne → ten sam aggregation key', () => {
    const a = normalizeIngredientName('sos sojowy 2 łyżki');
    const b = normalizeIngredientName('sos sojowy 3 łyżki');
    const c = normalizeIngredientName('sosu sojowego');
    expect(a.key).toBe(b.key);
    expect(b.key).toBe(c.key);
    expect(a.displayName).toBe('sos sojowy');
  });

  it('sos teriyaki → canonical "sos teriyaki"', () => {
    const n = normalizeIngredientName('Sos teriyaki');
    expect(n.displayName).toBe('sos teriyaki');
  });

  it('szczypiorek: 4 warianty → ten sam key', () => {
    const a = normalizeIngredientName('szczypiorek, surowy');
    const b = normalizeIngredientName('cienko siekanego szczypiorku');
    const c = normalizeIngredientName('garść siekanego szczypiorku');
    const d = normalizeIngredientName('szczypiorek pęczek');
    const keys = new Set([a.key, b.key, c.key, d.key]);
    expect(keys.size).toBe(1);
    expect(a.displayName).toBe('szczypiorek');
  });

  it('musztarda: 3 warianty (dijon/francuska/delikatesowa) → 3 różne display, ale rozpoznane', () => {
    const a = normalizeIngredientName('musztarda dijon');
    const b = normalizeIngredientName('musztarda francuska 2 łyżki');
    const c = normalizeIngredientName('musztardy delikatesowej łagodnej 1 łyżka');
    expect(a.displayName).toBe('musztarda dijon');
    expect(b.displayName).toBe('musztarda francuska');
    expect(c.displayName).toBe('musztarda delikatesowa');
  });

  it('mleczko kokosowe → "mleko kokosowe" (kontekst nabiał → napoje)', () => {
    const n = normalizeIngredientName('Mleczko kokosowe');
    expect(n.displayName).toBe('mleko kokosowe');
  });

  it('bulion warzywny → "bulion warzywny"', () => {
    const n = normalizeIngredientName('Bulion warzywny');
    expect(n.displayName).toBe('bulion warzywny');
  });

  it('olej w dopełniaczu: "oleju" → "olej"', () => {
    const n = normalizeIngredientName('3 łyżki oleju');
    expect(n.displayName).toBe('olej');
  });

  it('masło w dopełniaczu: "masła" → "masło"', () => {
    const n = normalizeIngredientName('odrobina masła');
    expect(n.displayName).toBe('masło');
  });

  it('mleko w dopełniaczu: "mleka" → "mleko"', () => {
    const n = normalizeIngredientName('200 g mleka');
    expect(n.displayName).toBe('mleko');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// KROK 2: extractBaseProduct — size modifiers + kitchen-unit prefixes
// ────────────────────────────────────────────────────────────────────────────

describe('BUG-1 Krok 2: size modifiers and prefixes stripped', () => {
  it('"malutka cebulka" → "cebula"', () => {
    const n = normalizeIngredientName('malutka cebulka');
    expect(n.displayName).toBe('cebula');
  });

  it('"garść siekanego szczypiorku" → "szczypiorek"', () => {
    const n = normalizeIngredientName('garść siekanego szczypiorku');
    expect(n.displayName).toBe('szczypiorek');
  });

  it('"cienko siekanego szczypiorku" → "szczypiorek"', () => {
    const n = normalizeIngredientName('cienko siekanego szczypiorku');
    expect(n.displayName).toBe('szczypiorek');
  });

  it('"świeża bazylia" → "bazylia"', () => {
    const n = normalizeIngredientName('świeża bazylia');
    expect(n.displayName).toBe('bazylia');
  });

  it('"świeże listki bazylii" → "bazylia"', () => {
    const n = normalizeIngredientName('świeże listki bazylii');
    expect(n.displayName).toBe('bazylia');
  });

  it('"szczypta suszonych płatków chili" → "chili"', () => {
    const n = normalizeIngredientName('szczypta suszonych płatków chili');
    expect(n.displayName).toBe('chili');
  });

  it('"pęczek natki pietruszki" → "pietruszka" (natka pietruszki canonical)', () => {
    const n = normalizeIngredientName('pęczek natki pietruszki');
    // existing canonical: natka pietruszki pattern
    expect(n.displayName).toBe('natka pietruszki');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// KROK 3: categorizeIngredient — priority patterns + correct categorization
// ────────────────────────────────────────────────────────────────────────────

describe('BUG-1 Krok 3: categorization fixes', () => {
  // Białko
  it('Golonka → Białko', () => expect(categorizeIngredient('Golonka')).toBe('Białko'));
  it('Rosół → Białko', () => expect(categorizeIngredient('Rosół')).toBe('Białko'));
  it('Polędwiczka wieprzowa wędzona → Białko', () =>
    expect(categorizeIngredient('Polędwiczka wieprzowa wędzona')).toBe('Białko'));

  // Warzywa — word-boundary + new keywords
  it('Por → Warzywa (word boundary, not "Poranna")', () =>
    expect(categorizeIngredient('Por')).toBe('Warzywa'));
  it('Bób → Warzywa', () => expect(categorizeIngredient('Bób')).toBe('Warzywa'));
  it('Kalarepa → Warzywa', () => expect(categorizeIngredient('Kalarepa')).toBe('Warzywa'));
  it('Zielone szparagi → Warzywa', () =>
    expect(categorizeIngredient('Zielone szparagi')).toBe('Warzywa'));
  it('Grzyby shimeji → Warzywa', () =>
    expect(categorizeIngredient('Grzyby shimeji')).toBe('Warzywa'));
  it('Pieczarki → Warzywa', () =>
    expect(categorizeIngredient('Pieczarki')).toBe('Warzywa'));

  // Produkty zbożowe
  it('Ciasto francuskie → Produkty zbożowe', () =>
    expect(categorizeIngredient('Ciasto francuskie')).toBe('Produkty zbożowe'));
  it('Bułeczka mleczna → Produkty zbożowe', () =>
    expect(categorizeIngredient('Bułeczka mleczna')).toBe('Produkty zbożowe'));
  it('Bagietka → Produkty zbożowe', () =>
    expect(categorizeIngredient('Bagietka')).toBe('Produkty zbożowe'));

  // Przyprawy — cytrus juice (musi przebić Owoce bo zawiera "cytryn"/"limonk")
  it('sok z cytryny → Przyprawy i inne (nie Owoce!)', () =>
    expect(categorizeIngredient('sok z cytryny')).toBe('Przyprawy i inne'));
  it('sok z limonki → Przyprawy i inne', () =>
    expect(categorizeIngredient('sok z limonki')).toBe('Przyprawy i inne'));
  it('ocet jabłkowy → Przyprawy i inne', () =>
    expect(categorizeIngredient('ocet jabłkowy')).toBe('Przyprawy i inne'));

  // Regressji: istniejące kategorie nadal działają
  it('Kurczak → Białko (regresja)', () =>
    expect(categorizeIngredient('Pierś kurczaka')).toBe('Białko'));
  it('Jogurt naturalny → Nabiał (regresja)', () =>
    expect(categorizeIngredient('jogurt naturalny')).toBe('Nabiał'));
  it('Makaron spaghetti → Produkty zbożowe (regresja)', () =>
    expect(categorizeIngredient('makaron spaghetti')).toBe('Produkty zbożowe'));
  it('Banan → Owoce (regresja)', () =>
    expect(categorizeIngredient('banan')).toBe('Owoce'));

  // Variants without Polish diacritics (Rosól, missing ł)
  it('Rosól (bez ł) → Białko', () =>
    expect(categorizeIngredient('Rosól')).toBe('Białko'));
  it('Rosol (bez ó i ł) → Białko', () =>
    expect(categorizeIngredient('Rosol')).toBe('Białko'));

  // Strączkowe → Warzywa
  it('Ciecierzyca → Warzywa', () =>
    expect(categorizeIngredient('Ciecierzyca')).toBe('Warzywa'));

  // Bulion → Przetwory
  it('Bulion warzywny → Przetwory i konserwy', () =>
    expect(categorizeIngredient('bulion warzywny')).toBe('Przetwory i konserwy'));

  // Napój roślinny owsiany — nie może trafić do Produktów zbożowych (bo "owsian" keyword)
  it('Napój roślinny owsiany → Napoje (priority przed "owsian" keyword)', () =>
    expect(categorizeIngredient('Napój roślinny owsiany')).toBe('Napoje'));
  it('Mleko owsiane → Napoje', () =>
    expect(categorizeIngredient('Mleko owsiane')).toBe('Napoje'));
  it('Napój sojowy → Napoje', () =>
    expect(categorizeIngredient('Napój sojowy')).toBe('Napoje'));

  // Mixed dried fruits
  it('"Miksu suszone owoce" → canonical "mieszanka suszonych owoców"', () => {
    const n = normalizeIngredientName('Miksu suszone owoce');
    expect(n.displayName).toBe('mieszanka suszonych owoców');
  });
  it('"miks suszonych owoców" → canonical', () => {
    const n = normalizeIngredientName('miks suszonych owoców');
    expect(n.displayName).toBe('mieszanka suszonych owoców');
  });

  // Unit-word prefix without number: "łyżeczka słodkiej papryki"
  it('"łyżeczka słodkiej papryki" → "papryka słodka"', () => {
    const n = normalizeIngredientName('łyżeczka słodkiej papryki');
    expect(n.displayName).toBe('papryka słodka');
  });
  it('"łyżka oliwy" → "oliwa z oliwek"', () => {
    const n = normalizeIngredientName('łyżka oliwy');
    expect(n.displayName).toBe('oliwa z oliwek');
  });

  // Standalone participle adjective (dangling descriptor after import)
  it('"Mrożone" (sam adjective) → skip', () => {
    const plan: PlanContent = {
      days: [{ day: 'Pon', meals: [{ name: 'X', items: [{
        name: 'X', grams: 100, kcal: 200, protein: 10, fat: 5, carbs: 20,
        ingredients: [
          { name: 'Groszek zielony', grams: 50 },
          { name: 'Mrożone', grams: 100 },
        ]
      }] }] }],
    };
    const names = buildCategorizedShoppingList(plan).flatMap(c => c.items.map(i => i.name));
    expect(names).toContain('Groszek zielony');
    expect(names).not.toContain('Mrożone');
  });

  // Meat products in PRZYPRAWY → should go to Białko
  it('Kabanos z halibuta → Białko', () =>
    expect(categorizeIngredient('Kabanos z halibuta')).toBe('Białko'));
  it('Parówka drobiowa → Białko', () =>
    expect(categorizeIngredient('Parówka drobiowa')).toBe('Białko'));

  // Papryka słodka/ostra = PRZYPRAWA, nie warzywo
  it('papryka słodka → Przyprawy i inne (nie Warzywa)', () =>
    expect(categorizeIngredient('papryka słodka')).toBe('Przyprawy i inne'));
  it('słodka papryka → Przyprawy i inne', () =>
    expect(categorizeIngredient('słodka papryka')).toBe('Przyprawy i inne'));
  it('papryka ostra → Przyprawy i inne', () =>
    expect(categorizeIngredient('papryka ostra')).toBe('Przyprawy i inne'));
  it('papryka wędzona → Przyprawy i inne', () =>
    expect(categorizeIngredient('papryka wędzona')).toBe('Przyprawy i inne'));
  // Regresja: świeża papryka (warzywo) nadal w Warzywa
  it('Papryka czerwona → Warzywa (regresja)', () =>
    expect(categorizeIngredient('Papryka czerwona')).toBe('Warzywa'));

  // Porzeczki → Owoce
  it('Porzeczki czerwone → Owoce', () =>
    expect(categorizeIngredient('Porzeczki czerwone')).toBe('Owoce'));

  // Full pipeline: "mrożone porzeczki..." → skip "mrożone" prefix → "porzeczki czerwone" w Owocach
  it('"mrożone porzeczki czerwone - całe kulki" → canonical+category', () => {
    const n = normalizeIngredientName('mrożone porzeczki czerwone - całe kulki');
    expect(n.displayName.toLowerCase()).toContain('porzeczk');
    expect(n.displayName.toLowerCase()).not.toContain('mrożon');
    expect(categorizeIngredient(n.displayName)).toBe('Owoce');
  });

  // Full pipeline: "1 łyżeczka słodkiej papryki" → canonical "papryka słodka" → Przyprawy
  it('"1 łyżeczka słodkiej papryki" → "papryka słodka" w Przyprawy', () => {
    const n = normalizeIngredientName('1 łyżeczka słodkiej papryki');
    expect(n.displayName).toBe('papryka słodka');
    expect(categorizeIngredient(n.displayName)).toBe('Przyprawy i inne');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// BUG-6: TASTE_ONLY + MIN_PURCHASE_PORTION
// ────────────────────────────────────────────────────────────────────────────

describe('BUG-6: taste-only seasonings and min purchase portion', () => {
  const mkPlanWith = (ingredients: Array<{ name: string; grams: number }>): PlanContent => ({
    days: [{
      day: 'Poniedziałek',
      meals: [{
        name: 'Śniadanie',
        items: [{
          name: 'Potrawa', grams: 100, kcal: 200, protein: 10, fat: 5, carbs: 20,
          ingredients,
        }],
      }],
    }],
  });

  const findItem = (plan: PlanContent, namePart: string) =>
    buildCategorizedShoppingList(plan)
      .flatMap(c => c.items)
      .find(i => i.name.toLowerCase().includes(namePart.toLowerCase()));

  // Taste-only items pass through even with 0g
  it('sól z 0g pojawia się na liście z flagą tasteOnly', () => {
    const plan = mkPlanWith([
      { name: 'Mąka', grams: 100 },
      { name: 'Sól', grams: 0 },
    ]);
    const it = findItem(plan, 'sól');
    expect(it).toBeDefined();
    expect(it?.tasteOnly).toBe(true);
  });

  it('pieprz i cynamon z 0g → tasteOnly', () => {
    const plan = mkPlanWith([
      { name: 'Pieprz', grams: 0 },
      { name: 'Cynamon', grams: 0 },
      { name: 'Mąka', grams: 100 },
    ]);
    expect(findItem(plan, 'pieprz')?.tasteOnly).toBe(true);
    expect(findItem(plan, 'cynamon')?.tasteOnly).toBe(true);
  });

  it('papryka słodka jest tasteOnly mimo nazwy "papryka"', () => {
    const plan = mkPlanWith([
      { name: '1 łyżeczka słodkiej papryki', grams: 2 },
    ]);
    const it = findItem(plan, 'papryka słodka');
    expect(it?.tasteOnly).toBe(true);
  });

  // Normal ingredients with 0g still skipped
  it('normalne produkty z 0g nadal pomijane', () => {
    const plan = mkPlanWith([
      { name: 'Mąka', grams: 100 },
      { name: 'Masło', grams: 0 },  // normal product, not taste-only
    ]);
    const it = findItem(plan, 'masło');
    expect(it).toBeUndefined();
  });

  // MIN_PURCHASE_PORTION
  it('rukola 1g → zaokrąglona do 50g (worek)', () => {
    const plan = mkPlanWith([{ name: 'Rukola', grams: 1 }]);
    const it = findItem(plan, 'rukola');
    expect(it?.totalGrams).toBe(50);
  });

  it('natka pietruszki 2g → min 30g (pęczek)', () => {
    const plan = mkPlanWith([{ name: 'natka pietruszki', grams: 2 }]);
    const it = findItem(plan, 'natka pietruszki');
    expect(it?.totalGrams).toBe(30);
  });

  it('konfitura z jagód 8g → min 250g (słoik)', () => {
    const plan = mkPlanWith([{ name: 'Konfitura z Jagód', grams: 8 }]);
    const it = findItem(plan, 'konfitur');
    expect(it?.totalGrams).toBe(250);
  });

  it('cytryna 14g → min 120g (1 szt)', () => {
    const plan = mkPlanWith([{ name: 'cytryna', grams: 14 }]);
    const it = findItem(plan, 'cytryna');
    expect(it?.totalGrams).toBe(120);
  });

  it('parmezan 7g → min 50g', () => {
    const plan = mkPlanWith([{ name: 'parmezan', grams: 7 }]);
    const it = findItem(plan, 'parmezan');
    expect(it?.totalGrams).toBe(50);
  });

  it('duża ilość rukoli (np. 200g) NIE jest zaokrąglana w dół', () => {
    const plan = mkPlanWith([{ name: 'Rukola', grams: 200 }]);
    const it = findItem(plan, 'rukola');
    expect(it?.totalGrams).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// KROK 4+5: buildCategorizedShoppingList — filter junk names & zero grams
// ────────────────────────────────────────────────────────────────────────────

describe('BUG-1 Krok 4+5: junk filter and zero-grams filter in shopping list', () => {
  const mkPlan = (ingredients: Array<{ name: string; grams: number }>): PlanContent => ({
    days: [
      {
        day: 'Poniedziałek',
        meals: [
          {
            name: 'Śniadanie',
            items: [
              {
                name: 'Potrawa', grams: 100, kcal: 200, protein: 10, fat: 5, carbs: 20,
                ingredients,
              },
            ],
          },
        ],
      },
    ],
  });

  const getAllItems = (plan: PlanContent) =>
    buildCategorizedShoppingList(plan).flatMap(cat => cat.items.map(i => i.name));

  it('pomija ingredient z grams=0', () => {
    const plan = mkPlan([
      { name: 'Mąka pszenna', grams: 100 },
      { name: 'Koperek', grams: 0 },
    ]);
    const names = getAllItems(plan);
    expect(names).toContain('mąka pszenna');
    expect(names).not.toContain('koperek');
  });

  it('pomija pełne zdanie z przepisu (>30 char, zawiera ":" lub ";")', () => {
    const plan = mkPlan([
      { name: 'Mąka', grams: 50 },
      { name: 'zioła i przyprawy: po szczypcie soli i pieprzu;', grams: 1 },
    ]);
    const names = getAllItems(plan);
    expect(names).toContain('mąka pszenna');
    for (const n of names) {
      expect(n).not.toMatch(/zioła i przyprawy/i);
    }
  });

  it('pomija wpis z >5 słowami i bez canonical match', () => {
    const plan = mkPlan([
      { name: 'Ryż', grams: 80 },
      { name: 'proszek do pieczenia i soda oczyszczona po pół płaskiej łyżeczki', grams: 1 },
    ]);
    const names = getAllItems(plan);
    expect(names).toContain('ryż');
    // "proszek do pieczenia" canonical powinien złapać ten wpis i zredukować do "proszek do pieczenia"
    // — NIE jest to śmieć bo ma canonical match
    expect(names).toContain('proszek do pieczenia');
  });

  it('NIE pomija wpisu z canonical match, mimo długiej pierwotnej nazwy', () => {
    const plan = mkPlan([
      { name: '3 łyżki oleju lub roztopionego masła - około 30 g', grams: 30 },
    ]);
    const names = getAllItems(plan);
    // extractBaseProduct + canonical powinien to sprowadzić do "olej"
    expect(names).toContain('olej');
  });

  it('filtruje "pieprz 1/3 łyżeczki" (brak canonical, śmieć)', () => {
    const plan = mkPlan([
      { name: 'Mleko', grams: 200 },
      { name: 'pieprz 1/3 łyżeczki', grams: 0 },  // zero grams → Krok 5 filter
    ]);
    const names = getAllItems(plan);
    expect(names).toContain('mleko');
    expect(names).not.toContain('pieprz 1/3 łyżeczki');
  });

  // Krok 6: BIALA — ALL-CAPS short name = data corruption, skip
  it('filtruje "BIAŁA" (ALL-CAPS krótka nazwa — uszkodzone dane)', () => {
    const plan = mkPlan([
      { name: 'Jogurt naturalny', grams: 150 },
      { name: 'BIAŁA', grams: 52 },
    ]);
    const names = getAllItems(plan);
    expect(names).toContain('jogurt naturalny');
    expect(names).not.toContain('BIAŁA');
    expect(names).not.toContain('biała');
  });
});
