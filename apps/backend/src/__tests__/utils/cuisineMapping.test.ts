import { describe, it, expect } from 'vitest';
import {
  mapCuisinePrefsToDb,
  classifyCuisineMatch,
} from '../../utils/cuisineMapping';

describe('mapCuisinePrefsToDb', () => {
  it('returns [] for empty / undefined / null', () => {
    expect(mapCuisinePrefsToDb([])).toEqual([]);
    expect(mapCuisinePrefsToDb(undefined)).toEqual([]);
    expect(mapCuisinePrefsToDb(null)).toEqual([]);
  });

  it('returns [] when patient explicitly picks "any"', () => {
    expect(mapCuisinePrefsToDb(['any'])).toEqual([]);
    expect(mapCuisinePrefsToDb(['ANY'])).toEqual([]);
    expect(mapCuisinePrefsToDb(['polish', 'any'])).toEqual([]);
  });

  it('translates direct EN→PL codes', () => {
    expect(mapCuisinePrefsToDb(['polish'])).toEqual(['polska']);
    expect(mapCuisinePrefsToDb(['mexican'])).toEqual(['meksykańska']);
    expect(mapCuisinePrefsToDb(['french'])).toEqual(['francuska']);
    expect(mapCuisinePrefsToDb(['indian'])).toEqual(['indyjska']);
    expect(mapCuisinePrefsToDb(['american'])).toEqual(['amerykańska']);
  });

  it('preserves italian typo variant', () => {
    expect(mapCuisinePrefsToDb(['italian'])).toEqual(['włoska', 'wloska']);
  });

  it('collapses asian sub-cuisines to azjatycka', () => {
    expect(mapCuisinePrefsToDb(['thai'])).toEqual(['azjatycka']);
    expect(mapCuisinePrefsToDb(['japanese'])).toEqual(['azjatycka']);
    expect(mapCuisinePrefsToDb(['vietnamese'])).toEqual(['azjatycka']);
    expect(mapCuisinePrefsToDb(['asian_general'])).toEqual(['azjatycka']);
  });

  it('collapses Levantine / E. Mediterranean to śródziemnomorska', () => {
    expect(mapCuisinePrefsToDb(['greek'])).toEqual(['śródziemnomorska']);
    expect(mapCuisinePrefsToDb(['turkish'])).toEqual(['śródziemnomorska']);
    expect(mapCuisinePrefsToDb(['lebanese'])).toEqual(['śródziemnomorska']);
    expect(mapCuisinePrefsToDb(['middle_eastern'])).toEqual(['śródziemnomorska']);
  });

  it('still resolves legacy scandinavian → inna for back-compat', () => {
    // The interview dropped the scandinavian option in Z5 (2026-04-28) but
    // existing answers may still carry the value; mapping must keep working.
    expect(mapCuisinePrefsToDb(['scandinavian'])).toEqual(['inna']);
  });

  it('dedupes overlapping codes', () => {
    // thai + japanese both map to azjatycka — should appear once
    expect(mapCuisinePrefsToDb(['thai', 'japanese'])).toEqual(['azjatycka']);
    // greek + turkish + mediterranean all map to śródziemnomorska
    const got = mapCuisinePrefsToDb(['greek', 'turkish', 'mediterranean']);
    expect(got).toContain('śródziemnomorska');
    expect(got.filter((c) => c === 'śródziemnomorska')).toHaveLength(1);
  });

  it('handles mixed-case + whitespace input', () => {
    expect(mapCuisinePrefsToDb(['  POLISH  '])).toEqual(['polska']);
    expect(mapCuisinePrefsToDb(['Mexican', 'thai'])).toEqual(['meksykańska', 'azjatycka']);
  });

  it('drops unknown codes silently', () => {
    expect(mapCuisinePrefsToDb(['martian'])).toEqual([]);
    expect(mapCuisinePrefsToDb(['polish', 'martian'])).toEqual(['polska']);
  });
});

describe('classifyCuisineMatch', () => {
  it('returns neutral when patient has no preference', () => {
    expect(classifyCuisineMatch('polska', [])).toBe('neutral');
    expect(classifyCuisineMatch('polska', undefined)).toBe('neutral');
    expect(classifyCuisineMatch('meksykańska', null)).toBe('neutral');
    // 'any' = explicit no-preference
    expect(classifyCuisineMatch('polska', ['any'])).toBe('neutral');
  });

  it('returns neutral for null/empty recipe cuisine regardless of prefs', () => {
    expect(classifyCuisineMatch(null, ['polish'])).toBe('neutral');
    expect(classifyCuisineMatch('', ['polish'])).toBe('neutral');
  });

  it('treats legacy "uniwersalna" as a regular mismatch (P0.3 dropped neutral catch-all)', () => {
    // P0.3 (2026-04-29) dropped 'uniwersalna' from the taxonomy and added a
    // CHECK constraint blocking new writes. Any stray legacy value should now
    // fall through to the standard match check rather than silently passing.
    expect(classifyCuisineMatch('uniwersalna', ['mexican'])).toBe('mismatch');
  });

  it('returns match when recipe cuisine is in patient prefs', () => {
    expect(classifyCuisineMatch('polska', ['polish'])).toBe('match');
    expect(classifyCuisineMatch('meksykańska', ['mexican'])).toBe('match');
    expect(classifyCuisineMatch('azjatycka', ['thai'])).toBe('match');
    expect(classifyCuisineMatch('azjatycka', ['asian_general'])).toBe('match');
    expect(classifyCuisineMatch('śródziemnomorska', ['greek'])).toBe('match');
    expect(classifyCuisineMatch('śródziemnomorska', ['mediterranean'])).toBe('match');
  });

  it('returns mismatch when patient has prefs but cuisine differs', () => {
    expect(classifyCuisineMatch('polska', ['mexican'])).toBe('mismatch');
    expect(classifyCuisineMatch('francuska', ['polish', 'italian'])).toBe('mismatch');
    expect(classifyCuisineMatch('inna', ['polish'])).toBe('mismatch');
  });

  it('match check is case-insensitive', () => {
    expect(classifyCuisineMatch('POLSKA', ['polish'])).toBe('match');
    expect(classifyCuisineMatch('  Meksykańska  ', ['mexican'])).toBe('match');
  });

  it('matches multi-cuisine prefs (any one suffices)', () => {
    expect(classifyCuisineMatch('polska', ['polish', 'mediterranean'])).toBe('match');
    expect(classifyCuisineMatch('śródziemnomorska', ['polish', 'mediterranean'])).toBe('match');
    expect(classifyCuisineMatch('francuska', ['polish', 'mediterranean'])).toBe('mismatch');
  });

  it('handles legacy DB typo variants', () => {
    expect(classifyCuisineMatch('wloska', ['italian'])).toBe('match');
    expect(classifyCuisineMatch('srodziemnomorska', ['mediterranean'])).toBe('match');
  });
});
