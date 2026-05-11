'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Code, LayoutGrid, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  VisualPlanEditor,
  planDataToContent,
  contentToPlanData,
  type PlanData,
} from '@/components/dietitian/VisualPlanEditor';

export default function NewManualPlanPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const t = useTranslations('dietitian.visualEditor');
  const tDetail = useTranslations('dietitian.planDetail');

  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonSaving, setJsonSaving] = useState(false);

  async function handleSave(data: PlanData) {
    const token = '';
    const content = planDataToContent(data.days);

    await api.dietPlans.createManual(
      patientId,
      {
        kcal: data.kcal,
        proteinG: data.proteinG,
        fatG: data.fatG,
        carbsG: data.carbsG,
        content,
      },
      token
    );

    router.push(`/dietetyk/pacjenci/${patientId}`);
    router.refresh();
  }

  async function handleJsonSave() {
    setJsonError('');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      setJsonError(tDetail('jsonParseError'));
      return;
    }

    const days = parsed.days as unknown[] | undefined;
    if (!Array.isArray(days) || days.length !== 7) {
      setJsonError(tDetail('jsonMissingDays'));
      return;
    }

    // Calculate macros
    const parsedDays = contentToPlanData(parsed);
    let kcal = 0;
    let proteinG = 0;
    let fatG = 0;
    let carbsG = 0;

    if (parsedDays) {
      parsed = planDataToContent(parsedDays);
      for (const day of parsedDays) {
        for (const meal of day.meals) {
          for (const item of meal.items) {
            kcal += item.kcal || 0;
            proteinG += item.protein || 0;
            fatG += item.fat || 0;
            carbsG += item.carbs || 0;
          }
        }
      }
      const numDays = parsedDays.length || 1;
      kcal = Math.round(kcal / numDays);
      proteinG = Math.round(proteinG / numDays);
      fatG = Math.round(fatG / numDays);
      carbsG = Math.round(carbsG / numDays);
    }

    setJsonSaving(true);
    try {
      const token = '';
      await api.dietPlans.createManual(
        patientId,
        { kcal, proteinG, fatG, carbsG, content: parsed },
        token
      );
      router.push(`/dietetyk/pacjenci/${patientId}`);
      router.refresh();
    } catch {
      setJsonError(tDetail('saveError'));
    } finally {
      setJsonSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href={`/dietetyk/pacjenci/${patientId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToPatient')}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('createTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('createDescription')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setJsonMode(!jsonMode); setJsonError(''); }}
          className="gap-1.5 shrink-0"
        >
          {jsonMode ? (
            <><LayoutGrid className="h-3.5 w-3.5" />{tDetail('visualMode')}</>
          ) : (
            <><Code className="h-3.5 w-3.5" />{tDetail('jsonMode')}</>
          )}
        </Button>
      </div>

      {jsonMode ? (
        <div className="space-y-4">
          <Textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
            className="font-mono text-xs min-h-[400px] resize-y"
            placeholder={'{\n  "days": [\n    {\n      "day": "Poniedziałek",\n      "meals": [...]\n    }\n  ]\n}'}
            rows={20}
          />
          {jsonError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {jsonError}
            </div>
          )}
          <Button onClick={handleJsonSave} disabled={jsonSaving} className="w-full" size="lg">
            {jsonSaving ? t('creating') : t('createPlan')}
          </Button>
        </div>
      ) : (
        <VisualPlanEditor
          onSave={handleSave}
          saveLabel={t('createPlan')}
          savingLabel={t('creating')}
        />
      )}
    </div>
  );
}
