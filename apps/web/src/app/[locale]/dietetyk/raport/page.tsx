import { auth } from '@/auth';
import { getBackendToken } from '@/lib/server-token';
import { getTranslations } from 'next-intl/server';
import { MonthlyReportView } from '@/components/dietitian/MonthlyReportView';

export default async function ReportPage() {
  const session = await auth();
  const token = await getBackendToken() ?? '';
  const t = await getTranslations('dietitian.report');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('description')}</p>
      </div>

      <MonthlyReportView
        token={token}
        labels={{
          selectMonth: t('selectMonth'),
          load: t('load'),
          loading: t('loading'),
          exportPdf: t('exportPdf'),
          error: t('error'),
          noData: t('noData'),
          patients: t('patients'),
          newPatients: t('newPatients'),
          plans: t('plans'),
          generated: t('generated'),
          reviewed: t('reviewed'),
          published: t('published'),
          manualReview: t('manualReview'),
          compliance: t('compliance'),
          avgCompliance: t('avgCompliance'),
          checkIns: t('checkIns'),
          patientsWithCheckIns: t('patientsWithCheckIns'),
          goalProgress: t('goalProgress'),
          patientsWithGoal: t('patientsWithGoal'),
          reachedGoal: t('reachedGoal'),
          patientDetails: t('patientDetails'),
          colPatient: t('colPatient'),
          colWeight: t('colWeight'),
          colGoal: t('colGoal'),
          colChange: t('colChange'),
          colCompliance: t('colCompliance'),
          colCheckIns: t('colCheckIns'),
          colPlans: t('colPlans'),
        }}
      />
    </div>
  );
}
