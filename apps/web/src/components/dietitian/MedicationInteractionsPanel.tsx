'use client';

import { useState, useEffect } from 'react';
import { Pill, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface NutrientConstraint {
  nutrient: string;
  type: 'AVOID' | 'LIMIT' | 'BOOST' | 'STABLE';
  slot?: string;
  note: string;
}

interface MatchedRule {
  medication: string;
  category: string;
  nutrientConstraints: NutrientConstraint[];
  warnings: string[];
}

interface MedicationInteractionsPanelProps {
  patientId: string;
  token: string;
}

const TYPE_COLORS: Record<string, string> = {
  AVOID: 'text-red-700 bg-red-50 border-red-300',
  LIMIT: 'text-amber-700 bg-amber-50 border-amber-300',
  BOOST: 'text-green-700 bg-green-50 border-green-300',
  STABLE: 'text-blue-700 bg-blue-50 border-blue-300',
};

const TYPE_LABELS: Record<string, string> = {
  AVOID: 'Unikaj',
  LIMIT: 'Ogranicz',
  BOOST: 'Zwiększ',
  STABLE: 'Stabilny',
};

const NUTRIENT_LABELS: Record<string, string> = {
  vitaminB12: 'Witamina B12',
  vitaminK: 'Witamina K',
  vitaminD: 'Witamina D',
  vitaminC: 'Witamina C',
  calcium: 'Wapń',
  iron: 'Żelazo',
  magnesium: 'Magnez',
  potassium: 'Potas',
  sodium: 'Sód',
  omega3: 'Omega-3',
  coQ10: 'Koenzym Q10',
  grapefruit: 'Grejpfrut',
  soy: 'Soja',
  tyramine: 'Tyramina',
  carbs: 'Węglowodany',
};

const MEDICATION_LABELS: Record<string, string> = {
  metformin: 'Metformina',
  metformina: 'Metformina',
  glucophage: 'Metformina (Glucophage)',
  siofor: 'Metformina (Siofor)',
  warfarin: 'Warfaryna',
  warfaryna: 'Warfaryna',
  acenokumarol: 'Acenokumarol',
  acenocoumarol: 'Acenokumarol',
  levothyroxine: 'Lewotyroksyna',
  lewotyroksyna: 'Lewotyroksyna',
  euthyrox: 'Lewotyroksyna (Euthyrox)',
  letrox: 'Lewotyroksyna (Letrox)',
  atorvastatin: 'Atorwastatyna',
  atorwastatyna: 'Atorwastatyna',
  rosuvastatin: 'Rosuwastatyna',
  rosuwastatyna: 'Rosuwastatyna',
  simvastatin: 'Simwastatyna',
  simwastatyna: 'Simwastatyna',
  statins: 'Statyny',
  statyny: 'Statyny',
  omeprazole: 'Omeprazol',
  omeprazol: 'Omeprazol',
  pantoprazol: 'Pantoprazol',
  pantoprazole: 'Pantoprazol',
  esomeprazol: 'Esomeprazol',
  ppi: 'Inhibitory pompy protonowej (PPI)',
  fluoxetine: 'Fluoksetyna',
  fluoksetyna: 'Fluoksetyna',
  sertraline: 'Sertralina',
  sertralina: 'Sertralina',
  citalopram: 'Citalopram',
  escitalopram: 'Escitalopram',
  antidepressants: 'Antydepresanty',
  antydepresanty: 'Antydepresanty',
  prednisone: 'Prednizon',
  prednizon: 'Prednizon',
  dexamethasone: 'Deksametazon',
  deksametazon: 'Deksametazon',
  glucocorticoids: 'Glikokortykosteroidy',
  glikokortykosteroidy: 'Glikokortykosteroidy',
  ramipril: 'Ramipril',
  lisinopril: 'Lisinopril',
  enalapril: 'Enalapryl',
  enalapryl: 'Enalapryl',
  perindopril: 'Perindopril',
  ace_inhibitors: 'Inhibitory ACE',
  insulin: 'Insulina',
  insulina: 'Insulina',
  beta_blockers: 'Beta-blokery',
  metoprolol: 'Metoprolol',
  bisoprolol: 'Bisoprolol',
  propranolol: 'Propranolol',
  nebivolol: 'Nebivolol',
  ibuprofen: 'Ibuprofen',
  nsaids: 'NLPZ',
  nlpz: 'NLPZ',
  naproxen: 'Naproksen',
  naproksen: 'Naproksen',
  diklofenak: 'Diklofenak',
  diclofenac: 'Diklofenak',
  diuretics: 'Diuretyki',
  diuretyki: 'Diuretyki',
  furosemid: 'Furosemid',
  furosemide: 'Furosemid',
  hydrochlorothiazide: 'Hydrochlorotiazyd',
  hydrochlorotiazyd: 'Hydrochlorotiazyd',
  spironolactone: 'Spironolakton',
  spironolakton: 'Spironolakton',
  lithium: 'Lit',
  lit: 'Lit',
};

export function MedicationInteractionsPanel({ patientId, token }: MedicationInteractionsPanelProps) {
  const [data, setData] = useState<{
    patientMedications: string[];
    matchedRules: MatchedRule[];
    allWarnings: string[];
    allConstraints: NutrientConstraint[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proxy/dietitian/patients/${patientId}/medication-interactions`)
      .then((r) => r.json())
      .then((res) => { if (res.ok) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId, token]);

  if (loading) return null;
  if (!data || data.matchedRules.length === 0) return null;

  return (
    <Card className="border-purple-200 bg-purple-50/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-800">
          <Pill className="h-4 w-4" />
          Interakcje lekowe ({data.matchedRules.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Patient medications */}
        <div className="flex flex-wrap gap-1">
          {data.patientMedications.map((med, i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-purple-300 text-purple-700">{MEDICATION_LABELS[med.toLowerCase()] ?? med}</Badge>
          ))}
        </div>

        {/* Warnings */}
        {data.allWarnings.length > 0 && (
          <div className="space-y-1">
            {data.allWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Nutrient constraints */}
        {data.allConstraints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">Zalecenia zywieniowe:</p>
            {data.allConstraints.map((c, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-border/50 bg-white px-3 py-2">
                <Badge variant="outline" className={`text-[10px] shrink-0 ${TYPE_COLORS[c.type]}`}>
                  {TYPE_LABELS[c.type]}
                </Badge>
                <div className="min-w-0">
                  <span className="text-xs font-medium">{NUTRIENT_LABELS[c.nutrient] ?? c.nutrient}</span>
                  {c.slot && <span className="text-[10px] text-muted-foreground ml-1">({c.slot})</span>}
                  <p className="text-[11px] text-muted-foreground">{c.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
