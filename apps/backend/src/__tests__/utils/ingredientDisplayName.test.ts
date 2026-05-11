import { describe, it, expect } from 'vitest';
import { cleanIngredientName } from '../../utils/ingredientDisplayName';

describe('cleanIngredientName (backend)', () => {
  it('strips "60 g chałki" → "Chałki"', () => {
    expect(cleanIngredientName('60 g chałki')).toBe('Chałki');
  });

  it('strips "50 ml mleka" → "Mleka"', () => {
    expect(cleanIngredientName('50 ml mleka')).toBe('Mleka');
  });

  it('strips "2 ząbki czosnku" → "Czosnku"', () => {
    expect(cleanIngredientName('2 ząbki czosnku')).toBe('Czosnku');
  });

  it('strips decimal "1,5 kg ziemniaków" → "Ziemniaków"', () => {
    expect(cleanIngredientName('1,5 kg ziemniaków')).toBe('Ziemniaków');
  });

  it('leaves clean names unchanged', () => {
    expect(cleanIngredientName('Szpinak')).toBe('Szpinak');
    expect(cleanIngredientName('Jajko kurze')).toBe('Jajko kurze');
  });

  it('passes through "1 jajko" — "jajko" is not a whitelisted unit', () => {
    expect(cleanIngredientName('1 jajko')).toBe('1 jajko');
  });

  it('passes through "100 g" (no text after unit)', () => {
    expect(cleanIngredientName('100 g')).toBe('100 g');
  });

  it('returns null for null/undefined/empty', () => {
    expect(cleanIngredientName(null)).toBeNull();
    expect(cleanIngredientName(undefined)).toBeNull();
    expect(cleanIngredientName('')).toBeNull();
    expect(cleanIngredientName('   ')).toBeNull();
  });
});
