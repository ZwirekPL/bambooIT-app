import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';

import {
  parseIsoDuration,
  parseYield,
  parseImage,
  parseRating,
  parseInstructions,
  parseNutrition,
  extractRecipeJsonLd,
  parseRecipeJsonLd,
  extractAndParseRecipe,
} from '../../scraper/utils/jsonLd';

// ─── parseIsoDuration ───────────────────────────────────────────────────────────

describe('parseIsoDuration', () => {
  it('parses ISO 8601 PT30M → 30', () => {
    expect(parseIsoDuration('PT30M')).toBe(30);
  });
  it('parses PT1H30M → 90', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(90);
  });
  it('parses PT2H → 120', () => {
    expect(parseIsoDuration('PT2H')).toBe(120);
  });
  it('parses "30M" without PT prefix (jadlonomia quirk) → 30', () => {
    expect(parseIsoDuration('30M')).toBe(30);
  });
  it('parses "1H30M" without PT prefix → 90', () => {
    expect(parseIsoDuration('1H30M')).toBe(90);
  });
  it('parses Polish "1 godz. 30 min" → 90', () => {
    expect(parseIsoDuration('1 godz. 30 min')).toBe(90);
  });
  it('parses Polish "30 minut" → 30', () => {
    expect(parseIsoDuration('30 minut')).toBe(30);
  });
  it('parses Polish "2 godziny" → 120', () => {
    expect(parseIsoDuration('2 godziny')).toBe(120);
  });
  it('parses bare number "45" → 45 (interpreted as minutes)', () => {
    expect(parseIsoDuration('45')).toBe(45);
  });
  it('accepts numeric input 30 → 30', () => {
    expect(parseIsoDuration(30)).toBe(30);
  });
  it('returns undefined for PT0M', () => {
    expect(parseIsoDuration('PT0M')).toBeUndefined();
  });
  it('returns undefined for "0M"', () => {
    expect(parseIsoDuration('0M')).toBeUndefined();
  });
  it('returns undefined for empty string', () => {
    expect(parseIsoDuration('')).toBeUndefined();
  });
  it('returns undefined for null/undefined', () => {
    expect(parseIsoDuration(null)).toBeUndefined();
    expect(parseIsoDuration(undefined)).toBeUndefined();
  });
  it('returns undefined for non-time garbage', () => {
    expect(parseIsoDuration('abc')).toBeUndefined();
  });
});

// ─── parseYield ────────────────────────────────────────────────────────────────

describe('parseYield', () => {
  it('parses integer 4 → 4', () => {
    expect(parseYield(4)).toBe(4);
  });
  it('parses string "4" → 4', () => {
    expect(parseYield('4')).toBe(4);
  });
  it('parses "4 porcje" → 4', () => {
    expect(parseYield('4 porcje')).toBe(4);
  });
  it('parses "około 6 osób" → 6', () => {
    expect(parseYield('około 6 osób')).toBe(6);
  });
  it('parses array ["4 porcje"] → 4', () => {
    expect(parseYield(['4 porcje'])).toBe(4);
  });
  it('parses QuantitativeValue { value: 4 } → 4', () => {
    expect(parseYield({ value: 4 })).toBe(4);
  });
  it('parses nested { value: "6 porcji" } → 6', () => {
    expect(parseYield({ value: '6 porcji' })).toBe(6);
  });
  it('returns undefined for null/zero', () => {
    expect(parseYield(null)).toBeUndefined();
    expect(parseYield(0)).toBeUndefined();
    expect(parseYield('')).toBeUndefined();
  });
});

// ─── parseImage ────────────────────────────────────────────────────────────────

describe('parseImage', () => {
  it('parses direct URL string', () => {
    expect(parseImage('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
  it('parses array of strings (takes first)', () => {
    expect(parseImage(['https://a.jpg', 'https://b.jpg'])).toBe('https://a.jpg');
  });
  it('parses ImageObject { url }', () => {
    expect(parseImage({ url: 'https://x.jpg' })).toBe('https://x.jpg');
  });
  it('parses ImageObject with contentUrl', () => {
    expect(parseImage({ contentUrl: 'https://y.jpg' })).toBe('https://y.jpg');
  });
  it('parses array of ImageObjects', () => {
    expect(parseImage([{ url: 'https://z.jpg' }])).toBe('https://z.jpg');
  });
  it('returns undefined for empty/null', () => {
    expect(parseImage(null)).toBeUndefined();
    expect(parseImage([])).toBeUndefined();
    expect(parseImage('')).toBeUndefined();
  });
});

// ─── parseRating ───────────────────────────────────────────────────────────────

describe('parseRating', () => {
  it('parses { ratingValue: 4.5, ratingCount: 123 }', () => {
    expect(parseRating({ ratingValue: 4.5, ratingCount: 123 })).toEqual({ rating: 4.5, ratingCount: 123 });
  });
  it('accepts string numbers', () => {
    expect(parseRating({ ratingValue: '4.5', ratingCount: '42' })).toEqual({ rating: 4.5, ratingCount: 42 });
  });
  it('falls back to reviewCount when ratingCount missing', () => {
    expect(parseRating({ ratingValue: 4, reviewCount: 10 })).toEqual({ rating: 4, ratingCount: 10 });
  });
  it('returns empty object for null/invalid', () => {
    expect(parseRating(null)).toEqual({});
    expect(parseRating('not an object')).toEqual({});
  });
});

// ─── parseInstructions ─────────────────────────────────────────────────────────

describe('parseInstructions', () => {
  it('parses array of plain strings', () => {
    expect(parseInstructions(['Step 1', 'Step 2'])).toEqual(['Step 1', 'Step 2']);
  });
  it('parses array of HowToStep objects with text', () => {
    const input = [
      { '@type': 'HowToStep', text: 'Crack eggs' },
      { '@type': 'HowToStep', text: 'Whisk them' },
    ];
    expect(parseInstructions(input)).toEqual(['Crack eggs', 'Whisk them']);
  });
  it('falls back to name when text missing', () => {
    expect(parseInstructions([{ '@type': 'HowToStep', name: 'Only name' }])).toEqual(['Only name']);
  });
  it('flattens HowToSection nested steps and prepends section name to first', () => {
    const input = [
      {
        '@type': 'HowToSection',
        name: 'Ciasto',
        itemListElement: [
          { '@type': 'HowToStep', text: 'Wymieszaj mąkę' },
          { '@type': 'HowToStep', text: 'Dodaj drożdże' },
        ],
      },
      {
        '@type': 'HowToSection',
        name: 'Krem',
        itemListElement: [{ '@type': 'HowToStep', text: 'Ubij śmietanę' }],
      },
    ];
    expect(parseInstructions(input)).toEqual([
      'Ciasto: Wymieszaj mąkę',
      'Dodaj drożdże',
      'Krem: Ubij śmietanę',
    ]);
  });
  it('handles mixed array of strings and HowToStep', () => {
    expect(
      parseInstructions(['First', { '@type': 'HowToStep', text: 'Second' }])
    ).toEqual(['First', 'Second']);
  });
  it('returns empty array for null/undefined', () => {
    expect(parseInstructions(null)).toEqual([]);
    expect(parseInstructions(undefined)).toEqual([]);
  });
  it('handles @type as array (["HowToStep", "CreativeWork"])', () => {
    expect(
      parseInstructions([{ '@type': ['HowToStep', 'CreativeWork'], text: 'Bake it' }])
    ).toEqual(['Bake it']);
  });
});

// ─── parseNutrition ────────────────────────────────────────────────────────────

describe('parseNutrition', () => {
  it('parses full NutritionInformation', () => {
    const input = {
      '@type': 'NutritionInformation',
      calories: '420 kcal',
      proteinContent: '12 g',
      fatContent: '18 g',
      saturatedFatContent: '5 g',
      carbohydrateContent: '45 g',
      fiberContent: '6 g',
      sugarContent: '8 g',
      sodiumContent: '350 mg',
      cholesterolContent: '50 mg',
    };
    expect(parseNutrition(input)).toEqual({
      calories: 420,
      protein: 12,
      fat: 18,
      saturatedFat: 5,
      carbs: 45,
      fiber: 6,
      sugar: 8,
      sodium: 350,
      cholesterol: 50,
    });
  });
  it('converts sodium "1.2 g" → 1200 mg', () => {
    const out = parseNutrition({ sodiumContent: '1.2 g' });
    expect(out?.sodium).toBe(1200);
  });
  it('leaves sodium "350 mg" as 350', () => {
    const out = parseNutrition({ sodiumContent: '350 mg' });
    expect(out?.sodium).toBe(350);
  });
  it('accepts numeric values without units', () => {
    const out = parseNutrition({ calories: 500, proteinContent: 20 });
    expect(out).toEqual({ calories: 500, protein: 20 });
  });
  it('returns undefined for empty / null', () => {
    expect(parseNutrition(null)).toBeUndefined();
    expect(parseNutrition({})).toBeUndefined();
  });
  it('drops undefined fields (only includes present ones)', () => {
    const out = parseNutrition({ calories: '100 kcal' });
    expect(out).toEqual({ calories: 100 });
  });
});

// ─── extractRecipeJsonLd ───────────────────────────────────────────────────────

describe('extractRecipeJsonLd', () => {
  function load(html: string) {
    return cheerio.load(html);
  }

  it('extracts Recipe from single object root', () => {
    const json = JSON.stringify({ '@type': 'Recipe', name: 'Test' });
    const $ = load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Test' });
  });

  it('extracts Recipe from array root', () => {
    const json = JSON.stringify([{ '@type': 'WebSite' }, { '@type': 'Recipe', name: 'Test' }]);
    const $ = load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Test' });
  });

  it('extracts Recipe from @graph array (WordPress pattern)', () => {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', url: 'https://example.com' },
        { '@type': 'Article' },
        { '@type': 'Recipe', name: 'Graph Test' },
      ],
    });
    const $ = load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Graph Test' });
  });

  it('matches @type array (["Recipe", "NewsArticle"])', () => {
    const json = JSON.stringify({ '@type': ['Recipe', 'NewsArticle'], name: 'Multi' });
    const $ = load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Multi' });
  });

  it('returns null when no Recipe present', () => {
    const json = JSON.stringify({ '@type': 'WebSite', name: 'Just a site' });
    const $ = load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    expect(extractRecipeJsonLd($)).toBeNull();
  });

  it('returns null when no JSON-LD on page', () => {
    const $ = load(`<html><head></head><body><h1>No JSON</h1></body></html>`);
    expect(extractRecipeJsonLd($)).toBeNull();
  });

  it('ignores invalid JSON and continues to next script', () => {
    const good = JSON.stringify({ '@type': 'Recipe', name: 'Good' });
    const $ = load(`
      <html><head>
        <script type="application/ld+json">{broken json,</script>
        <script type="application/ld+json">${good}</script>
      </head><body></body></html>
    `);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Good' });
  });

  it('recovers from trailing commas via lenient retry', () => {
    // JSON with trailing comma — strict JSON.parse rejects it, but we strip
    const $ = load(`
      <html><head>
        <script type="application/ld+json">{"@type":"Recipe","name":"Trailing",}</script>
      </head><body></body></html>
    `);
    expect(extractRecipeJsonLd($)).toMatchObject({ name: 'Trailing' });
  });
});

// ─── parseRecipeJsonLd (end-to-end) ────────────────────────────────────────────

describe('parseRecipeJsonLd', () => {
  it('parses a realistic schema.org Recipe', () => {
    const input = {
      '@type': 'Recipe',
      name: 'Naleśniki',
      description: 'Proste naleśniki z mąki orkiszowej',
      image: ['https://example.com/img.jpg'],
      author: { '@type': 'Person', name: 'Anna' },
      datePublished: '2024-01-15',
      recipeCategory: 'Śniadania',
      recipeCuisine: 'polska',
      keywords: 'naleśniki, śniadanie, szybkie',
      prepTime: 'PT15M',
      cookTime: 'PT10M',
      totalTime: 'PT25M',
      recipeYield: '4 porcje',
      recipeIngredient: ['200g mąki', '2 jajka', '500ml mleka'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Wymieszaj mąkę z jajkami' },
        { '@type': 'HowToStep', text: 'Dodaj mleko i wymieszaj' },
        { '@type': 'HowToStep', text: 'Smaż na patelni' },
      ],
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.7', ratingCount: '25' },
      nutrition: {
        '@type': 'NutritionInformation',
        calories: '320 kcal',
        proteinContent: '10 g',
        fatContent: '8 g',
        carbohydrateContent: '50 g',
        fiberContent: '2 g',
        sodiumContent: '180 mg',
      },
    };

    const parsed = parseRecipeJsonLd(input);
    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      title: 'Naleśniki',
      description: 'Proste naleśniki z mąki orkiszowej',
      rawIngredients: ['200g mąki', '2 jajka', '500ml mleka'],
      steps: ['Wymieszaj mąkę z jajkami', 'Dodaj mleko i wymieszaj', 'Smaż na patelni'],
      prepTimeMinutes: 15,
      cookTimeMinutes: 10,
      totalTimeMinutes: 25,
      servings: 4,
      rating: 4.7,
      ratingCount: 25,
      imageUrl: 'https://example.com/img.jpg',
      category: 'Śniadania',
      cuisineType: 'polska',
      author: 'Anna',
      datePublished: '2024-01-15',
    });
    expect(parsed!.tags).toContain('naleśniki');
    expect(parsed!.nutrition?.calories).toBe(320);
  });

  it('returns null when no name', () => {
    expect(parseRecipeJsonLd({ '@type': 'Recipe' })).toBeNull();
  });

  it('derives totalTime from prepTime + cookTime when missing', () => {
    const parsed = parseRecipeJsonLd({
      '@type': 'Recipe',
      name: 'X',
      prepTime: 'PT10M',
      cookTime: 'PT20M',
    });
    expect(parsed!.totalTimeMinutes).toBe(30);
  });

  it('handles keywords as array', () => {
    const parsed = parseRecipeJsonLd({
      '@type': 'Recipe',
      name: 'X',
      keywords: ['vegan', 'quick'],
    });
    expect(parsed!.tags).toEqual(['vegan', 'quick']);
  });
});

// ─── extractAndParseRecipe (combined) ──────────────────────────────────────────

describe('extractAndParseRecipe', () => {
  it('extracts and parses in one call', () => {
    const json = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage' },
        {
          '@type': 'Recipe',
          name: 'Combined Test',
          recipeIngredient: ['salt'],
          recipeInstructions: ['Mix'],
          prepTime: 'PT5M',
        },
      ],
    });
    const $ = cheerio.load(`<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`);
    const result = extractAndParseRecipe($);
    expect(result).toMatchObject({
      title: 'Combined Test',
      rawIngredients: ['salt'],
      steps: ['Mix'],
      prepTimeMinutes: 5,
    });
  });

  it('returns null when no Recipe on page', () => {
    const $ = cheerio.load(`<html><head></head><body></body></html>`);
    expect(extractAndParseRecipe($)).toBeNull();
  });
});
