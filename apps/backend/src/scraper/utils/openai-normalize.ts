/**
 * OpenAI gpt-4.1-mini wrapper for ingredient normalization and metadata generation.
 */

import OpenAI from 'openai';
import { OPENAI_CONFIG } from '../config';
import type { NormalizedIngredient, ProcessedRecipe, RawRecipe } from '../types';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env variable is required');
    client = new OpenAI({ apiKey });
  }
  return client;
}

// ─── Rate limiter ──────────────────────────────────────────────────────────────

// Retry with backoff — no sequential rate limiter, parallel calls allowed
async function callWithRetry<T>(fn: () => Promise<T>, retries = OPENAI_CONFIG.maxRetries): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRetryable = err instanceof Error && (
        err.message.includes('429') || err.message.includes('rate_limit') ||
        err.message.includes('timeout') || err.message.includes('ECONNRESET')
      );
      if (attempt === retries || !isRetryable) throw err;
      const backoff = OPENAI_CONFIG.retryDelayMs * Math.pow(2, attempt);
      console.warn(`  [openai] Retry ${attempt + 1}/${retries} in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error('Unreachable');
}

// ─── Normalize ingredients ─────────────────────────────────────────────────────

export async function normalizeIngredients(
  rawIngredients: string[],
): Promise<NormalizedIngredient[]> {
  const openai = getClient();

  const prompt = `Znormalizuj poniższe polskie składniki kuchenne. Dla każdego zwróć obiekt JSON z polami:
- "originalText": oryginalny tekst
- "name": kanoniczna polska nazwa produktu (np. "Cebula", "Oliwa z oliwek", "Pierś z kurczaka")
- "grams": waga w gramach (przelicz łyżki, szklanki, sztuki na gramy, np. 1 łyżka oliwy = 10g, 1 jajko = 60g, 1 średnia cebula = 80g, 1 ząbek czosnku = 5g, szklanka mąki = 130g)
- "unit": oryginalna jednostka (opcjonalnie)
- "notes": dodatkowe info np. "do smaku", "duża" (opcjonalnie)
- "isSpice": true jeśli to przyprawa/sos/zioło (sól, pieprz, kurkuma, oregano, itp.)

Dla "do smaku", "szczypta" użyj: sól=2g, pieprz=0.5g, inne przyprawy=0.5g.
Zwróć obiekt JSON z kluczem "ingredients" zawierającym tablicę wyników. Przykład: {"ingredients": [{"originalText":"...", "name":"...", "grams":100, "isSpice":false}]}

Składniki:
${rawIngredients.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

  let result: string;
  try {
    result = await callWithRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content ?? '{}';
      return content;
    });
  } catch (err) {
    console.error('[openai] normalizeIngredients API call failed:', err instanceof Error ? err.message : err);
    return rawIngredients.map((text) => ({
      originalText: text, name: text, grams: 0, isSpice: false,
    }));
  }

  try {
    const parsed = JSON.parse(result);
    // Debug: log raw response structure
    console.log(`  [openai] Raw response preview: ${result.substring(0, 200)}`);
    const keys = typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : ['(array)'];
    console.log(`  [openai] Parsed keys: ${keys.join(', ')}`);

    // Try multiple key names the model might use
    let items: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      // Find the first array value in the object
      items = [];
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          items = parsed[key];
          break;
        }
      }
    }
    return items.map((item: Record<string, unknown>) => ({
      originalText: String(item.originalText ?? ''),
      name: String(item.name ?? ''),
      grams: Number(item.grams ?? 0),
      unit: item.unit ? String(item.unit) : undefined,
      notes: item.notes ? String(item.notes) : undefined,
      isSpice: Boolean(item.isSpice),
    }));
  } catch (err) {
    console.error('[openai] Failed to parse normalized ingredients:', result);
    // Fallback: return raw ingredients with 0 grams
    return rawIngredients.map((text) => ({
      originalText: text,
      name: text,
      grams: 0,
      isSpice: false,
    }));
  }
}

// ─── Generate metadata ─────────────────────────────────────────────────────────

export interface RecipeMetadata {
  description: string;
  mealType: string;
  cuisineType: string;
  difficulty: string;
  seasons: number[];
  mealPrepFriendly: boolean;
  mealPrepTip: string | null;
  estimatedCost: 'BUDGET' | 'STANDARD' | 'PREMIUM';
}

export async function generateMetadata(
  recipes: Array<{ title: string; ingredients: string[]; steps: string[]; category?: string; totalTimeMinutes?: number }>,
): Promise<RecipeMetadata[]> {
  const openai = getClient();

  const recipesText = recipes
    .map(
      (r, i) =>
        `### Przepis ${i + 1}: ${r.title}
Kategoria źródłowa: ${r.category ?? 'brak'}
Czas: ${r.totalTimeMinutes ?? 'brak'} min
Składniki: ${r.ingredients.join(', ')}
Kroki: ${r.steps.length} kroków`,
    )
    .join('\n\n');

  const prompt = `Dla każdego przepisu poniżej wygeneruj metadane. Zwróć tablicę JSON obiektów z polami:
- "description": krótki opis po polsku (1-2 zdania, zachęcający, opisujący smak/charakter dania)
- "mealType": jeden z: BREAKFAST, SECOND_BREAKFAST, LUNCH, DINNER, SUPPER, SNACK, DESSERT, DRINK, SAUCE, SIDE_DISH
- "cuisineType": jeden z: polska, włoska, azjatycka, śródziemnomorska, meksykańska, indyjska, amerykańska, francuska, inna
- "difficulty": jeden z: EASY, MEDIUM, HARD (na podstawie liczby kroków i czasu)
- "seasons": tablica miesięcy 1-12 kiedy składniki są dostępne/sezonowe (jeśli danie całoroczne: [1,2,3,4,5,6,7,8,9,10,11,12])
- "mealPrepFriendly": true jeśli danie dobrze się przechowuje 2-3 dni w lodówce
- "mealPrepTip": jeśli mealPrepFriendly=true, krótka wskazówka po polsku o przechowywaniu (np. "Przechowuj w szczelnym pojemniku w lodówce do 3 dni")
- "estimatedCost": BUDGET (tanie składniki), STANDARD (normalne), PREMIUM (drogie: łosoś, krewetki, awokado, orzechy makadamia)

Zwróć obiekt JSON z kluczem "recipes" zawierającym tablicę wyników.

${recipesText}`;

  const result = await callWithRetry(async () => {
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content ?? '{}';
  });

  try {
    const parsed = JSON.parse(result);
    // Find array in response (may be under any key)
    let items: Record<string, unknown>[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      items = [];
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          items = parsed[key];
          break;
        }
      }
    }
    return items.map((item: Record<string, unknown>) => ({
      description: String(item.description ?? ''),
      mealType: String(item.mealType ?? 'LUNCH'),
      cuisineType: String(item.cuisineType ?? 'inna'),
      difficulty: String(item.difficulty ?? 'MEDIUM'),
      seasons: Array.isArray(item.seasons) ? (item.seasons as number[]) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      mealPrepFriendly: Boolean(item.mealPrepFriendly),
      mealPrepTip: item.mealPrepTip ? String(item.mealPrepTip) : null,
      estimatedCost: (['BUDGET', 'STANDARD', 'PREMIUM'].includes(String(item.estimatedCost))
        ? String(item.estimatedCost)
        : 'STANDARD') as 'BUDGET' | 'STANDARD' | 'PREMIUM',
    }));
  } catch (err) {
    console.error('[openai] Failed to parse metadata:', result);
    return recipes.map(() => ({
      description: '',
      mealType: 'LUNCH',
      cuisineType: 'inna',
      difficulty: 'MEDIUM',
      seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      mealPrepFriendly: false,
      mealPrepTip: null,
      estimatedCost: 'STANDARD' as const,
    }));
  }
}
