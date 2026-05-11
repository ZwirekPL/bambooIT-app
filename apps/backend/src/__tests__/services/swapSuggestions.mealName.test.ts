import { describe, it, expect } from 'vitest';
import { resolveEffectiveMealName, isMealTypeName } from '../../pdf/content-parser';

describe('BUG-2: resolveEffectiveMealName', () => {
  it('zwraca dish name gdy meal.name to generic meal-type', () => {
    expect(resolveEffectiveMealName('Śniadanie', 'Naleśniki z mąki orkiszowej'))
      .toBe('Naleśniki z mąki orkiszowej');
  });

  it('zwraca meal.name gdy to prawdziwa nazwa dania', () => {
    expect(resolveEffectiveMealName('Naleśniki puszyste', 'Naleśniki puszyste'))
      .toBe('Naleśniki puszyste');
  });

  it('zwraca meal.name gdy items[0].name też jest generic', () => {
    expect(resolveEffectiveMealName('Obiad', 'Obiad'))
      .toBe('Obiad');
  });

  it('zwraca meal.name gdy items[0].name jest puste', () => {
    expect(resolveEffectiveMealName('Śniadanie', ''))
      .toBe('Śniadanie');
  });

  it('obsługuje undefined inputs', () => {
    expect(resolveEffectiveMealName(undefined, undefined)).toBe('');
    expect(resolveEffectiveMealName('Śniadanie', undefined)).toBe('Śniadanie');
    expect(resolveEffectiveMealName(undefined, 'Omlet')).toBe('');
  });

  it('case-insensitive recognition of meal-type names', () => {
    expect(resolveEffectiveMealName('ŚNIADANIE', 'Sałatka z ananasem'))
      .toBe('Sałatka z ananasem');
    expect(resolveEffectiveMealName('drugie śniadanie', 'Pasta jajeczna'))
      .toBe('Pasta jajeczna');
  });

  it('trims whitespace', () => {
    expect(resolveEffectiveMealName('  Śniadanie  ', '  Naleśniki  '))
      .toBe('Naleśniki');
  });

  it('isMealTypeName — podstawowe typy', () => {
    expect(isMealTypeName('Śniadanie')).toBe(true);
    expect(isMealTypeName('śniadanie')).toBe(true);
    expect(isMealTypeName('Obiad')).toBe(true);
    expect(isMealTypeName('Drugie śniadanie')).toBe(true);
    expect(isMealTypeName('Podwieczorek')).toBe(true);
    expect(isMealTypeName('Kolacja')).toBe(true);
    expect(isMealTypeName('Naleśniki z mąki orkiszowej')).toBe(false);
    expect(isMealTypeName('Łosoś ze szpinakiem')).toBe(false);
  });
});
