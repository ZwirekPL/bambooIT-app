'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ConsultationRow {
  id: string;
  createdAt: string;
  status: string;
  consultationPhone: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientEmail: string;
}

interface Props {
  token: string;
}

export function AdminConsultationsList({ token }: Props) {
  const t = useTranslations('admin.consultations');
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const params: { page: number; limit: number; status?: string } = { page, limit: 20 };
        if (statusFilter !== 'all') params.status = statusFilter;
        const res = await api.adminConsultations.list(params, token);
        setConsultations(res.consultations);
        setTotal(res.total);
      } catch {
        // ignore
      }
    });
  }

  useEffect(() => { load(); }, [page, statusFilter]);

  async function markStatus(id: string, status: 'COMPLETED' | 'CANCELLED') {
    try {
      await api.adminConsultations.updateStatus(id, status, token);
      load();
    } catch {
      // ignore
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge variant="default">{t('statusPaid')}</Badge>;
      case 'COMPLETED': return <Badge className="bg-green-100 text-green-800">{t('statusCompleted')}</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">{t('statusCancelled')}</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="PAID">{t('statusPaid')}</SelectItem>
            <SelectItem value="COMPLETED">{t('statusCompleted')}</SelectItem>
            <SelectItem value="CANCELLED">{t('statusCancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {t('totalCount', { count: total })}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colDate')}</TableHead>
            <TableHead>{t('colPatient')}</TableHead>
            <TableHead>{t('colEmail')}</TableHead>
            <TableHead>{t('colPhone')}</TableHead>
            <TableHead>{t('colStatus')}</TableHead>
            <TableHead>{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consultations.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-sm">
                {new Date(c.createdAt).toLocaleDateString('pl-PL')}
              </TableCell>
              <TableCell className="font-medium">
                {[c.patientFirstName, c.patientLastName].filter(Boolean).join(' ') || '—'}
              </TableCell>
              <TableCell className="text-sm">{c.patientEmail}</TableCell>
              <TableCell className="text-sm">{c.consultationPhone || '—'}</TableCell>
              <TableCell>{statusBadge(c.status)}</TableCell>
              <TableCell>
                {c.status === 'PAID' && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markStatus(c.id, 'COMPLETED')}
                      title={t('markCompleted')}
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markStatus(c.id, 'CANCELLED')}
                      title={t('markCancelled')}
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {consultations.length === 0 && !isPending && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </Button>
          <span className="text-sm self-center">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            →
          </Button>
        </div>
      )}
    </div>
  );
}
