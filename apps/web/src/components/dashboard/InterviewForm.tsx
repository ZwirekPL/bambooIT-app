'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { sanitizePii } from '@/utils/pii';
import { ConflictModal, type PreCheckConflict } from './ConflictModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterviewAnswers {
  // Step 1
  mainGoal: string;
  currentWeightKg?: string;
  targetWeightKg?: string;
  timeline: string;
  // Step 2
  activityLevel: string;
  activityTypes: string[];
  activityTypesOther?: string;
  workoutsPerWeek?: string;
  workoutDurationMin?: string;
  // Step 3
  chronicDiseases: string[];
  chronicDiseasesOther?: string;
  medications: string[];
  medicationsOther?: string;
  digestiveIssues: string[];
  // Step 4
  allergies: string[];
  intolerances: string[];
  dislikes?: string; // kept for backward-compat pre-fill
  dislikedFoods: string[];
  dislikedFoodsOther?: string;
  preferredFoods: string[];
  preferredFoodsOther?: string;
  dietType: string;
  cuisinePreferences: string[];
  // Step 5
  mealsPerDay: string;
  cookingTime: string;
  budget: string;
  additionalNotes?: string;
  supplements: string[];
  supplementsOther?: string;
  firstMealTime?: string;
  lastMealTime?: string;
  eatsAtNight?: string;
  alcoholFrequency?: string;
  workType?: string;
  mainMealAt?: string;
  // Step 6
  pregnancyStatus?: string;
  pregnancyTrimester?: string;     // conditional: pregnancyStatus === 'pregnant' (IW-14): '1' | '2' | '3'
  hormonalIssues?: string[];
  stressLevel?: string;
  sleepHours?: string;
  // Step 3 — conditional clinical fields
  hba1c?: string;                  // conditional: diabetes_t1 or diabetes_t2
  egfr?: string;                   // conditional: ckd_stage_1_3 or ckd_stage_4_5
  ckdStadium?: string;             // conditional: ckd_stage_1_3 or ckd_stage_4_5 (IW-13)
}

const INITIAL: InterviewAnswers = {
  mainGoal: '',
  currentWeightKg: '',
  targetWeightKg: '',
  timeline: '',
  activityLevel: '',
  activityTypes: [],
  activityTypesOther: '',
  workoutsPerWeek: '',
  workoutDurationMin: '',
  chronicDiseases: [],
  chronicDiseasesOther: '',
  medications: [],
  medicationsOther: '',
  digestiveIssues: [],
  allergies: [],
  intolerances: [],
  dislikes: '',
  dislikedFoods: [],
  dislikedFoodsOther: '',
  preferredFoods: [],
  preferredFoodsOther: '',
  dietType: '',
  cuisinePreferences: [],
  mealsPerDay: '',
  cookingTime: '',
  budget: '',
  additionalNotes: '',
  supplements: [],
  supplementsOther: '',
  firstMealTime: '',
  lastMealTime: '',
  eatsAtNight: '',
  alcoholFrequency: '',
  workType: '',
  mainMealAt: '',
  pregnancyStatus: '',
  pregnancyTrimester: '',
  hormonalIssues: [],
  stressLevel: '',
  sleepHours: '',
  hba1c: '',
  egfr: '',
  ckdStadium: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SELECT_CLASS =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(({ value, label }) => {
        const checked = selected.includes(value);
        return (
          <label
            key={value}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-3 md:py-2.5 cursor-pointer text-base md:text-sm transition-colors min-h-[44px]',
              checked
                ? 'border-sage-400 bg-sage-50 text-sage-900'
                : 'border-input bg-background hover:bg-muted/50'
            )}
          >
            <input
              type="checkbox"
              className="accent-sage-600 h-4 w-4 rounded shrink-0"
              checked={checked}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

function NoneExclusiveGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const noneChecked = selected.includes('none');
  const hasOther = selected.some((v) => v !== 'none');

  function toggle(value: string) {
    if (value === 'none') {
      onChange(noneChecked ? [] : ['none']);
      return;
    }
    const withoutNone = selected.filter((v) => v !== 'none');
    if (withoutNone.includes(value)) {
      onChange(withoutNone.filter((v) => v !== value));
    } else {
      onChange([...withoutNone, value]);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(({ value, label }) => {
        const checked = selected.includes(value);
        const isNoneOption = value === 'none';
        const disabled = isNoneOption ? hasOther : noneChecked;
        return (
          <label
            key={value}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-3 md:py-2.5 text-base md:text-sm transition-colors min-h-[44px]',
              disabled
                ? 'cursor-not-allowed opacity-40 border-input bg-background'
                : checked
                  ? 'cursor-pointer border-sage-400 bg-sage-50 text-sage-900'
                  : 'cursor-pointer border-input bg-background hover:bg-muted/50'
            )}
          >
            <input
              type="checkbox"
              className="accent-sage-600 h-4 w-4 rounded shrink-0"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        );
      })}
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function getWeightError(form: InterviewAnswers, t: ReturnType<typeof useTranslations<'dashboard.interview'>>): string | null {
  const current = parseFloat((form.currentWeightKg ?? '').replace(',', '.'));
  const target = parseFloat((form.targetWeightKg ?? '').replace(',', '.'));
  if (!form.currentWeightKg || isNaN(current) || isNaN(target) || target < 10) return null;
  if (form.mainGoal === 'lose_weight' && target >= current) return t('errorTargetTooHigh');
  if (form.mainGoal === 'gain_muscle' && target <= current) return t('errorTargetTooLow');
  return null;
}

function Step1({ form, onChange }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void }) {
  const t = useTranslations('dashboard.interview');
  const showTarget = ['lose_weight', 'gain_muscle'].includes(form.mainGoal);
  const weightError = showTarget ? getWeightError(form, t) : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="mainGoal">{t('mainGoal')} *</Label>
        <select
          id="mainGoal"
          value={form.mainGoal}
          onChange={(e) => onChange({ mainGoal: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('mainGoalPlaceholder')}</option>
          <option value="lose_weight">{t('mainGoalLoseWeight')}</option>
          <option value="gain_muscle">{t('mainGoalGainMuscle')}</option>
          <option value="maintain_weight">{t('mainGoalMaintain')}</option>
          <option value="improve_health">{t('mainGoalHealth')}</option>
          <option value="other">{t('mainGoalOther')}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentWeightKg">{t('currentWeightKg')}</Label>
        <Input
          id="currentWeightKg"
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={form.currentWeightKg}
          onChange={(e) => onChange({ currentWeightKg: e.target.value })}
          placeholder={t('currentWeightKgPlaceholder')}
        />
      </div>

      {showTarget && (
        <div className="space-y-2">
          <Label htmlFor="targetWeightKg">{t('targetWeightKg')}</Label>
          <Input
            id="targetWeightKg"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={form.targetWeightKg}
            onChange={(e) => onChange({ targetWeightKg: e.target.value })}
            placeholder={t('targetWeightKgPlaceholder')}
            className={weightError ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {weightError && (
            <p className="text-sm text-destructive">{weightError}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="timeline">{t('timeline')} *</Label>
        <select
          id="timeline"
          value={form.timeline}
          onChange={(e) => onChange({ timeline: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('timelinePlaceholder')}</option>
          <option value="1_month">{t('timeline1Month')}</option>
          <option value="3_months">{t('timeline3Months')}</option>
          <option value="6_months">{t('timeline6Months')}</option>
          <option value="no_deadline">{t('timelineNoDeadline')}</option>
        </select>
      </div>
    </div>
  );
}

function Step2({ form, onChange, dirty }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void; dirty: boolean }) {
  const t = useTranslations('dashboard.interview');

  const activityTypeOptions = [
    { value: 'walking', label: t('activityTypeWalking') },
    { value: 'running', label: t('activityTypeRunning') },
    { value: 'gym', label: t('activityTypeGym') },
    { value: 'cycling', label: t('activityTypeCycling') },
    { value: 'swimming', label: t('activityTypeSwimming') },
    { value: 'yoga', label: t('activityTypeYoga') },
    { value: 'ball_sports', label: t('activityTypeBallSports') },
    { value: 'cycling_recreational', label: t('activityTypeCyclingRecreational') },
    { value: 'crossfit', label: t('activityTypeCrossfit') },
    { value: 'calisthenics', label: t('activityTypeCalisthenics') },
    { value: 'zumba', label: t('activityTypeZumba') },
    { value: 'football', label: t('activityTypeFootball') },
    { value: 'basketball', label: t('activityTypeBasketball') },
    { value: 'volleyball', label: t('activityTypeVolleyball') },
    { value: 'tennis', label: t('activityTypeTennis') },
    { value: 'other', label: t('activityTypeOther') },
  ];

  const showOtherActivity = form.activityTypes.includes('other');
  const hasActivityTypes = form.activityTypes.length > 0;

  const workoutsNum = parseInt(form.workoutsPerWeek ?? '', 10);
  const workoutsPerWeekError = hasActivityTypes && form.workoutsPerWeek !== undefined && form.workoutsPerWeek !== ''
    ? (isNaN(workoutsNum) || workoutsNum < 1 || workoutsNum > 14 ? t('errorWorkoutsPerWeekInvalid') : null)
    : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="activityLevel">{t('activityLevel')} *</Label>
        <select
          id="activityLevel"
          value={form.activityLevel}
          onChange={(e) => onChange({ activityLevel: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('activityLevelPlaceholder')}</option>
          <option value="sedentary">{t('activitySedentary')}</option>
          <option value="light">{t('activityLight')}</option>
          <option value="moderate">{t('activityModerate')}</option>
          <option value="active">{t('activityActive')}</option>
          <option value="very_active">{t('activityVeryActive')}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>{t('activityTypes')}</Label>
        <CheckboxGroup
          options={activityTypeOptions}
          selected={form.activityTypes}
          onChange={(v) => {
            const patch: Partial<InterviewAnswers> = { activityTypes: v };
            if (v.length === 0) {
              patch.workoutsPerWeek = '';
              patch.workoutDurationMin = '';
            }
            onChange(patch);
          }}
        />
      </div>

      {showOtherActivity && (
        <div className="space-y-2">
          <Label htmlFor="activityTypesOther">{t('activityTypesOther')}</Label>
          <Input
            id="activityTypesOther"
            type="text"
            value={form.activityTypesOther}
            onChange={(e) => onChange({ activityTypesOther: e.target.value })}
            placeholder={t('activityTypesOtherPlaceholder')}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="workoutsPerWeek">
          {t('workoutsPerWeek')} {hasActivityTypes && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="workoutsPerWeek"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.workoutsPerWeek}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            onChange({ workoutsPerWeek: raw });
          }}
          placeholder={t('workoutsPerWeekPlaceholder')}
          className={dirty && workoutsPerWeekError ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        {dirty && workoutsPerWeekError && (
          <p className="text-sm text-destructive">{workoutsPerWeekError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="workoutDurationMin">
          {t('workoutDurationMin')} {hasActivityTypes && <span className="text-destructive">*</span>}
        </Label>
        <select
          id="workoutDurationMin"
          value={form.workoutDurationMin}
          onChange={(e) => onChange({ workoutDurationMin: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('workoutDurationMinPlaceholder')}</option>
          <option value="30">{t('workoutDuration30')}</option>
          <option value="45">{t('workoutDuration45')}</option>
          <option value="60">{t('workoutDuration60')}</option>
          <option value="90">{t('workoutDuration90')}</option>
          <option value="120">{t('workoutDuration120')}</option>
        </select>
      </div>
    </div>
  );
}

function Step3({ form, onChange, dirty }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void; dirty: boolean }) {
  const t = useTranslations('dashboard.interview');

  const medicationOptions = [
    { value: 'none', label: t('medicationsNone') },
    { value: 'metformin', label: t('medicationMetformin') },
    { value: 'insulin', label: t('medicationInsulin') },
    { value: 'statins', label: t('medicationStatins') },
    { value: 'ppi', label: t('medicationPpi') },
    { value: 'warfarin', label: t('medicationWarfarin') },
    { value: 'levothyroxine', label: t('medicationLevothyroxine') },
    { value: 'diuretics', label: t('medicationDiuretics') },
    { value: 'ace_inhibitors', label: t('medicationAce') },
    { value: 'beta_blockers', label: t('medicationBetaBlockers') },
    { value: 'nsaids', label: t('medicationNsaids') },
    { value: 'antidepressants', label: t('medicationAntidepressants') },
    { value: 'glucocorticoids', label: t('medicationGlucocorticoids') },
    { value: 'other_meds', label: t('medicationOtherMeds') },
  ];

  const digestiveOptions = [
    { value: 'none', label: t('digestiveNone') },
    { value: 'gerd', label: t('digestiveGERD') },
    { value: 'ibs_c', label: t('digestiveIbsC') },
    { value: 'ibs_d', label: t('digestiveIbsD') },
    { value: 'ibs_m', label: t('digestiveIbsM') },
    { value: 'celiac', label: t('digestiveCeliac') },
    { value: 'crohn', label: t('digestiveCrohn') },
    { value: 'uc', label: t('digestiveUc') },
    { value: 'sibo', label: t('digestiveSibo') },
    { value: 'constipation', label: t('digestiveConstipation') },
    { value: 'chronic_diarrhea', label: t('digestiveChronicDiarrhea') },
    { value: 'other', label: t('digestiveOther') },
  ];

  const showOtherDisease = form.chronicDiseases.includes('other');
  const showMedicationsOther = form.medications.includes('other_meds') && !form.medications.includes('none');

  const chronicDiseasesEmpty = form.chronicDiseases.length === 0;
  const digestiveEmpty = form.digestiveIssues.length === 0;
  const medicationsEmpty = form.medications.length === 0;

  // Grouped chronic disease options
  const groups: { labelKey: string; options: { value: string; labelKey: string }[] }[] = [
    {
      labelKey: 'chronicDiseaseGroupMetabolic',
      options: [
        { value: 'diabetes_t1', labelKey: 'chronicDiseaseDiabetesT1' },
        { value: 'diabetes_t2', labelKey: 'chronicDiseaseDiabetesT2' },
        { value: 'insulin_resistance', labelKey: 'chronicDiseaseInsulinResistance' },
        { value: 'obesity', labelKey: 'chronicDiseaseObesity' },
        { value: 'metabolic_syndrome', labelKey: 'chronicDiseaseMetabolicSyndrome' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupCardio',
      options: [
        { value: 'hypertension', labelKey: 'chronicDiseaseHypertension' },
        { value: 'chd', labelKey: 'chronicDiseaseChd' },
        { value: 'heart_failure', labelKey: 'chronicDiseaseHeartFailure' },
        { value: 'hypercholesterolemia', labelKey: 'chronicDiseaseHypercholesterolemia' },
        { value: 'atherosclerosis', labelKey: 'chronicDiseaseAtherosclerosis' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupThyroid',
      options: [
        { value: 'hypothyroidism', labelKey: 'chronicDiseaseHypothyroidism' },
        { value: 'hyperthyroidism', labelKey: 'chronicDiseaseHyperthyroidism' },
        { value: 'hashimoto', labelKey: 'chronicDiseaseHashimoto' },
        { value: 'pcos', labelKey: 'chronicDiseasePcos' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupLiver',
      options: [
        { value: 'nafld', labelKey: 'chronicDiseaseNafld' },
        { value: 'liver_cirrhosis', labelKey: 'chronicDiseaseLiverCirrhosis' },
        { value: 'hepatitis_chronic', labelKey: 'chronicDiseaseHepatitisC' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupKidney',
      options: [
        { value: 'ckd_stage_1_3', labelKey: 'chronicDiseaseCkd13' },
        { value: 'ckd_stage_4_5', labelKey: 'chronicDiseaseCkd45' },
        { value: 'nephrolithiasis', labelKey: 'chronicDiseaseNephrolithiasis' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupBones',
      options: [
        { value: 'osteoporosis', labelKey: 'chronicDiseaseOsteoporosis' },
        { value: 'gout', labelKey: 'chronicDiseaseGout' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupOncology',
      options: [
        { value: 'cancer_active', labelKey: 'chronicDiseaseCancerActive' },
        { value: 'cancer_remission', labelKey: 'chronicDiseaseCancerRemission' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupEating',
      options: [
        { value: 'anorexia_nervosa', labelKey: 'chronicDiseaseAnorexia' },
        { value: 'bulimia_nervosa', labelKey: 'chronicDiseaseBulimia' },
        { value: 'binge_eating', labelKey: 'chronicDiseaseBingeEating' },
      ],
    },
    {
      labelKey: 'chronicDiseaseGroupOther',
      options: [
        { value: 'copd', labelKey: 'chronicDiseaseCopd' },
        { value: 'sleep_apnea', labelKey: 'chronicDiseaseSleepApnea' },
        { value: 'anemia', labelKey: 'chronicDiseaseAnemia' },
        { value: 'other', labelKey: 'chronicDiseaseOther' },
      ],
    },
  ];

  function toggleDisease(value: string) {
    if (value === 'none') {
      onChange({ chronicDiseases: form.chronicDiseases.includes('none') ? [] : ['none'] });
      return;
    }
    const withoutNone = form.chronicDiseases.filter((v) => v !== 'none');
    if (withoutNone.includes(value)) {
      onChange({ chronicDiseases: withoutNone.filter((v) => v !== value) });
    } else {
      onChange({ chronicDiseases: [...withoutNone, value] });
    }
  }

  return (
    <div className="space-y-5">
      {/* Chronic diseases grouped */}
      <div className="space-y-2">
        <Label>{t('chronicDiseases')} <span className="text-destructive">*</span></Label>
        {/* None option */}
        {(() => {
          const hasDisease = form.chronicDiseases.some((v) => v !== 'none');
          const noneChecked = form.chronicDiseases.includes('none');
          return (
            <>
              <label
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-3 md:py-2.5 text-base md:text-sm transition-colors min-h-[44px]',
                  hasDisease
                    ? 'cursor-not-allowed opacity-40 border-input bg-background'
                    : noneChecked
                      ? 'cursor-pointer border-sage-400 bg-sage-50 text-sage-900'
                      : 'cursor-pointer border-input bg-background hover:bg-muted/50'
                )}
              >
                <input
                  type="checkbox"
                  className="accent-sage-600 h-4 w-4 rounded shrink-0"
                  checked={noneChecked}
                  disabled={hasDisease}
                  onChange={() => toggleDisease('none')}
                />
                {t('chronicDiseasesNone')}
              </label>

              {groups.map((group) => (
                <fieldset key={group.labelKey} className="space-y-1">
                  <p className="font-medium text-sm text-muted-foreground mt-3 mb-1">{t(group.labelKey as Parameters<typeof t>[0])}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map(({ value, labelKey }) => {
                      const checked = form.chronicDiseases.includes(value);
                      const label = t(labelKey as Parameters<typeof t>[0]);
                      return (
                        <label
                          key={value}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-3 md:py-2.5 text-base md:text-sm transition-colors min-h-[44px]',
                            noneChecked
                              ? 'cursor-not-allowed opacity-40 border-input bg-background'
                              : checked
                                ? 'cursor-pointer border-sage-400 bg-sage-50 text-sage-900'
                                : 'cursor-pointer border-input bg-background hover:bg-muted/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="accent-sage-600 h-4 w-4 rounded shrink-0"
                            checked={checked}
                            disabled={noneChecked}
                            onChange={() => toggleDisease(value)}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </>
          );
        })()}
      </div>

      {dirty && chronicDiseasesEmpty && (
        <p className="text-sm text-destructive">{t('errorChronicDiseasesRequired')}</p>
      )}

      {showOtherDisease && (
        <div className="space-y-2">
          <Label htmlFor="chronicDiseasesOther">{t('chronicDiseasesOther')}</Label>
          <textarea
            id="chronicDiseasesOther"
            value={form.chronicDiseasesOther}
            onChange={(e) => onChange({ chronicDiseasesOther: e.target.value })}
            placeholder={t('chronicDiseasesOtherPlaceholder')}
            rows={2}
            maxLength={300}
            className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
          />
          <CharCounter value={form.chronicDiseasesOther ?? ''} max={300} />
        </div>
      )}

      {/* Conditional: HbA1c for diabetes */}
      {(form.chronicDiseases.includes('diabetes_t1') || form.chronicDiseases.includes('diabetes_t2')) && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <Label htmlFor="hba1c" className="text-amber-900 font-medium">
            {t('hba1cLabel')}
          </Label>
          <input
            id="hba1c"
            type="number"
            min="3"
            max="20"
            step="0.1"
            value={form.hba1c ?? ''}
            onChange={(e) => onChange({ hba1c: e.target.value })}
            placeholder={t('hba1cPlaceholder')}
            className={cn(SELECT_CLASS, 'max-w-[160px]')}
          />
          <p className="text-xs text-amber-700">{t('hba1cHint')}</p>
        </div>
      )}

      {/* Conditional: eGFR + stadium for CKD (IW-13) */}
      {(form.chronicDiseases.includes('ckd_stage_1_3') || form.chronicDiseases.includes('ckd_stage_4_5')) && (
        <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="ckdStadium" className="text-blue-900 font-medium">
              {t('ckdStadiumLabel')}
            </Label>
            <select
              id="ckdStadium"
              value={form.ckdStadium ?? ''}
              onChange={(e) => onChange({ ckdStadium: e.target.value })}
              className={cn(SELECT_CLASS, 'max-w-[200px]')}
            >
              <option value="">{t('ckdStadiumPlaceholder')}</option>
              <option value="1">{t('ckdStadium1')}</option>
              <option value="2">{t('ckdStadium2')}</option>
              <option value="3">{t('ckdStadium3')}</option>
              <option value="4">{t('ckdStadium4')}</option>
              <option value="5">{t('ckdStadium5')}</option>
            </select>
            <p className="text-xs text-blue-700">{t('ckdStadiumHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="egfr" className="text-blue-900 font-medium">
              {t('egfrLabel')}
            </Label>
            <input
              id="egfr"
              type="number"
              min="1"
              max="150"
              step="1"
              value={form.egfr ?? ''}
              onChange={(e) => onChange({ egfr: e.target.value })}
              placeholder={t('egfrPlaceholder')}
              className={cn(SELECT_CLASS, 'max-w-[160px]')}
            />
            <p className="text-xs text-blue-700">{t('egfrHint')}</p>
          </div>
        </div>
      )}

      {/* Medications as checkboxes */}
      <div className="space-y-2">
        <Label>{t('medicationsSection')} <span className="text-destructive">*</span></Label>
        <NoneExclusiveGroup
          options={medicationOptions}
          selected={form.medications}
          onChange={(v) => onChange({ medications: v })}
        />
        {dirty && medicationsEmpty && (
          <p className="text-sm text-destructive">{t('errorMedicationsRequired')}</p>
        )}
      </div>

      {showMedicationsOther && (
        <div className="space-y-2">
          <Label htmlFor="medicationsOther">{t('medicationsOther')}</Label>
          <textarea
            id="medicationsOther"
            value={form.medicationsOther}
            onChange={(e) => onChange({ medicationsOther: e.target.value })}
            placeholder={t('medicationsOtherPlaceholder')}
            rows={2}
            maxLength={500}
            className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
          />
          <CharCounter value={form.medicationsOther ?? ''} max={500} />
        </div>
      )}

      {/* Digestive issues */}
      <div className="space-y-2">
        <Label>{t('digestiveIssues')} <span className="text-destructive">*</span></Label>
        <NoneExclusiveGroup
          options={digestiveOptions}
          selected={form.digestiveIssues}
          onChange={(v) => onChange({ digestiveIssues: v })}
        />
        {dirty && digestiveEmpty && (
          <p className="text-sm text-destructive">{t('errorDigestiveRequired')}</p>
        )}
      </div>
    </div>
  );
}

function Step4({ form, onChange }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void }) {
  const t = useTranslations('dashboard.interview');

  // EU 14 allergens + none
  const allergyOptions = [
    { value: 'none', label: t('allergiesNone') },
    { value: 'gluten', label: t('allergyGluten') },
    { value: 'milk', label: t('allergyMilk') },
    { value: 'eggs', label: t('allergyEggs') },
    { value: 'nuts', label: t('allergyNuts') },
    { value: 'peanuts', label: t('allergyPeanuts') },
    { value: 'fish', label: t('allergyFish') },
    { value: 'shellfish', label: t('allergyShellfish') },
    { value: 'soy', label: t('allergySoy') },
    { value: 'celery', label: t('allergyCelery') },
    { value: 'mustard', label: t('allergyMustard') },
    { value: 'sesame', label: t('allergySesame') },
    { value: 'sulphites', label: t('allergySulphites') },
    { value: 'lupin', label: t('allergyLupin') },
    { value: 'molluscs', label: t('allergyMolluscs') },
  ];

  const intoleranceOptions = [
    { value: 'none', label: t('intolerancesNone') },
    { value: 'lactose_intolerance', label: t('intoleranceLactose') },
    { value: 'fructose_intolerance', label: t('intoleranceFructose') },
    { value: 'histamine_intolerance', label: t('intoleranceHistamine') },
    { value: 'ncgs', label: t('intoleranceNcgs') },
  ];

  const dislikedFoodsOptions = [
    { value: 'brocoli_cauliflower', label: t('dislikedBroccoliCauliflower') },
    { value: 'offal', label: t('dislikedOffal') },
    { value: 'fish_general', label: t('dislikedFishGeneral') },
    { value: 'seafood', label: t('dislikedSeafood') },
    { value: 'mushrooms', label: t('dislikedMushrooms') },
    { value: 'onion_garlic', label: t('dislikedOnionGarlic') },
    { value: 'beets', label: t('dislikedBeets') },
    { value: 'cabbage', label: t('dislikedCabbage') },
    { value: 'cottage_cheese', label: t('dislikedCottageCheese') },
    { value: 'tofu_tempeh', label: t('dislikedTofuTempeh') },
    { value: 'eggs', label: t('dislikedEggs') },
    { value: 'spicy_food', label: t('dislikedSpicyFood') },
    { value: 'quinoa_amaranth', label: t('dislikedQuinoaAmaranth') },
    { value: 'avocado', label: t('dislikedAvocado') },
    { value: 'raw_spinach', label: t('dislikedRawSpinach') },
    { value: 'other', label: t('dislikedOther') },
  ];

  const preferredFoodsOptions = [
    { value: 'poultry', label: t('preferredPoultry') },
    { value: 'beef_pork', label: t('preferredBeefPork') },
    { value: 'fish', label: t('preferredFish') },
    { value: 'seafood', label: t('preferredSeafood') },
    { value: 'eggs', label: t('preferredEggs') },
    { value: 'legumes', label: t('preferredLegumes') },
    { value: 'tofu_tempeh', label: t('preferredTofuTempeh') },
    { value: 'rice_groats', label: t('preferredRiceGroats') },
    { value: 'pasta', label: t('preferredPasta') },
    { value: 'potatoes', label: t('preferredPotatoes') },
    { value: 'bread', label: t('preferredBread') },
    { value: 'oatmeal', label: t('preferredOatmeal') },
    { value: 'salads_raw', label: t('preferredSaladsRaw') },
    { value: 'cooked_veg', label: t('preferredCookedVeg') },
    { value: 'fruits', label: t('preferredFruits') },
    { value: 'dairy', label: t('preferredDairy') },
    { value: 'nuts_seeds', label: t('preferredNutsSeeds') },
    { value: 'smoothies', label: t('preferredSmoothies') },
    { value: 'soups', label: t('preferredSoups') },
  ];

  // P0.4 (Recipe Overhaul Master Plan 2026-04-29): collapsed 7 sub-cuisines
  // (greek/turkish/lebanese/middle_eastern → mediterranean,
  //  thai/japanese/vietnamese → asian_general). Stored answers carrying the
  // legacy values were migrated by scripts/migrate-interview-cuisines.ts.
  const cuisineOptions = [
    { value: 'polish', label: t('cuisinePolish') },
    { value: 'mediterranean', label: t('cuisineMediterranean') },
    { value: 'italian', label: t('cuisineItalian') },
    { value: 'french', label: t('cuisineFrench') },
    { value: 'indian', label: t('cuisineIndian') },
    { value: 'asian_general', label: t('cuisineAsianGeneral') },
    { value: 'mexican', label: t('cuisineMexican') },
    { value: 'american', label: t('cuisineAmerican') },
    { value: 'any', label: t('cuisineAny') },
  ];

  const showDislikedFoodsOther = form.dislikedFoods.includes('other');

  function handleAllergyChange(v: string[]) {
    const patch: Partial<InterviewAnswers> = { allergies: v };
    // If "none" just got selected → auto-select "none" in intolerances too
    if (v.includes('none') && !form.allergies.includes('none')) {
      patch.intolerances = ['none'];
    }
    // If "none" just got deselected → clear the auto-set intolerances "none"
    if (!v.includes('none') && form.allergies.includes('none') && form.intolerances.includes('none')) {
      patch.intolerances = [];
    }
    onChange(patch);
  }

  return (
    <div className="space-y-5">
      {/* EU 14 Allergens */}
      <div className="space-y-2">
        <Label>{t('allergies')}</Label>
        <NoneExclusiveGroup
          options={allergyOptions}
          selected={form.allergies}
          onChange={handleAllergyChange}
        />
      </div>

      {/* Intolerances */}
      <div className="space-y-2">
        <Label>{t('intolerances')}</Label>
        <NoneExclusiveGroup
          options={intoleranceOptions}
          selected={form.intolerances}
          onChange={(v) => {
            const patch: Partial<InterviewAnswers> = { intolerances: v };
            // 65.4: sync — selecting "none" intolerances → also set allergies to "none"
            if (v.includes('none') && !form.intolerances.includes('none')) {
              patch.allergies = ['none'];
            }
            if (!v.includes('none') && form.intolerances.includes('none') && form.allergies.includes('none')) {
              patch.allergies = [];
            }
            onChange(patch);
          }}
        />
      </div>

      {/* Diet type — 15 options */}
      <div className="space-y-2">
        <Label htmlFor="dietType">{t('dietType')} *</Label>
        <select
          id="dietType"
          value={form.dietType}
          onChange={(e) => onChange({ dietType: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('dietTypePlaceholder')}</option>
          <option value="omnivore">{t('dietTypeOmnivore')}</option>
          <option value="flexitarian">{t('dietTypeFlexitarian')}</option>
          <option value="pescatarian">{t('dietTypePescatarian')}</option>
          <option value="vegetarian">{t('dietTypeVegetarian')}</option>
          <option value="vegan">{t('dietTypeVegan')}</option>
          <option value="whole_food_plant_based">{t('dietTypeWholeFoodPlantBased')}</option>
          <option value="low_carb">{t('dietTypeLowCarb')}</option>
          <option value="keto">{t('dietTypeKeto')}</option>
          <option value="dash">{t('dietTypeDash')}</option>
          <option value="low_fodmap">{t('dietTypeLowFodmap')}</option>
          <option value="mediterranean">{t('dietTypeMediterranean')}</option>
          <option value="anti_inflammatory">{t('dietTypeAntiInflammatory')}</option>
          <option value="gluten_free">{t('dietTypeGlutenFree')}</option>
          <option value="dairy_free">{t('dietTypeDairyFree')}</option>
          <option value="paleo">{t('dietTypePaleo')}</option>
        </select>
      </div>

      {/* Cuisine preferences — 8 options + "any" */}
      <div className="space-y-2">
        <Label>{t('cuisinePreferences')}</Label>
        <CheckboxGroup
          options={cuisineOptions}
          selected={form.cuisinePreferences}
          onChange={(v) => onChange({ cuisinePreferences: v })}
        />
      </div>

      {/* Disliked foods — checkboxes */}
      <div className="space-y-2">
        <Label>{t('dislikedFoods')}</Label>
        <CheckboxGroup
          options={dislikedFoodsOptions}
          selected={form.dislikedFoods}
          onChange={(v) => onChange({ dislikedFoods: v })}
        />
      </div>

      {showDislikedFoodsOther && (
        <div className="space-y-2">
          <Label htmlFor="dislikedFoodsOther">{t('dislikedFoodsOther')}</Label>
          <textarea
            id="dislikedFoodsOther"
            value={form.dislikedFoodsOther}
            onChange={(e) => onChange({ dislikedFoodsOther: e.target.value })}
            placeholder={t('dislikedFoodsOtherPlaceholder')}
            rows={2}
            maxLength={500}
            className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
          />
          <CharCounter value={form.dislikedFoodsOther ?? ''} max={500} />
        </div>
      )}

      {/* Preferred foods — checkboxes */}
      <div className="space-y-2">
        <Label>{t('preferredFoods')}</Label>
        <CheckboxGroup
          options={preferredFoodsOptions}
          selected={form.preferredFoods}
          onChange={(v) => onChange({ preferredFoods: v })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferredFoodsOther">{t('preferredFoodsOther')}</Label>
        <textarea
          id="preferredFoodsOther"
          value={form.preferredFoodsOther}
          onChange={(e) => onChange({ preferredFoodsOther: e.target.value })}
          placeholder={t('preferredFoodsOtherPlaceholder')}
          rows={2}
          maxLength={500}
          className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
        />
        <CharCounter value={form.preferredFoodsOther ?? ''} max={500} />
      </div>
    </div>
  );
}

function Step5({ form, onChange, dirty }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void; dirty: boolean }) {
  const t = useTranslations('dashboard.interview');

  const supplementOptions = [
    { value: 'none_supp', label: t('supplementNone') },
    { value: 'vit_d', label: t('supplementVitD') },
    { value: 'omega3', label: t('supplementOmega3') },
    { value: 'magnesium', label: t('supplementMagnesium') },
    { value: 'zinc', label: t('supplementZinc') },
    { value: 'iron', label: t('supplementIron') },
    { value: 'b12', label: t('supplementB12') },
    { value: 'folic_acid', label: t('supplementFolicAcid') },
    { value: 'probiotics', label: t('supplementProbiotics') },
    { value: 'creatine', label: t('supplementCreatine') },
    { value: 'protein_powder', label: t('supplementProteinPowder') },
    { value: 'collagen', label: t('supplementCollagen') },
    { value: 'melatonin', label: t('supplementMelatonin') },
  ];

  const showSupplementsOther = form.supplements.length > 0 && !form.supplements.includes('none_supp');
  const supplementsEmpty = form.supplements.length === 0;

  return (
    <div className="space-y-5">
      {/* Meals per day */}
      <div className="space-y-2">
        <Label htmlFor="mealsPerDay">{t('mealsPerDay')} *</Label>
        <select
          id="mealsPerDay"
          value={form.mealsPerDay}
          onChange={(e) => onChange({ mealsPerDay: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('mealsPerDayPlaceholder')}</option>
          <option value="3">{t('meals3')}</option>
          <option value="4">{t('meals4')}</option>
          <option value="5">{t('meals5')}</option>
        </select>
      </div>

      {/* Cooking time */}
      <div className="space-y-2">
        <Label htmlFor="cookingTime">{t('cookingTime')} *</Label>
        <select
          id="cookingTime"
          value={form.cookingTime}
          onChange={(e) => onChange({ cookingTime: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('cookingTimePlaceholder')}</option>
          <option value="quick">{t('cookingTimeQuick')}</option>
          <option value="medium">{t('cookingTimeMedium')}</option>
          <option value="long">{t('cookingTimeLong')}</option>
        </select>
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <Label htmlFor="budget">{t('budget')} *</Label>
        <select
          id="budget"
          value={form.budget}
          onChange={(e) => onChange({ budget: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('budgetPlaceholder')}</option>
          <option value="low">{t('budgetLow')}</option>
          <option value="medium">{t('budgetMedium')}</option>
          <option value="high">{t('budgetHigh')}</option>
        </select>
      </div>

      {/* Supplements */}
      <div className="space-y-2">
        <Label>{t('supplements')}</Label>
        <NoneExclusiveGroup
          options={supplementOptions}
          selected={form.supplements}
          onChange={(v) => onChange({ supplements: v })}
        />
        {dirty && supplementsEmpty && (
          <p className="text-sm text-destructive">{t('errorSupplementsRequired')}</p>
        )}
      </div>

      {showSupplementsOther && (
        <div className="space-y-2">
          <Label htmlFor="supplementsOther">{t('supplementsOther')}</Label>
          <textarea
            id="supplementsOther"
            value={form.supplementsOther}
            onChange={(e) => onChange({ supplementsOther: e.target.value })}
            placeholder={t('supplementsOtherPlaceholder')}
            rows={2}
            maxLength={300}
            className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
          />
          <CharCounter value={form.supplementsOther ?? ''} max={300} />
        </div>
      )}

      {/* Meal rhythm */}
      <div className="space-y-3">
        <p className="font-medium text-sm">{t('mealRhythm')}</p>

        <div className="space-y-2">
          <Label htmlFor="firstMealTime">{t('firstMealTime')}</Label>
          <select
            id="firstMealTime"
            value={form.firstMealTime}
            onChange={(e) => onChange({ firstMealTime: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="before_7">{t('firstMealTimeBefore7')}</option>
            <option value="7_9">{t('firstMealTime7to9')}</option>
            <option value="after_9">{t('firstMealTimeAfter9')}</option>
            <option value="skip">{t('firstMealTimeSkip')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastMealTime">{t('lastMealTime')}</Label>
          <select
            id="lastMealTime"
            value={form.lastMealTime}
            onChange={(e) => onChange({ lastMealTime: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="before_18">{t('lastMealTimeBefore18')}</option>
            <option value="18_20">{t('lastMealTime18to20')}</option>
            <option value="after_20">{t('lastMealTimeAfter20')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="eatsAtNight">{t('eatsAtNight')}</Label>
          <select
            id="eatsAtNight"
            value={form.eatsAtNight}
            onChange={(e) => onChange({ eatsAtNight: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="yes">{t('eatsAtNightYes')}</option>
            <option value="no">{t('eatsAtNightNo')}</option>
          </select>
        </div>
      </div>

      {/* Lifestyle */}
      <div className="space-y-3">
        <p className="font-medium text-sm">{t('lifestyle')}</p>

        <div className="space-y-2">
          <Label htmlFor="alcoholFrequency">{t('alcoholFrequency')}</Label>
          <select
            id="alcoholFrequency"
            value={form.alcoholFrequency}
            onChange={(e) => onChange({ alcoholFrequency: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="none">{t('alcoholNone')}</option>
            <option value="occasional">{t('alcoholOccasional')}</option>
            <option value="1_2_week">{t('alcohol1to2Week')}</option>
            <option value="daily">{t('alcoholDaily')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workType">{t('workType')}</Label>
          <select
            id="workType"
            value={form.workType}
            onChange={(e) => onChange({ workType: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="office">{t('workTypeOffice')}</option>
            <option value="physical">{t('workTypePhysical')}</option>
            <option value="shift_night">{t('workTypeShiftNight')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mainMealAt">{t('mainMealAt')}</Label>
          <select
            id="mainMealAt"
            value={form.mainMealAt}
            onChange={(e) => onChange({ mainMealAt: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">{t('optionalSelectPlaceholder')}</option>
            <option value="home">{t('mainMealAtHome')}</option>
            <option value="restaurant">{t('mainMealAtRestaurant')}</option>
            <option value="work">{t('mainMealAtWork')}</option>
          </select>
        </div>
      </div>

      {/* Additional notes with PII disclaimer */}
      <div className="space-y-2">
        <Label htmlFor="additionalNotes">{t('additionalNotes')}</Label>
        <p className="text-xs text-muted-foreground">{t('piiDisclaimer')}</p>
        <textarea
          id="additionalNotes"
          value={form.additionalNotes}
          onChange={(e) => onChange({ additionalNotes: e.target.value })}
          placeholder={t('additionalNotesPlaceholder')}
          rows={4}
          maxLength={1000}
          className={cn(SELECT_CLASS, 'h-auto resize-none py-2 leading-relaxed')}
        />
        <CharCounter value={form.additionalNotes ?? ''} max={1000} />
      </div>
    </div>
  );
}

function Step6({ form, onChange, sex }: { form: InterviewAnswers; onChange: (patch: Partial<InterviewAnswers>) => void; sex?: string | null }) {
  const t = useTranslations('dashboard.interview');
  const isMale = sex?.toLowerCase() === 'male' || sex?.toLowerCase() === 'm';

  const hormonalOptions = [
    { value: 'none', label: t('hormonalNone') },
    { value: 'pcos', label: t('hormonalPCOS') },
    { value: 'menopause', label: t('hormonalMenopause') },
    { value: 'other', label: t('hormonalOther') },
  ];

  const hormonalEmpty = (form.hormonalIssues ?? []).length === 0;
  const pregnancyEmpty = !isMale && !form.pregnancyStatus;

  return (
    <div className="space-y-5">
      {/* BUG-12: hide pregnancy section for male patients */}
      {!isMale && (
        <>
          <div className="space-y-2">
            <Label htmlFor="pregnancyStatus">{t('pregnancyStatus')} <span className="text-destructive">*</span></Label>
            <select
              id="pregnancyStatus"
              value={form.pregnancyStatus}
              onChange={(e) => onChange({ pregnancyStatus: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="">{t('pregnancyStatusPlaceholder')}</option>
              <option value="none">{t('pregnancyNone')}</option>
              <option value="pregnant">{t('pregnancyPregnant')}</option>
              <option value="breastfeeding">{t('pregnancyBreastfeeding')}</option>
            </select>
            {pregnancyEmpty && (
              <p className="text-sm text-destructive">{t('errorPregnancyRequired')}</p>
            )}
          </div>

          {/* Conditional: pregnancy trimester (IW-14) */}
          {form.pregnancyStatus === 'pregnant' && (
            <div className="space-y-2 rounded-lg border border-pink-200 bg-pink-50/60 p-4">
              <Label htmlFor="pregnancyTrimester" className="text-pink-900 font-medium">
                {t('pregnancyTrimesterLabel')}
              </Label>
              <select
                id="pregnancyTrimester"
                value={form.pregnancyTrimester ?? ''}
                onChange={(e) => onChange({ pregnancyTrimester: e.target.value })}
                className={cn(SELECT_CLASS, 'max-w-[220px]')}
              >
                <option value="">{t('pregnancyTrimesterPlaceholder')}</option>
                <option value="1">{t('pregnancyTrimester1')}</option>
                <option value="2">{t('pregnancyTrimester2')}</option>
                <option value="3">{t('pregnancyTrimester3')}</option>
              </select>
              <p className="text-xs text-pink-700">{t('pregnancyTrimesterHint')}</p>
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label>{t('hormonalIssues')} <span className="text-destructive">*</span></Label>
        <NoneExclusiveGroup
          options={hormonalOptions}
          selected={form.hormonalIssues ?? []}
          onChange={(v) => onChange({ hormonalIssues: v })}
        />
        {hormonalEmpty && (
          <p className="text-sm text-destructive">{t('errorHormonalRequired')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="stressLevel">{t('stressLevel')}</Label>
        <select
          id="stressLevel"
          value={form.stressLevel}
          onChange={(e) => onChange({ stressLevel: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('stressLevelPlaceholder')}</option>
          <option value="low">{t('stressLow')}</option>
          <option value="moderate">{t('stressModerate')}</option>
          <option value="high">{t('stressHigh')}</option>
          <option value="very_high">{t('stressVeryHigh')}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sleepHours">{t('sleepHours')}</Label>
        <select
          id="sleepHours"
          value={form.sleepHours}
          onChange={(e) => onChange({ sleepHours: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{t('sleepHoursPlaceholder')}</option>
          <option value="under_6">{t('sleepUnder6')}</option>
          <option value="6_7">{t('sleep6to7')}</option>
          <option value="7_8">{t('sleep7to8')}</option>
          <option value="over_8">{t('sleepOver8')}</option>
        </select>
      </div>

    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Character counter for textareas (65.5) */
function CharCounter({ value, max }: { value: string; max: number }) {
  const len = value?.length ?? 0;
  const pct = len / max;
  const color = pct > 0.95 ? 'text-red-500' : pct > 0.8 ? 'text-amber-500' : 'text-muted-foreground';
  return <span className={`text-xs ${color}`}>{len} / {max}</span>;
}

function isStepValid(step: number, form: InterviewAnswers, sex?: string | null): boolean {
  if (step === 1) {
    const base = !!form.mainGoal && !!form.timeline;
    if (['lose_weight', 'gain_muscle'].includes(form.mainGoal)) {
      const current = parseFloat((form.currentWeightKg ?? '').replace(',', '.'));
      const target = parseFloat((form.targetWeightKg ?? '').replace(',', '.'));
      // 65.3: currentWeightKg is required for weight-based goals
      if (isNaN(current) || current < 10 || current > 300) return false;
      if (isNaN(target) || target < 10 || target > 300) return false;
      if (form.mainGoal === 'lose_weight' && target >= current) return false;
      if (form.mainGoal === 'gain_muscle' && target <= current) return false;
      return base;
    }
    return base;
  }
  if (step === 2) {
    if (!form.activityLevel) return false;
    if (form.activityTypes.length > 0) {
      if (!form.workoutDurationMin) return false;
      const n = parseInt(form.workoutsPerWeek ?? '', 10);
      if (isNaN(n) || n < 1 || n > 14) return false;
    }
    return true;
  }
  if (step === 3) {
    return form.chronicDiseases.length > 0 && form.medications.length > 0 && form.digestiveIssues.length > 0;
  }
  if (step === 4) return !!form.dietType;
  if (step === 5) return !!form.mealsPerDay && !!form.cookingTime && !!form.budget && form.supplements.length > 0;
  if (step === 6) {
    const isMale = sex?.toLowerCase() === 'male' || sex?.toLowerCase() === 'm';
    const pregnancyOk = isMale || !!form.pregnancyStatus;
    return pregnancyOk && (form.hormonalIssues ?? []).length > 0;
  }
  return false;
}

// ─── Cross-validation warnings (PRE.28) ──────────────────────────────────────

interface CrossWarning {
  key: 'warnVeganAllergens' | 'warnCkdKeto' | 'warnEatingDisorder' | 'warnTherapeuticDiet';
}

function computeWarnings(form: InterviewAnswers): CrossWarning[] {
  const warnings: CrossWarning[] = [];

  if (
    form.dietType === 'vegan' &&
    (form.allergies.includes('eggs') || form.allergies.includes('milk'))
  ) {
    warnings.push({ key: 'warnVeganAllergens' });
  }

  if (
    form.chronicDiseases.includes('ckd_stage_4_5') &&
    form.dietType === 'keto'
  ) {
    warnings.push({ key: 'warnCkdKeto' });
  }

  if (
    form.chronicDiseases.includes('anorexia_nervosa') ||
    form.chronicDiseases.includes('bulimia_nervosa')
  ) {
    warnings.push({ key: 'warnEatingDisorder' });
  }

  const ketoJustified = form.dietType === 'keto' &&
    form.chronicDiseases.some((d) => ['epilepsy', 'diabetes_t1', 'diabetes_t2', 'obesity'].includes(d));
  const fodmapJustified = form.dietType === 'low_fodmap' &&
    form.chronicDiseases.some((d) => ['ibs', 'crohn', 'ulcerative_colitis', 'sibo'].includes(d));
  if (['keto', 'low_fodmap'].includes(form.dietType) && !ketoJustified && !fodmapJustified) {
    warnings.push({ key: 'warnTherapeuticDiet' });
  }

  return warnings;
}

// ─── Pre-fill helper ──────────────────────────────────────────────────────────

function mapAnswersToForm(answers: Record<string, unknown>): InterviewAnswers {
  const str = (key: string): string => {
    const v = answers[key];
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  };
  const arr = (key: string): string[] => {
    const v = answers[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };
  // backward-compat: medications was string, now string[]
  const arrOrEmpty = (key: string): string[] => {
    const v = answers[key];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    return []; // ignore old string value — let user re-fill with checkboxes
  };

  return {
    mainGoal: str('mainGoal'),
    currentWeightKg: str('currentWeightKg'),
    targetWeightKg: str('targetWeightKg'),
    timeline: str('timeline'),
    activityLevel: str('activityLevel'),
    activityTypes: arr('activityTypes'),
    activityTypesOther: str('activityTypesOther'),
    workoutsPerWeek: str('workoutsPerWeek'),
    workoutDurationMin: str('workoutDurationMin'),
    chronicDiseases: arr('chronicDiseases'),
    chronicDiseasesOther: str('chronicDiseasesOther'),
    medications: arrOrEmpty('medications'),
    medicationsOther: str('medicationsOther'),
    digestiveIssues: arr('digestiveIssues'),
    allergies: arr('allergies'),
    intolerances: arr('intolerances'),
    dislikes: str('dislikes'), // backward compat — not rendered
    dislikedFoods: arr('dislikedFoods'),
    // backward compat: old dislikes string → dislikedFoodsOther
    dislikedFoodsOther: str('dislikedFoodsOther') || str('dislikes'),
    preferredFoods: arr('preferredFoods'),
    preferredFoodsOther: str('preferredFoodsOther'),
    dietType: str('dietType'),
    cuisinePreferences: arr('cuisinePreferences'),
    mealsPerDay: str('mealsPerDay'),
    cookingTime: str('cookingTime'),
    budget: str('budget'),
    additionalNotes: str('additionalNotes'),
    supplements: arr('supplements'),
    supplementsOther: str('supplementsOther'),
    firstMealTime: str('firstMealTime'),
    lastMealTime: str('lastMealTime'),
    eatsAtNight: str('eatsAtNight'),
    alcoholFrequency: str('alcoholFrequency'),
    workType: str('workType'),
    mainMealAt: str('mainMealAt'),
    pregnancyStatus: str('pregnancyStatus'),
    pregnancyTrimester: str('pregnancyTrimester'),
    hormonalIssues: arr('hormonalIssues'),
    stressLevel: str('stressLevel'),
    sleepHours: str('sleepHours'),
    hba1c: str('hba1c'),
    egfr: str('egfr'),
    ckdStadium: str('ckdStadium'),
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InterviewForm() {
  const t = useTranslations('dashboard.interview');
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const TOTAL_STEPS = 6;

  const formTopRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<InterviewAnswers>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<PreCheckConflict[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, unknown> | null>(null);
  const [submitted, setSubmitted] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('interview_submitted') === '1',
  );
  const [stepDirty, setStepDirty] = useState(false);
  const [patientSex, setPatientSex] = useState<string | null>(null);

  // Pre-fill from latest interview
  useEffect(() => {
    if (sessionStatus === 'loading') return;

    const patientId = session?.user?.patientId;
    if (!patientId) {
      setPrefilling(false);
      return;
    }
    const token = '';

    setPrefilling(true);
    Promise.all([
      api.interviews.getLatest(patientId, token).catch(() => null),
      api.profile.get(token).catch(() => null),
    ]).then(([interviewRes, profileRes]) => {
      const base = interviewRes?.interview?.answers
        ? mapAnswersToForm(interviewRes.interview.answers)
        : INITIAL;
      const weightKg = profileRes?.patient?.weightKg;
      const sex = profileRes?.patient?.sex ?? null;
      setPatientSex(sex);
      setForm({
        ...base,
        currentWeightKg: base.currentWeightKg || (weightKg ? String(weightKg) : ''),
      });
    }).finally(() => setPrefilling(false));
  }, [session?.user?.patientId, sessionStatus]);

  function handleChange(patch: Partial<InterviewAnswers>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  }

  /** Build clean answers from form state */
  function buildAnswers(): Record<string, unknown> {
    const answers: Record<string, unknown> = {
      mainGoal: form.mainGoal,
      timeline: form.timeline,
      activityLevel: form.activityLevel,
      activityTypes: form.activityTypes,
      chronicDiseases: form.chronicDiseases,
      digestiveIssues: form.digestiveIssues,
      allergies: form.allergies,
      intolerances: form.intolerances,
      dislikedFoods: form.dislikedFoods,
      preferredFoods: form.preferredFoods,
      dietType: form.dietType,
      cuisinePreferences: form.cuisinePreferences,
      mealsPerDay: Number(form.mealsPerDay),
      cookingTime: form.cookingTime,
      budget: form.budget,
      medications: form.medications,
      supplements: form.supplements,
    };

    if (form.currentWeightKg) answers.currentWeightKg = Number(form.currentWeightKg.replace(',', '.'));
    if (form.targetWeightKg) answers.targetWeightKg = Number(form.targetWeightKg.replace(',', '.'));
    if (form.workoutsPerWeek) answers.workoutsPerWeek = Number(form.workoutsPerWeek);
    if (form.workoutDurationMin) answers.workoutDurationMin = Number(form.workoutDurationMin);
    // Sanitize PII from free-text fields (65.1)
    if (form.activityTypesOther?.trim()) answers.activityTypesOther = sanitizePii(form.activityTypesOther);
    if (form.chronicDiseasesOther?.trim()) answers.chronicDiseasesOther = sanitizePii(form.chronicDiseasesOther);
    if (form.medicationsOther?.trim()) answers.medicationsOther = sanitizePii(form.medicationsOther);
    if (form.dislikedFoodsOther?.trim()) answers.dislikedFoodsOther = sanitizePii(form.dislikedFoodsOther);
    if (form.preferredFoodsOther?.trim()) answers.preferredFoodsOther = sanitizePii(form.preferredFoodsOther);
    if (form.supplementsOther?.trim()) answers.supplementsOther = sanitizePii(form.supplementsOther);
    if (form.additionalNotes?.trim()) answers.additionalNotes = sanitizePii(form.additionalNotes);
    if (form.firstMealTime) answers.firstMealTime = form.firstMealTime;
    if (form.lastMealTime) answers.lastMealTime = form.lastMealTime;
    if (form.eatsAtNight) answers.eatsAtNight = form.eatsAtNight;
    if (form.alcoholFrequency) answers.alcoholFrequency = form.alcoholFrequency;
    if (form.workType) answers.workType = form.workType;
    if (form.mainMealAt) answers.mainMealAt = form.mainMealAt;

    if (form.pregnancyStatus) answers.pregnancyStatus = form.pregnancyStatus;
    if (form.pregnancyStatus === 'pregnant' && form.pregnancyTrimester) {
      answers.pregnancyTrimester = Number(form.pregnancyTrimester);
    }
    if (form.hormonalIssues?.length) answers.hormonalIssues = form.hormonalIssues;
    if (form.stressLevel) answers.stressLevel = form.stressLevel;
    if (form.sleepHours) answers.sleepHours = form.sleepHours;

    if (form.hba1c && (form.chronicDiseases.includes('diabetes_t1') || form.chronicDiseases.includes('diabetes_t2'))) {
      answers.hba1c = parseFloat(form.hba1c);
    }
    const hasCkd = form.chronicDiseases.includes('ckd_stage_1_3') || form.chronicDiseases.includes('ckd_stage_4_5');
    if (hasCkd && form.egfr) answers.egfr = Number(form.egfr);
    if (hasCkd && form.ckdStadium) answers.ckdStadium = Number(form.ckdStadium);

    return answers;
  }

  /** Submit the interview (called directly or after conflict resolution) */
  async function submitInterview(answers: Record<string, unknown>) {
    const token = '';

    setLoading(true);
    setError(null);

    try {
      const result = await api.interviews.create({ answers }, token);
      // 65.2: Handle blocked response from backend (BLOCKING_CONFLICT)
      if (result.blocked) {
        setError(t('errorBlocked'));
        setLoading(false);
        return;
      }
      sessionStorage.setItem('interview_submitted', '1');
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(t('errorGeneral'));
    } finally {
      setLoading(false);
    }
  }

  /** Main submit handler — runs pre-check first */
  async function handleSubmit() {
    const token = '';
    setLoading(true);
    setError(null);

    const answers = buildAnswers();

    try {
      // Pre-check for protocol conflicts
      const preCheck = await api.interviews.preCheck(answers);

      if (preCheck.conflicts.length > 0) {
        // Store answers and show conflict modal
        setPendingAnswers(answers);
        setConflicts(preCheck.conflicts);
        setConflictModalOpen(true);
        setLoading(false);
        return;
      }

      // No conflicts — submit directly
      await submitInterview(answers);
    } catch {
      // If pre-check fails (e.g. network), submit anyway — backend has double-safety
      await submitInterview(answers);
    }
  }

  /** Called when user chooses "continue safely" in conflict modal */
  function handleConflictContinueSafely() {
    if (!pendingAnswers) return;

    // Remove the losing side (preference/goal) from answers for each BLOCK conflict
    const cleaned = { ...pendingAnswers };
    for (const conflict of conflicts) {
      if (conflict.severity === 'BLOCK') {
        // winnerSide "B" means B (disease) wins, remove A (preference)
        const loserField = conflict.winnerSide === 'B' ? conflict.triggerA.field : conflict.triggerB.field;
        const loserValue = conflict.winnerSide === 'B' ? conflict.triggerA.value : conflict.triggerB.value;

        const current = cleaned[loserField];
        if (Array.isArray(current)) {
          cleaned[loserField] = current.filter((v: string) => v !== loserValue);
        } else if (current === loserValue) {
          cleaned[loserField] = '';
        }
      }
    }

    setPendingAnswers(null);
    setConflicts([]);
    submitInterview(cleaned);
  }

  /** Called when user cancels from conflict modal */
  function handleConflictCancel() {
    setPendingAnswers(null);
    setConflicts([]);
  }

  // ── Loading previous answers ────────────────────────────────────────────────
  if (prefilling) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t('loadingPrevious')}</span>
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-10">
        <CheckCircle2 className="h-14 w-14 text-sage-500" />
        <h2 className="text-2xl font-bold">{t('successTitle')}</h2>
        <p className="text-muted-foreground max-w-md">{t('successMessage')}</p>
        <Button variant="sage" onClick={() => router.push('/dashboard/plan')}>
          {t('successBack')}
        </Button>
      </div>
    );
  }

  // ── Cross-validation warnings ──────────────────────────────────────────────
  const warnings = computeWarnings(form);

  // ── Step content ───────────────────────────────────────────────────────────
  const stepTitles = [
    t('step1Title'),
    t('step2Title'),
    t('step3Title'),
    t('step4Title'),
    t('step5Title'),
    t('step6Title'),
  ];
  const stepDescs = [
    t('step1Desc'),
    t('step2Desc'),
    t('step3Desc'),
    t('step4Desc'),
    t('step5Desc'),
    t('step6Desc'),
  ];

  const valid = isStepValid(step, form, patientSex);

  return (
    <div ref={formTopRef} className="space-y-6 touch-manipulation">
      {/* Conflict modal */}
      <ConflictModal
        open={conflictModalOpen}
        onOpenChange={setConflictModalOpen}
        conflicts={conflicts}
        onContinueSafely={handleConflictContinueSafely}
        onCancel={handleConflictCancel}
      />
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('stepLabel', { current: step, total: TOTAL_STEPS })}</span>
          <span className="font-medium">{stepTitles[step - 1]}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-sage-500 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{stepDescs[step - 1]}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step content */}
      {step === 1 && <Step1 form={form} onChange={handleChange} />}
      {step === 2 && <Step2 form={form} onChange={handleChange} dirty={stepDirty} />}
      {step === 3 && <Step3 form={form} onChange={handleChange} dirty={stepDirty} />}
      {step === 4 && <Step4 form={form} onChange={handleChange} />}
      {step === 5 && <Step5 form={form} onChange={handleChange} dirty={stepDirty} />}
      {step === 6 && <Step6 form={form} onChange={handleChange} sex={patientSex} />}

      {/* Cross-validation warnings (PRE.28) */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w) => (
            <div
              key={w.key}
              className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800"
            >
              {t(w.key)}
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px]"
            onClick={() => {
              setStep((s) => s - 1);
              setStepDirty(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={step === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              variant="sage"
              className="min-h-[48px]"
              onClick={() => {
                if (!valid) {
                  setStepDirty(true);
                  return;
                }
                setStepDirty(false);
                setStep((s) => s + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="sage"
              className="min-h-[48px]"
              onClick={() => {
                if (!valid) {
                  setStepDirty(true);
                  return;
                }
                handleSubmit();
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          )}
        </div>

        {stepDirty && !valid && (
          <p className="text-sm text-destructive text-right">{t('errorFillRequired')}</p>
        )}
      </div>
    </div>
  );
}
