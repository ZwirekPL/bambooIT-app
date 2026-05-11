import type { RedFlag, RedFlagResult, PatientContext, TriggeredRedFlag } from './types';

// ─── Red Flag Definitions ─────────────────────────────────────────────────────

export const RED_FLAGS: RedFlag[] = [
  {
    id: 'rf-extreme-low-weight',
    name: 'Skrajnie niska masa ciała',
    description: 'BMI poniżej 16 — wymaga nadzoru medycznego',
    severity: 'CRITICAL',
    condition: (ctx) => {
      if (!ctx.weightKg || !ctx.heightCm) return false;
      const bmi = ctx.weightKg / ((ctx.heightCm / 100) ** 2);
      return bmi < 16;
    },
    message: 'BMI pacjenta < 16 (skrajne niedożywienie). Auto-generowanie wstrzymane — wymagana konsultacja medyczna i indywidualny plan pod nadzorem lekarza.',
  },
  {
    id: 'rf-very-low-bmi',
    name: 'Bardzo niskie BMI',
    description: 'BMI poniżej 17 — ryzyko niedożywienia',
    severity: 'HIGH',
    condition: (ctx) => {
      if (!ctx.weightKg || !ctx.heightCm) return false;
      const bmi = ctx.weightKg / ((ctx.heightCm / 100) ** 2);
      return bmi >= 16 && bmi < 17;
    },
    message: 'BMI pacjenta < 17 (niedowaga z ryzykiem niedożywienia). Zalecana weryfikacja planu przez dietetyka przed wysłaniem.',
  },
  {
    id: 'rf-extreme-obesity',
    name: 'Otyłość III stopnia',
    description: 'BMI powyżej 40 — wymaga nadzoru medycznego',
    severity: 'HIGH',
    condition: (ctx) => {
      if (!ctx.weightKg || !ctx.heightCm) return false;
      const bmi = ctx.weightKg / ((ctx.heightCm / 100) ** 2);
      return bmi >= 40;
    },
    message: 'BMI pacjenta >= 40 (otyłość III stopnia). Zalecana konsultacja z lekarzem i indywidualny plan z nadzorem.',
  },
  {
    id: 'rf-pregnancy-weight-loss',
    name: 'Ciąża + cel redukcja',
    description: 'Pacjentka w ciąży z celem redukcji masy ciała — niebezpieczne',
    severity: 'CRITICAL',
    condition: (ctx) => {
      return ctx.pregnancyStatus === 'pregnant' && ctx.goal === 'lose_weight';
    },
    message: 'Pacjentka w ciąży z celem redukcji masy ciała. Auto-generowanie wstrzymane — redukcja podczas ciąży jest przeciwwskazana.',
  },
  {
    id: 'rf-very-low-kcal',
    name: 'Skrajnie niskie zapotrzebowanie',
    description: 'Target kaloryczny poniżej 1000 kcal — ryzyko niedoborów',
    severity: 'CRITICAL',
    condition: (ctx) => ctx.targetKcal > 0 && ctx.targetKcal < 1000,
    message: 'Obliczone zapotrzebowanie < 1000 kcal/dzień. Auto-generowanie wstrzymane — tak niski kaloryczny cel jest medycznie niebezpieczny bez nadzoru.',
  },
  {
    id: 'rf-low-kcal',
    name: 'Niskie zapotrzebowanie',
    description: 'Target kaloryczny poniżej 1200 kcal — wymaga uwagi',
    severity: 'MODERATE',
    condition: (ctx) => ctx.targetKcal >= 1000 && ctx.targetKcal < 1200,
    message: 'Obliczone zapotrzebowanie < 1200 kcal/dzień. Dieta bardzo niskokaloryczna — zalecana weryfikacja przez dietetyka.',
  },
  {
    id: 'rf-multiple-conditions',
    name: 'Liczne schorzenia',
    description: 'Pacjent ma 3+ chorób przewlekłych — wymaga indywidualnego podejścia',
    severity: 'HIGH',
    condition: (ctx) => ctx.chronicDiseases.length >= 3,
    message: 'Pacjent zgłosił 3 lub więcej chorób przewlekłych. Zalecana weryfikacja planu przez dietetyka — wiele schorzeń może mieć sprzeczne wymagania dietetyczne.',
  },
  {
    id: 'rf-diabetes-medications',
    name: 'Cukrzyca + leki',
    description: 'Pacjent z cukrzycą przyjmujący leki — ryzyko hipoglikemii',
    severity: 'HIGH',
    condition: (ctx) => {
      const hasDiabetes = ctx.chronicDiseases.some(c => {
        const lower = c.toLowerCase();
        return lower.includes('diabetes') || lower.includes('cukrzyca');
      });
      const hasMeds = ctx.medications && ctx.medications.trim().length > 0;
      return hasDiabetes && !!hasMeds;
    },
    message: 'Pacjent z cukrzycą przyjmuje leki. Zmiana diety może wpłynąć na zapotrzebowanie na insulinę/leki — zalecana konsultacja z lekarzem.',
  },
  {
    id: 'rf-elderly-multimorbid',
    name: 'Osoba starsha z wielochorobowością',
    description: 'Pacjent 70+ lat z chorobami przewlekłymi',
    severity: 'MODERATE',
    condition: (ctx) => ctx.ageYears >= 70 && ctx.chronicDiseases.length >= 1,
    message: 'Pacjent w wieku 70+ lat ze schorzeniami. Zalecana weryfikacja planu — osoby starsze mają specyficzne wymagania żywieniowe (np. wyższe białko, wapń, witamina D).',
  },
  {
    id: 'rf-child-adolescent',
    name: 'Niepełnoletni pacjent',
    description: 'Pacjent poniżej 16 lat — rosnący organizm wymaga szczególnej uwagi',
    severity: 'HIGH',
    condition: (ctx) => ctx.ageYears > 0 && ctx.ageYears < 16,
    message: 'Pacjent poniżej 16 lat. Auto-generowanie wymaga weryfikacji — dieta dla rosnącego organizmu musi uwzględniać specyficzne potrzeby rozwojowe.',
  },

  // ─── Phase 31.1.4: Target weight underweight red flag ──────────────────────

  {
    id: 'rf-target-weight-underweight',
    name: 'Cel wagowy = niedowaga',
    description: 'Docelowa masa ciała daje BMI < 18.5 — ryzyko niedożywienia',
    severity: 'HIGH',
    condition: (ctx) => {
      if (!ctx.targetWeightKg || !ctx.heightCm) return false;
      const targetBmi = ctx.targetWeightKg / ((ctx.heightCm / 100) ** 2);
      return targetBmi < 18.5;
    },
    message: 'Docelowa masa ciała pacjenta daje BMI < 18.5 (niedowaga). Plan wymaga weryfikacji przez dietetyka — cel wagowy może prowadzić do niedożywienia.',
  },

  // ─── Phase 27.14: New Red Flags ─────────────────────────────────────────────

  {
    id: 'rf-eating-disorder',
    name: 'Zaburzenia odżywiania',
    description: 'Pacjent z rozpoznaniem zaburzeń odżywiania (anoreksja, bulimia) — wymaga nadzoru specjalisty',
    severity: 'CRITICAL',
    condition: (ctx) => {
      const all = [...ctx.chronicDiseases, ...ctx.digestiveIssues, ...(ctx.hormonalIssues ?? [])];
      const lower = all.map(s => s.toLowerCase());
      return lower.some(c =>
        c.includes('anoreksja') || c.includes('anorexia') ||
        c.includes('bulimia') || c.includes('bulimia')
      );
    },
    message: 'Pacjent z rozpoznaniem zaburzeń odżywiania (anoreksja/bulimia). Auto-generowanie wstrzymane — wymagana terapia pod nadzorem zespołu specjalistów (psychiatra, psycholog, dietetyk kliniczny).',
  },
  {
    id: 'rf-hepatic-encephalopathy',
    name: 'Encefalopatia wątrobowa',
    description: 'Encefalopatia wątrobowa — stan zagrożenia życia wymagający nadzoru medycznego',
    severity: 'CRITICAL',
    condition: (ctx) => {
      const all = [...ctx.chronicDiseases, ...ctx.digestiveIssues];
      const lower = all.map(s => s.toLowerCase());
      return lower.some(c =>
        c.includes('encefalopatia wątrobowa') || c.includes('hepatic encephalopathy') ||
        c.includes('encefalopatia')
      );
    },
    message: 'Pacjent z encefalopatią wątrobową. Auto-generowanie wstrzymane — stan zagrożenia życia wymagający hospitalizacji i ścisłego nadzoru dietetycznego (ograniczenie białka, BCAA, laktuloza).',
  },
  {
    id: 'rf-ckd-stage-4-5',
    name: 'CKD stadium 4-5',
    description: 'Przewlekła choroba nerek w zaawansowanym stadium — wymaga nadzoru nefrologa',
    severity: 'CRITICAL',
    condition: (ctx) => {
      const all = [...ctx.chronicDiseases];
      const lower = all.map(s => s.toLowerCase());
      const hasCkd = lower.some(c =>
        c.includes('ckd') || c.includes('przewlekła choroba nerek') ||
        c.includes('chronic kidney disease') || c.includes('niewydolność nerek')
      );
      if (!hasCkd) return false;
      // Check stage if available
      if (ctx.stage) {
        const stageLower = ctx.stage.toLowerCase();
        return stageLower.includes('4') || stageLower.includes('5') ||
               stageLower.includes('iv') || stageLower.includes('v');
      }
      return false;
    },
    message: 'Pacjent z CKD stadium 4-5. Auto-generowanie wstrzymane — zaawansowana niewydolność nerek wymaga ścisłego nadzoru nefrologicznego (białko 0.6-0.8g/kg, kontrola potasu, fosforu, sodu).',
  },
  {
    id: 'rf-cancer',
    name: 'Choroba nowotworowa',
    description: 'Pacjent z aktywną chorobą nowotworową — wymaga indywidualnego planu',
    severity: 'HIGH',
    condition: (ctx) => {
      const all = [...ctx.chronicDiseases];
      const lower = all.map(s => s.toLowerCase());
      return lower.some(c =>
        c.includes('nowotwór') || c.includes('rak') || c.includes('cancer') ||
        c.includes('onkolog') || c.includes('chemioterapi') || c.includes('radioterapia') ||
        c.includes('guz') || c.includes('tumor')
      );
    },
    message: 'Pacjent z chorobą nowotworową. Plan wymaga weryfikacji przez dietetyka — onkologia wymaga indywidualnego podejścia (białko 1.2-1.5g/kg, zapobieganie kacheksji, interakcje z leczeniem).',
  },
  {
    id: 'rf-pregnancy-gdm',
    name: 'Ciąża + cukrzyca ciążowa',
    description: 'Pacjentka w ciąży z cukrzycą ciążową — wymaga ścisłego nadzoru',
    severity: 'HIGH',
    condition: (ctx) => {
      const isPregnant = ctx.pregnancyStatus === 'pregnant';
      if (!isPregnant) return false;
      const all = [...ctx.chronicDiseases, ...(ctx.hormonalIssues ?? [])];
      const lower = all.map(s => s.toLowerCase());
      return lower.some(c =>
        c.includes('cukrzyca ciążowa') || c.includes('gdm') ||
        c.includes('gestational diabetes')
      );
    },
    message: 'Pacjentka w ciąży z cukrzycą ciążową (GDM). Plan wymaga weryfikacji — dieta musi zapewniać prawidłowy rozwój płodu przy kontroli glikemii (40-45% węglowodanów, niski IG, 6 posiłków/d).',
  },
  {
    id: 'rf-post-bariatric',
    name: 'Pacjent po bariatrii',
    description: 'Pacjent po operacji bariatrycznej — wymaga specjalistycznej diety etapowej',
    severity: 'HIGH',
    condition: (ctx) => {
      const surgeries = ctx.surgeryHistory ?? [];
      const lower = surgeries.map(s => s.toLowerCase());
      const fromSurgery = lower.some(s =>
        s.includes('bariatr') || s.includes('sleeve') || s.includes('bypass') ||
        s.includes('rękaw') || s.includes('ominięcie') || s.includes('band')
      );
      if (fromSurgery) return true;
      // Also check chronicDiseases for mentions
      const diseases = ctx.chronicDiseases.map(s => s.toLowerCase());
      return diseases.some(c =>
        c.includes('po bariatrii') || c.includes('post-bariatric') ||
        c.includes('po sleeve') || c.includes('po bypass')
      );
    },
    message: 'Pacjent po operacji bariatrycznej. Plan wymaga weryfikacji — obowiązkowa suplementacja (B12, Fe, Ca, D3, białko), dieta etapowa, małe porcje, priorytet białka.',
  },
  {
    id: 'rf-decompensated-cirrhosis',
    name: 'Marskość wątroby dekompensowana',
    description: 'Marskość wątroby dekompensowana — stan zaawansowany wymagający nadzoru hepatologa',
    severity: 'HIGH',
    condition: (ctx) => {
      const all = [...ctx.chronicDiseases];
      const lower = all.map(s => s.toLowerCase());
      const hasCirrhosis = lower.some(c =>
        c.includes('marskość') || c.includes('cirrhosis') || c.includes('cirrhotic')
      );
      if (!hasCirrhosis) return false;
      // Check for decompensated stage
      if (ctx.stage) {
        const stageLower = ctx.stage.toLowerCase();
        return stageLower.includes('dekomp') || stageLower.includes('decomp') ||
               stageLower.includes('child-pugh b') || stageLower.includes('child-pugh c');
      }
      // If no stage specified but cirrhosis + ascites/variceal indicators
      return lower.some(c =>
        c.includes('wodobrzusze') || c.includes('ascites') ||
        c.includes('żylaki przełyku') || c.includes('varice')
      );
    },
    message: 'Pacjent z marskością wątroby dekompensowaną. Plan wymaga weryfikacji — zaawansowana choroba wątroby wymaga nadzoru hepatologa (białko 1.2-1.5g/kg, ograniczenie sodu, małe częste posiłki, BCAA).',
  },
];

// ─── Evaluate Red Flags ───────────────────────────────────────────────────────

/**
 * Checks all red flags against patient context.
 * Returns triggered flags and whether generation should be blocked.
 */
export function evaluateRedFlags(ctx: PatientContext): RedFlagResult {
  const triggered: TriggeredRedFlag[] = [];

  for (const flag of RED_FLAGS) {
    if (flag.condition(ctx)) {
      triggered.push({
        flagId: flag.id,
        name: flag.name,
        severity: flag.severity,
        message: flag.message,
      });
    }
  }

  const blockGeneration = triggered.some(f => f.severity === 'CRITICAL');

  return {
    triggered: triggered.length > 0,
    flags: triggered,
    blockGeneration,
  };
}
