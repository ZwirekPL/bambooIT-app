/**
 * Tests for product name filtering logic (isExcludedByKeywords patterns).
 * Tests the regex patterns without importing the service (which has DB dependencies).
 * Instead, we replicate the filtering logic to ensure patterns work correctly.
 */
import { describe, it, expect } from 'vitest';

// Replicate the filtering regex patterns from productSelection.service.ts
// to test them in isolation without Prisma/DB dependencies.

function isExcludedByName(name: string): boolean {
  // Portion-format names
  if (/^(garść|łyżeczka|łyżka|kromka|porcja|szklanka|kieliszek|plaster|kawałek|duża|mała|średnia|gałązka|\d+\s)/i.test(name)) {
    return true;
  }

  // Non-Polish product names (USDA auto-translated garbage)
  if (/\b(raw|cooked|braised|grilled|baked|frozen|canned|dried|ready-to-eat|baby|infant|GERBER|QUAKER|agents|Northern|Plains|Indians|crude|defatted|glandless|partially|separable)\b/i.test(name)) {
    return true;
  }

  // Fast food, branded products
  if (/\b(McDonald|Mc\s?Chicken|Mc\s?Nugget|Big\s?Mac|KFC|Burger\s?King|Subway|Pizza\s?Hut|Starbucks|Coca.?Cola|Pepsi|Fanta|Sprite|Red\s?Bull|Monster|Snickers|Mars|Twix|Oreo|Nutella|Lay'?s|Pringles|Doritos|Tiger|Rockstar|Hot\s?Dog|Kebab|Hamburger|Cheeseburger)\b/i.test(name)) {
    return true;
  }

  // Polish branded products
  if (/\b(Serduszko|biszkoptowy|Otrębusie|MixChips|Kardynałki|Mlekovita|Podlaski|Knorr|Abba|Konspol|Tassimo|Nescafe|Milka|Felix|enerBio|enerBIO|Love Las|Cud Miód|Crispy Natural|Danone|Danonek|Bakuś|Actimel|Monte|Fantasia|Danonki|Rolmlecz|Delfiko|Redd's|Dr Pepper)\b/i.test(name)) {
    return true;
  }

  // Non-cooking products
  if (/\b(energetyczn|energy|suplementu?|protein bar|baton\s+(proteinow|energetyczn|zbożow)|wafelk[ia]|ciasteczk[ia]|cukierk[ia]|drage|żelk[ia]|gum[ai]|chipsy?|chrupk[ia]|paluszk[ia]|precl|kraker|nachos|popcorn|ciastk[ia]|herbatnik[ia]|murzynk|pączk[ia]|fawork[ia])\b/i.test(name)) {
    return true;
  }

  // Powder/niche products
  if (/\b(w proszku|proszek|granulat|liofilizowany|liofilizowana|liofilizowane|zagęszczone|zagęszczony|suszone chipsy|suszona.*słodzona)\b/i.test(name)) {
    return true;
  }

  // Niche/exotic oils
  if (/olej z awokado|olej argan|olej rydz|olej z czarnuszk|olej z ostropest|olej carotino|olej z pestek|olej koperk|olej krokosz|olej mak|olej migdał|olej konopn|olej z lniank|olej z nasion|olej z czerwonej|olej ze zbóż|olej kujawsk|oliwa z awokado/i.test(name)) {
    return true;
  }

  // Margarines
  if (/margary/i.test(name)) return true;

  // USDA comma-separated descriptions (3+ parts)
  if ((name.match(/,/g) ?? []).length >= 2) return true;

  // Placeholder names
  if (/\{\{PH_/.test(name)) return true;
  if (/^\d+$/.test(name.trim())) return true;
  if (/^[.!?]$/.test(name.trim())) return true;
  if (name.trim().length < 3) return true;
  if (/\b(2x|3x|4x|5x)\s/i.test(name)) return true;

  // Supplements
  if (/\b(Whey|WPC|Protein\s+(Bar|Shake|Powder|Isolate|Pudding|Matrix))\b/i.test(name)) return true;
  if (/\b(4move|isotoni|izoton|bcaa|creatine|l-karnityn)\b/i.test(name)) return true;

  // English brand names
  if (/\b(KRAFT|HORMEL|Pillsbury|Oscar Mayer|Clif|Velveeta|Pasteurized|Process|Spread|Sliced|Turkey Pepperoni|family size|silk |Smart |Light |Zero |sugar free)\b/i.test(name)) return true;
  if (/\b(extender|grain|isolate|concentrate|malt|puffed|enriched|fortified|flavored|nonfat|lowfat|low-fat|fat-free|whole milk|skim milk|evaporated|condensed|sweetened|unsweetened|instant|powder mix)\b/i.test(name)) return true;

  // USDA parenthetical markers
  if (/\(a\)|\(e\)|\(y\)/.test(name)) return true;
  if (/&\w+;/.test(name)) return true;

  // Very long names
  if (name.length > 50) return true;

  // USDA-translated Polish with awkward modifiers
  if (/\b(prepackaged|deli|luncheon|nisko sól|bez soli dodanej|surowe bez kości|separable lean|ready to cook|ready to eat|pan-fried|stir-fried|deep-fried)\b/i.test(name)) return true;
  // Multi "lub" = bad translation
  if (/\blub\b.*\blub\b/i.test(name)) return true;

  return false;
}

// ─── Good product names (should NOT be excluded) ─────────────────────────────

describe('Product filtering — valid names pass through', () => {
  const validNames = [
    'Pierś z kurczaka',
    'Ryż brązowy',
    'Brokuły',
    'Oliwa z oliwek',
    'Jogurt naturalny',
    'Twaróg chudy',
    'Łosoś atlantycki',
    'Dorsz filet',
    'Kasza gryczana',
    'Makaron pełnoziarnisty',
    'Chleb razowy',
    'Jajko kurze',
    'Masło',
    'Banan',
    'Jabłko',
    'Marchew',
    'Szpinak',
    'Soczewica czerwona',
    'Ciecierzyca',
    'Tofu',
    'Płatki owsiane',
    'Ser żółty gouda',
    'Mleko 2%',
    'Olej rzepakowy',
    'Migdały',
    'Orzechy włoskie',
    'Hummus',
    'Awokado',
  ];

  for (const name of validNames) {
    it(`"${name}" should NOT be excluded`, () => {
      expect(isExcludedByName(name)).toBe(false);
    });
  }
});

// ─── Bad product names (should be excluded) ──────────────────────────────────

describe('Product filtering — USDA garbage excluded', () => {
  const badNames = [
    'Nuts, hazelnuts or filberts, blanched',
    'Nuts, macadamia nuts, dry roasted, without salt added',
    'pierś z indyka, nisko sól, prepackaged lub deli, luncheon mięso',
    'Pork, fresh, loin, whole, separable lean and fat, raw',
    'Chicken, broilers or fryers, breast, skinless, boneless, meat only, cooked, grilled',
    'Beans, kidney, red, mature seeds, canned, solids and liquids',
  ];

  for (const name of badNames) {
    it(`"${name}" should be excluded`, () => {
      expect(isExcludedByName(name)).toBe(true);
    });
  }
});

describe('Product filtering — branded products excluded', () => {
  const brandedNames = [
    'McDonald Big Mac',
    'Coca-Cola',
    'Red Bull',
    'Snickers',
    'Oreo',
    'Nutella',
    'Milka czekolada',
    'Danone jogurt',
    'Actimel truskawkowy',
    'Knorr rosół',
    'KFC kurczak',
    'Pizza Hut pepperoni',
  ];

  for (const name of brandedNames) {
    it(`"${name}" should be excluded`, () => {
      expect(isExcludedByName(name)).toBe(true);
    });
  }
});

describe('Product filtering — junk food excluded', () => {
  const junkNames = [
    'Chipsy ziemniaczane',
    'Cukierki',
    'Ciasteczka',
    'Wafelki',
    'Paluszki',
    'Nachos',
    'Popcorn',
    'Herbatniki',
    'Pączki',
    'Napój energetyczny Tiger',
    'Protein Bar',
    'Whey Protein Shake',
  ];

  for (const name of junkNames) {
    it(`"${name}" should be excluded`, () => {
      expect(isExcludedByName(name)).toBe(true);
    });
  }
});

describe('Product filtering — portion-format names excluded', () => {
  const portionNames = [
    'Garść migdałów',
    'Łyżeczka oleju',
    'Łyżka masła',
    'Kromka chleba',
    'Szklanka mleka',
    'Plaster sera',
    '10 rodzynek',
    '2x Snickers',
  ];

  for (const name of portionNames) {
    it(`"${name}" should be excluded`, () => {
      expect(isExcludedByName(name)).toBe(true);
    });
  }
});

describe('Product filtering — powder/niche products excluded', () => {
  const nicheNames = [
    'Mleko w proszku',
    'Bulion granulat',
    'Jagody liofilizowane',
    'Margaryna',
    'Olej z awokado',
    'Olej arganowy',
    'Olej z czarnuszki',
  ];

  for (const name of nicheNames) {
    it(`"${name}" should be excluded`, () => {
      expect(isExcludedByName(name)).toBe(true);
    });
  }
});

describe('Product filtering — new USDA translation patterns excluded', () => {
  it('excludes "prepackaged" in name', () => {
    expect(isExcludedByName('Indyk prepackaged plastry')).toBe(true);
  });

  it('excludes "deli" in name', () => {
    expect(isExcludedByName('Szynka deli plasterki')).toBe(true);
  });

  it('excludes "luncheon" in name', () => {
    expect(isExcludedByName('Mięso luncheon wieprzowe')).toBe(true);
  });

  it('excludes names with multiple "lub" (bad translation pattern)', () => {
    expect(isExcludedByName('Orzechy laskowe lub filberty lub laskowe blanszowane')).toBe(true);
  });

  it('excludes "nisko sól" pattern', () => {
    expect(isExcludedByName('Pierś z indyka nisko sól')).toBe(true);
  });
});

describe('Product filtering — edge cases', () => {
  it('excludes very short names', () => {
    expect(isExcludedByName('ab')).toBe(true);
    expect(isExcludedByName('')).toBe(true);
  });

  it('excludes numeric-only names', () => {
    expect(isExcludedByName('12345')).toBe(true);
  });

  it('excludes names with HTML entities', () => {
    expect(isExcludedByName('Ser &amp; masło')).toBe(true);
  });

  it('keeps tofu (exception from exotic food filter)', () => {
    expect(isExcludedByName('Tofu')).toBe(false);
    expect(isExcludedByName('Tofu naturalny')).toBe(false);
  });
});
