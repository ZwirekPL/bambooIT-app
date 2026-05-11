import { describe, it, expect } from 'vitest';
import { classifyUnmatched } from '../../services/nutritionCalculator.service';

// ─── classifyUnmatched ──────────────────────────────────────────────────────

describe('classifyUnmatched', () => {
  it('classifies chicken as poultry', () => {
    expect(classifyUnmatched('kurczak')).toBe('poultry');
    expect(classifyUnmatched('filet z kurczaka')).toBe('poultry');
    expect(classifyUnmatched('pierś z indyka')).toBe('poultry');
  });

  it('classifies fish', () => {
    expect(classifyUnmatched('łosoś')).toBe('fish');
    expect(classifyUnmatched('dorsz')).toBe('fish');
    expect(classifyUnmatched('tuńczyk')).toBe('fish');
    expect(classifyUnmatched('krewetki')).toBe('fish');
  });

  it('classifies meat', () => {
    expect(classifyUnmatched('wołowina')).toBe('meat');
    expect(classifyUnmatched('wieprzowina')).toBe('meat');
    expect(classifyUnmatched('szynka')).toBe('meat');
  });

  it('classifies dairy', () => {
    expect(classifyUnmatched('mleko')).toBe('dairy');
    expect(classifyUnmatched('jogurt naturalny')).toBe('dairy');
    expect(classifyUnmatched('ser żółty')).toBe('dairy');
    expect(classifyUnmatched('twaróg')).toBe('dairy');
  });

  it('classifies grains', () => {
    expect(classifyUnmatched('ryż biały')).toBe('grain');
    expect(classifyUnmatched('makaron penne')).toBe('grain');
    expect(classifyUnmatched('chleb żytni')).toBe('grain');
    expect(classifyUnmatched('płatki owsiane')).toBe('grain');
    expect(classifyUnmatched('kasza gryczana')).toBe('grain');
  });

  it('classifies vegetables', () => {
    expect(classifyUnmatched('pomidor')).toBe('vegetable');
    expect(classifyUnmatched('brokuły')).toBe('vegetable');
    expect(classifyUnmatched('szpinak')).toBe('vegetable');
    expect(classifyUnmatched('marchew')).toBe('vegetable');
  });

  it('classifies fruits', () => {
    expect(classifyUnmatched('jabłko')).toBe('fruit');
    expect(classifyUnmatched('banan')).toBe('fruit');
    expect(classifyUnmatched('truskawki')).toBe('fruit');
    expect(classifyUnmatched('avocado')).toBe('fruit');
  });

  it('classifies fats', () => {
    expect(classifyUnmatched('oliwa z oliwek')).toBe('fat');
    expect(classifyUnmatched('masło')).toBe('fat');
    expect(classifyUnmatched('olej rzepakowy')).toBe('fat');
  });

  it('classifies legumes', () => {
    expect(classifyUnmatched('soczewica')).toBe('legume');
    expect(classifyUnmatched('ciecierzyca')).toBe('legume');
    expect(classifyUnmatched('tofu')).toBe('legume');
    expect(classifyUnmatched('hummus')).toBe('legume');
  });

  it('classifies nuts', () => {
    expect(classifyUnmatched('orzechy włoskie')).toBe('nut');
    expect(classifyUnmatched('migdały')).toBe('nut');
    expect(classifyUnmatched('pestki dyni')).toBe('nut');
    expect(classifyUnmatched('nasiona chia')).toBe('nut');
  });

  it('classifies eggs', () => {
    expect(classifyUnmatched('jajko')).toBe('egg');
    expect(classifyUnmatched('białko jaja')).toBe('egg');
  });

  it('classifies beverages', () => {
    expect(classifyUnmatched('woda mineralna')).toBe('beverage');
    expect(classifyUnmatched('herbata zielona')).toBe('beverage');
    expect(classifyUnmatched('kawa')).toBe('beverage');
  });

  it('returns unknown for unrecognized', () => {
    expect(classifyUnmatched('suplement XYZ')).toBe('unknown');
    expect(classifyUnmatched('przyprawa tajska')).toBe('unknown');
  });
});
