import { describe, it, expect } from 'vitest';
import { cleanIngredientName } from '@/lib/ingredient-display';

describe('cleanIngredientName', () => {
  describe('strips leading quantity+unit from scraper-imported names', () => {
    it('strips "60 g chałki" → "Chałki"', () => {
      expect(cleanIngredientName('60 g chałki')).toBe('Chałki');
    });

    it('strips "50 ml mleka" → "Mleka"', () => {
      expect(cleanIngredientName('50 ml mleka')).toBe('Mleka');
    });

    it('strips "7 g ksylitolu" → "Ksylitolu"', () => {
      expect(cleanIngredientName('7 g ksylitolu')).toBe('Ksylitolu');
    });

    it('strips "5 g oleju rzepakowego" → "Oleju rzepakowego"', () => {
      expect(cleanIngredientName('5 g oleju rzepakowego')).toBe(
        'Oleju rzepakowego',
      );
    });

    it('strips "100 g twarożku grani" → "Twarożku grani"', () => {
      expect(cleanIngredientName('100 g twarożku grani')).toBe(
        'Twarożku grani',
      );
    });

    it('strips "15 g świeżych fig" → "Świeżych fig"', () => {
      expect(cleanIngredientName('15 g świeżych fig')).toBe('Świeżych fig');
    });

    it('strips "5 g orzechów włoskich" → "Orzechów włoskich"', () => {
      expect(cleanIngredientName('5 g orzechów włoskich')).toBe(
        'Orzechów włoskich',
      );
    });

    it('strips "10 g miodu" → "Miodu"', () => {
      expect(cleanIngredientName('10 g miodu')).toBe('Miodu');
    });

    it('strips "10 g szczypiorku" → "Szczypiorku" (from dev screenshot)', () => {
      expect(cleanIngredientName('10 g szczypiorku')).toBe('Szczypiorku');
    });

    it('strips household units: "2 ząbki czosnku" → "Czosnku"', () => {
      expect(cleanIngredientName('2 ząbki czosnku')).toBe('Czosnku');
    });

    it('strips "1 łyżka oliwy" → "Oliwy"', () => {
      expect(cleanIngredientName('1 łyżka oliwy')).toBe('Oliwy');
    });

    it('strips "2 łyżeczki cukru" → "Cukru"', () => {
      expect(cleanIngredientName('2 łyżeczki cukru')).toBe('Cukru');
    });

    it('strips "1 szklanka mąki" → "Mąki"', () => {
      expect(cleanIngredientName('1 szklanka mąki')).toBe('Mąki');
    });

    it('strips decimal quantities: "1,5 kg ziemniaków" → "Ziemniaków"', () => {
      expect(cleanIngredientName('1,5 kg ziemniaków')).toBe('Ziemniaków');
    });

    it('strips "0.5 l bulionu" → "Bulionu"', () => {
      expect(cleanIngredientName('0.5 l bulionu')).toBe('Bulionu');
    });
  });

  describe('passthrough for clean names', () => {
    it('leaves "Szpinak" unchanged', () => {
      expect(cleanIngredientName('Szpinak')).toBe('Szpinak');
    });

    it('leaves "Jajko kurze" unchanged', () => {
      expect(cleanIngredientName('Jajko kurze')).toBe('Jajko kurze');
    });

    it('leaves "ser, feta" → "Ser, feta" (capitalizes first letter only)', () => {
      expect(cleanIngredientName('ser, feta')).toBe('Ser, feta');
    });

    it('leaves "Pieczywo żytnie chrupkie" unchanged', () => {
      expect(cleanIngredientName('Pieczywo żytnie chrupkie')).toBe(
        'Pieczywo żytnie chrupkie',
      );
    });
  });

  describe('safety — never wipe the name', () => {
    it('passes through "1 jajko" — "jajko" is not a whitelisted unit', () => {
      expect(cleanIngredientName('1 jajko')).toBe('1 jajko');
    });

    it('passes through "100 g" (no text after unit) so name never becomes empty', () => {
      expect(cleanIngredientName('100 g')).toBe('100 g');
    });

    it('passes through "5 owoców" — "owoców" is not a unit', () => {
      expect(cleanIngredientName('5 owoców')).toBe('5 owoców');
    });
  });

  describe('null / empty handling', () => {
    it('returns null for null', () => {
      expect(cleanIngredientName(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(cleanIngredientName(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(cleanIngredientName('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(cleanIngredientName('   ')).toBeNull();
    });
  });
});
