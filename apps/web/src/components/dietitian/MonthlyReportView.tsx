'use client';

import { useState, useTransition } from 'react';
import type { MonthlyReport } from '@/types/api';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, FileBarChart, Users, ClipboardCheck, Target, BarChart3 } from 'lucide-react';

interface Labels {
  selectMonth: string;
  load: string;
  loading: string;
  exportPdf: string;
  error: string;
  noData: string;
  patients: string;
  newPatients: string;
  plans: string;
  generated: string;
  reviewed: string;
  published: string;
  manualReview: string;
  compliance: string;
  avgCompliance: string;
  checkIns: string;
  patientsWithCheckIns: string;
  goalProgress: string;
  patientsWithGoal: string;
  reachedGoal: string;
  patientDetails: string;
  colPatient: string;
  colWeight: string;
  colGoal: string;
  colChange: string;
  colCompliance: string;
  colCheckIns: string;
  colPlans: string;
}

interface MonthlyReportViewProps {
  token: string;
  labels: Labels;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function StatCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function MonthlyReportView({ token, labels }: MonthlyReportViewProps) {
  const [month, setMonth] = useState(getCurrentMonth());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLoad() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await api.report.get(month, token);
        setReport(res.report);
      } catch {
        setError(labels.error);
      }
    });
  }

  function handleExportPdf() {
    const url = api.report.exportPdfUrl(month);
    // Open in new tab — the backend endpoint will handle auth via token in header
    // For PDF download we use a hidden form approach with token
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';

    // URL is /api/proxy/* — auth is injected server-side by the proxy
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `raport-${month}.pdf`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => setError(labels.error));
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="report-month" className="text-sm font-medium">
            {labels.selectMonth}
          </label>
          <Input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={handleLoad} disabled={isPending}>
          <FileBarChart className="h-4 w-4 mr-1.5" />
          {isPending ? labels.loading : labels.load}
        </Button>
        {report && (
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-1.5" />
            {labels.exportPdf}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {!report && !error && !isPending && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{labels.noData}</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} title={labels.patients}>
              <div className="text-2xl font-bold">{report.patients.total}</div>
              <p className="text-xs text-muted-foreground">
                {labels.newPatients}: +{report.patients.newThisMonth}
              </p>
            </StatCard>

            <StatCard icon={ClipboardCheck} title={labels.plans}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{labels.generated}</span>
                  <span className="font-medium">{report.plans.generated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{labels.reviewed}</span>
                  <span className="font-medium">{report.plans.reviewed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{labels.published}</span>
                  <span className="font-medium">{report.plans.published}</span>
                </div>
                {report.plans.manualReviewRequired > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>{labels.manualReview}</span>
                    <span className="font-medium">{report.plans.manualReviewRequired}</span>
                  </div>
                )}
              </div>
            </StatCard>

            <StatCard icon={BarChart3} title={labels.compliance}>
              <div className="text-2xl font-bold">
                {report.compliance.averagePercent != null
                  ? `${report.compliance.averagePercent}%`
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                {labels.checkIns}: {report.compliance.checkInsCount} |{' '}
                {labels.patientsWithCheckIns}: {report.compliance.patientsWithCheckIns}
              </p>
            </StatCard>

            <StatCard icon={Target} title={labels.goalProgress}>
              <div className="text-2xl font-bold">
                {report.goalProgress.patientsReachedGoal}/{report.goalProgress.patientsWithGoal}
              </div>
              <p className="text-xs text-muted-foreground">
                {labels.reachedGoal}
              </p>
            </StatCard>
          </div>

          {/* Patient details table */}
          {report.patientSummaries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {labels.patientDetails}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{labels.colPatient}</TableHead>
                        <TableHead className="text-right">{labels.colWeight}</TableHead>
                        <TableHead className="text-right">{labels.colGoal}</TableHead>
                        <TableHead className="text-right">{labels.colChange}</TableHead>
                        <TableHead className="text-right">{labels.colCompliance}</TableHead>
                        <TableHead className="text-right">{labels.colCheckIns}</TableHead>
                        <TableHead className="text-right">{labels.colPlans}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.patientSummaries.map((ps) => (
                        <TableRow key={ps.patientId}>
                          <TableCell className="font-medium">
                            {[ps.firstName, ps.lastName].filter(Boolean).join(' ') || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {ps.currentWeightKg != null ? `${ps.currentWeightKg} kg` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {ps.goalWeightKg != null ? `${ps.goalWeightKg} kg` : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {ps.weightChangeKg != null ? (
                              <span
                                className={
                                  ps.weightChangeKg < 0
                                    ? 'text-green-600'
                                    : ps.weightChangeKg > 0
                                      ? 'text-red-600'
                                      : ''
                                }
                              >
                                {ps.weightChangeKg > 0 ? '+' : ''}
                                {ps.weightChangeKg} kg
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {ps.avgCompliance != null ? `${ps.avgCompliance}%` : '—'}
                          </TableCell>
                          <TableCell className="text-right">{ps.checkInsCount}</TableCell>
                          <TableCell className="text-right">{ps.planCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
