import { prisma } from '@db';
import { AppError } from '../utils/errors';
import { decryptJson, decryptString } from '../utils/encryption';
import { buildPatientContext } from '../policies/policy-engine';
import { evaluateCondition, type RuleCondition } from '../policies/condition-evaluator';

// ─── Disease → dietary guidelines mapping ────────────────────────────────────

const DISEASE_GUIDELINES: Record<string, { name: string; severity: 'critical' | 'high' | 'moderate'; guidelines: string[] }> = {
  diabetes_t1: {
    name: 'Cukrzyca typu 1',
    severity: 'critical',
    guidelines: [
      'IG ≤ 55 (niski indeks glikemiczny)',
      'ŁG ≤ 10 na porcję',
      'Węglowodany 45-50% energii',
      '5-6 posiłków dziennie, regularne godziny',
      'Unikaj cukrów prostych',
      'Monitoruj spożycie węglowodanów (WBT)',
    ],
  },
  diabetes_t2: {
    name: 'Cukrzyca typu 2',
    severity: 'critical',
    guidelines: [
      'IG ≤ 55 (niski indeks glikemiczny)',
      'ŁG ≤ 10 na porcję',
      'Węglowodany 45-50% energii',
      '5-6 posiłków dziennie, regularne godziny',
      'Unikaj cukrów prostych',
      'Błonnik ≥ 25g/dzień',
    ],
  },
  insulin_resistance: {
    name: 'Insulinooporność',
    severity: 'high',
    guidelines: [
      'IG ≤ 55 (niski indeks glikemiczny)',
      'Unikaj cukrów prostych i przetworzonej żywności',
      'Błonnik ≥ 25g/dzień',
      'Regularne posiłki co 3-4h',
      'Cynamon, ocet jabłkowy mogą wspierać wrażliwość na insulinę',
    ],
  },
  hypertension: {
    name: 'Nadciśnienie tętnicze',
    severity: 'high',
    guidelines: [
      'Sód < 1500 mg/dzień (dieta DASH)',
      'Potas ↑ (banany, pomidory, ziemniaki)',
      'Magnez ↑ (orzechy, nasiona, zielone warzywa)',
      'Wapń ↑ (nabiał, sardynki)',
      'Ograniczyć alkohol',
      'Omega-3 (ryby morskie 2x/tydzień)',
    ],
  },
  chd: {
    name: 'Choroba wieńcowa',
    severity: 'critical',
    guidelines: [
      'Tłuszcze nasycone < 7% energii',
      'Cholesterol < 200 mg/dzień',
      'Omega-3 (ryby morskie 2-3x/tydzień)',
      'Błonnik ≥ 30g/dzień',
      'Sterole roślinne 2g/dzień',
      'Dieta DASH',
    ],
  },
  heart_failure: {
    name: 'Niewydolność serca',
    severity: 'critical',
    guidelines: [
      'Sód < 2000 mg/dzień',
      'Płyny — ograniczyć wg zaleceń lekarza',
      'Potas — monitorować (interakcje z lekami)',
      'Małe, częste posiłki',
    ],
  },
  hypercholesterolemia: {
    name: 'Hipercholesterolemia',
    severity: 'high',
    guidelines: [
      'Tłuszcze nasycone < 7% energii',
      'Cholesterol < 200 mg/dzień',
      'Błonnik rozpuszczalny ≥ 10g/dzień (owies, jabłka)',
      'Sterole roślinne 2g/dzień',
      'Omega-3 ↑',
      'Unikaj tłuszczów trans',
    ],
  },
  hypothyroidism: {
    name: 'Niedoczynność tarczycy',
    severity: 'moderate',
    guidelines: [
      'Jod — umiarkowane spożycie (nie nadmiar)',
      'Selen ↑ (orzechy brazylijskie, ryby)',
      'Cynk ↑',
      'Unikaj dużych ilości goitrogenów (surowa kapusta, brokuły) — gotowanie ok',
      'Gluten — rozważ eliminację (przy Hashimoto)',
    ],
  },
  hashimoto: {
    name: 'Hashimoto',
    severity: 'high',
    guidelines: [
      'Rozważ dietę bezglutenową',
      'Selen 55-200 µg/dzień (orzechy brazylijskie)',
      'Witamina D ↑ (suplementacja)',
      'Omega-3 (działanie przeciwzapalne)',
      'Unikaj przetworzonej żywności',
      'Żelazo — monitoruj (częste niedobory)',
    ],
  },
  pcos: {
    name: 'PCOS',
    severity: 'high',
    guidelines: [
      'Niski IG (≤ 55)',
      'Dieta przeciwzapalna',
      'Inozytol — rozważ suplementację',
      'Omega-3 ↑',
      'Błonnik ≥ 25g/dzień',
      'Unikaj cukrów prostych',
      'Regularne posiłki',
    ],
  },
  nafld: {
    name: 'NAFLD / Stłuszczenie wątroby',
    severity: 'high',
    guidelines: [
      'Deficyt kaloryczny (jeśli nadwaga)',
      'Fruktoza — ograniczyć (soki, słodycze)',
      'Omega-3 ↑',
      'Witamina E ↑ (orzechy, oleje)',
      'Unikaj alkoholu',
      'Błonnik ↑',
    ],
  },
  liver_cirrhosis: {
    name: 'Marskość wątroby',
    severity: 'critical',
    guidelines: [
      'Białko 1.2-1.5 g/kg (chyba że encefalopatia)',
      'Sód < 2000 mg/dzień',
      'Małe, częste posiłki (5-6/dzień)',
      'Późna przekąska (przed snem)',
      'Bezwzględny zakaz alkoholu',
    ],
  },
  gout: {
    name: 'Dna moczanowa',
    severity: 'high',
    guidelines: [
      'Puryny < 150 mg/dzień',
      'Unikaj: podroby, piwo, owoce morza, sardynki',
      'Nawodnienie > 2.5 L/dzień',
      'Wiśnie / sok wiśniowy (działanie przeciwzapalne)',
      'Ograniczyć fruktozę',
      'Witamina C ↑',
    ],
  },
  ibs: {
    name: 'Zespół jelita drażliwego (IBS)',
    severity: 'moderate',
    guidelines: [
      'Dieta low-FODMAP (faza eliminacji → reintrodukcja)',
      'Unikaj: cebula, czosnek, pszenica, laktoza, jabłka',
      'Błonnik rozpuszczalny (owies, babka płesznik)',
      'Małe, regularne posiłki',
      'Probiotyki — rozważ suplementację',
      'Ograniczyć kofeinę i alkohol',
    ],
  },
  crohn: {
    name: 'Choroba Leśniowskiego-Crohna',
    severity: 'critical',
    guidelines: [
      'Faza zaostrzenia: dieta lekkostrawna, niskobłonnikowa',
      'Remisja: stopniowe wzbogacanie diety',
      'Białko ↑ (1.2-1.5 g/kg)',
      'Witamina D, B12, żelazo — monitoruj',
      'Unikaj surowych warzyw w zaostrzeniu',
    ],
  },
  ulcerative_colitis: {
    name: 'Wrzodziejące zapalenie jelita grubego',
    severity: 'critical',
    guidelines: [
      'Faza zaostrzenia: dieta lekkostrawna',
      'Remisja: dieta śródziemnomorska',
      'Białko ↑',
      'Omega-3 (działanie przeciwzapalne)',
      'Żelazo, kwas foliowy — monitoruj',
    ],
  },
  ckd_1_3: {
    name: 'Przewlekła choroba nerek (st. 1-3)',
    severity: 'high',
    guidelines: [
      'Białko 0.8-1.0 g/kg',
      'Sód < 2300 mg/dzień',
      'Fosfor — umiarkowane ograniczenie',
      'Potas — monitoruj',
      'Nawodnienie — wg zaleceń nefrologa',
    ],
  },
  ckd_4_5: {
    name: 'Przewlekła choroba nerek (st. 4-5)',
    severity: 'critical',
    guidelines: [
      'Białko ≤ 0.6-0.8 g/kg',
      'Potas < 2000 mg/dzień',
      'Fosfor < 800 mg/dzień',
      'Sód < 2000 mg/dzień',
      'Płyny — ograniczenie wg nefrologa',
      'Suplementacja witaminy D',
    ],
  },
  obesity: {
    name: 'Otyłość',
    severity: 'high',
    guidelines: [
      'Deficyt kaloryczny 500-750 kcal/dzień',
      'Białko ≥ 1.2 g/kg docelowej masy ciała',
      'Błonnik ≥ 25g/dzień (sytość)',
      'Unikaj przetworzonej żywności i cukrów',
      'Regularne posiłki (nie pomijać)',
    ],
  },
  metabolic_syndrome: {
    name: 'Zespół metaboliczny',
    severity: 'high',
    guidelines: [
      'Niski IG',
      'Dieta śródziemnomorska / DASH',
      'Tłuszcze nasycone < 7%',
      'Sód < 2300 mg/dzień',
      'Błonnik ≥ 25g/dzień',
      'Omega-3 ↑',
    ],
  },
  atherosclerosis: {
    name: 'Miażdżyca',
    severity: 'high',
    guidelines: [
      'Dieta śródziemnomorska',
      'Tłuszcze nasycone < 7%',
      'Omega-3 ↑ (ryby 2-3x/tydzień)',
      'Błonnik ≥ 30g/dzień',
      'Antyoksydanty (warzywa, owoce)',
    ],
  },
  hepatitis_chronic: {
    name: 'Przewlekłe zapalenie wątroby',
    severity: 'high',
    guidelines: [
      'Białko 1.0-1.5 g/kg',
      'Unikaj alkoholu',
      'Antyoksydanty ↑ (witamina E, C)',
      'Omega-3 (działanie przeciwzapalne)',
      'Unikaj przetworzonej żywności',
    ],
  },
};

// ─── Allergen code → human-readable name ─────────────────────────────────────

const ALLERGEN_NAMES: Record<string, string> = {
  gluten: 'Gluten',
  crustaceans: 'Skorupiaki',
  eggs: 'Jaja',
  fish: 'Ryby',
  peanuts: 'Orzeszki ziemne',
  soy: 'Soja',
  milk: 'Mleko / Laktoza',
  nuts: 'Orzechy',
  celery: 'Seler',
  mustard: 'Gorczyca',
  sesame: 'Sezam',
  sulphites: 'Siarczyny',
  lupin: 'Łubin',
  molluscs: 'Mięczaki',
  lactose: 'Laktoza',
};

// ─── Main service ─────────────────────────────────────────────────────────────

export async function getDietToolkit(patientId: string, requesterId: string, requesterRole: string) {
  // Access control
  if (requesterRole === 'DIETITIAN') {
    const patientCheck = await prisma.patient.findFirst({
      where: { id: patientId },
      select: { dietitianId: true },
    });
    if (!patientCheck || (patientCheck.dietitianId !== null && patientCheck.dietitianId !== requesterId)) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }
  }

  // Fetch all data in parallel
  const [patient, interview, nutritionTargets, notes, redFlags, policyRules] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
      },
    }),
    prisma.interview.findFirst({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.nutritionTargets.findUnique({
      where: { patientId },
    }),
    prisma.dietitianNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        dietitian: { select: { id: true, email: true } },
      },
    }),
    prisma.clinicalRule.findMany({
      where: { isActive: true, type: 'RED_FLAG' },
      orderBy: { priority: 'desc' },
    }),
    prisma.clinicalRule.findMany({
      where: { isActive: true, type: 'POLICY' },
      orderBy: { priority: 'desc' },
    }),
  ]);

  if (!patient) {
    throw new AppError(404, 'NOT_FOUND', 'Patient not found');
  }

  // Decrypt interview data
  const answers = interview
    ? (decryptJson(interview.answers) as Record<string, unknown>)
    : null;
  const medicalFlags = interview?.medicalFlags
    ? (decryptJson(interview.medicalFlags) as Record<string, unknown>)
    : null;

  // Extract key patient info
  const currentYear = new Date().getFullYear();
  const age = patient.birthYear ? currentYear - patient.birthYear : null;
  const weightKg = patient.weightKg ? Number(patient.weightKg) : null;
  const heightCm = patient.heightCm ?? null;
  const bmi = weightKg && heightCm
    ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10
    : null;

  // Extract chronic diseases and build guidelines
  const chronicDiseases = extractStringArray(answers, 'chronicDiseases');
  const diseaseGuidelines = chronicDiseases
    .map((code) => {
      const info = DISEASE_GUIDELINES[code];
      if (!info) return { code, name: code, severity: 'moderate' as const, guidelines: [] };
      return { code, ...info };
    })
    .filter((d) => d.guidelines.length > 0);

  // Extract allergens
  const allergens = extractStringArray(answers, 'allergies');
  const allergenDetails = allergens.map((code) => ({
    code,
    name: ALLERGEN_NAMES[code] ?? code,
  }));

  // Extract diet type and goal
  const dietType = (answers?.dietType as string) ?? null;
  const mainGoal = (answers?.mainGoal as string) ?? null;

  return {
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      sex: patient.sex,
      age,
      weightKg,
      heightCm,
      bmi,
    },
    dietType,
    mainGoal,
    nutritionTargets: nutritionTargets
      ? {
          targetKcal: nutritionTargets.targetKcal,
          targetProteinG: nutritionTargets.targetProteinG,
          targetFatG: nutritionTargets.targetFatG,
          targetCarbsG: nutritionTargets.targetCarbsG,
          bmr: nutritionTargets.bmr,
          tdee: nutritionTargets.tdee,
          activityLevel: nutritionTargets.activityLevel,
          goal: nutritionTargets.goal,
        }
      : null,
    chronicDiseases: diseaseGuidelines,
    allergens: allergenDetails,
    medicalFlags,
    recentNotes: notes.map((n) => ({
      id: n.id,
      content: decryptString(n.content),
      createdAt: n.createdAt,
      dietitianEmail: n.dietitian.email,
    })),
    policyEngine: await buildPolicyEngineResult(patientId, policyRules, redFlags),
  };
}

// ─── Policy engine per-patient matching ───────────────────────────────────────

async function buildPolicyEngineResult(
  patientId: string,
  policyRules: Array<{ id: string; name: string; description: string; severity: string; conditions: unknown; type: string }>,
  redFlags: Array<{ id: string; name: string; description: string; severity: string; conditions: unknown; type: string }>,
) {
  const ctx = await buildPatientContext(patientId);

  if (!ctx) {
    // No interview/targets — can't evaluate
    return {
      totalPolicies: policyRules.length,
      matchedPolicies: 0,
      matchedPolicyNames: [] as string[],
      totalRedFlags: redFlags.length,
      matchedRedFlags: 0,
      matchedRedFlagDetails: [] as Array<{ name: string; severity: string; description: string }>,
    };
  }

  // Evaluate POLICY rules against patient context
  const matchedPolicies = policyRules.filter((rule) => {
    try {
      const conditions = rule.conditions as RuleCondition;
      return evaluateCondition(conditions, ctx);
    } catch {
      return false;
    }
  });

  // Evaluate RED_FLAG rules against patient context
  const matchedRedFlags = redFlags.filter((rule) => {
    try {
      const conditions = rule.conditions as RuleCondition;
      return evaluateCondition(conditions, ctx);
    } catch {
      return false;
    }
  });

  return {
    totalPolicies: policyRules.length,
    matchedPolicies: matchedPolicies.length,
    matchedPolicyNames: matchedPolicies.map((r) => r.name),
    totalRedFlags: redFlags.length,
    matchedRedFlags: matchedRedFlags.length,
    matchedRedFlagDetails: matchedRedFlags.map((r) => ({
      name: r.name,
      severity: r.severity,
      description: r.description,
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractStringArray(answers: Record<string, unknown> | null, field: string): string[] {
  if (!answers) return [];
  const val = answers[field];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}
