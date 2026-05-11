'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import type { DietPlanStatus } from '@/types/api';
import { Button } from '@/components/ui/button';
import { CheckCircle, Send, FileDown } from 'lucide-react';

interface Props {
  planId: string;
  status: DietPlanStatus;
}

export function DietPlanStatusActions({ planId, status }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations('dietitian.planDetail');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpdateStatus(newStatus: 'REVIEWED' | 'SENT') {
    setLoading(true);
    setError('');
    const token = '';
    try {
      await api.dietPlans.updateStatus(planId, newStatus, token);
      router.refresh();
    } catch {
      setError(t('statusError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
    setPdfLoading(true);
    const token = '';
    try {
      const blob = await api.dietPlans.exportPdf(planId, token);
      downloadBlob(blob, 'plan-diety.pdf');
    } finally {
      setPdfLoading(false);
    }
  }

  const exportButton = (
    <Button variant="outline" onClick={handleExportPdf} disabled={pdfLoading} className="gap-2 w-full">
      <FileDown className="h-4 w-4" />
      {pdfLoading ? '...' : t('exportPdf')}
    </Button>
  );

  if (status === 'AI_DRAFT' || status === 'GENERATED') {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={() => handleUpdateStatus('REVIEWED')} disabled={loading} className="gap-2 w-full">
          <CheckCircle className="h-4 w-4" />
          {loading ? '...' : t('approve')}
        </Button>
        {exportButton}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (status === 'REVIEWED') {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={() => handleUpdateStatus('SENT')} disabled={loading} className="gap-2 w-full">
          <Send className="h-4 w-4" />
          {loading ? '...' : t('sendToPatient')}
        </Button>
        {exportButton}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return exportButton;
}
