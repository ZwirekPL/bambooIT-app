'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type {
  EmailCampaign,
  EmailCampaignAudience,
  EmailCampaignStatus,
  AudienceCounts,
} from '@/types/api';

const STATUS_STYLES: Record<EmailCampaignStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENDING: 'bg-amber-100 text-amber-800',
  SENT: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-700',
};

const AUDIENCE_ORDER: EmailCampaignAudience[] = ['ALL_CLIENTS', 'LEADS', 'TEST'];

export function EmailCampaignsManager({ token }: { token: string }) {
  const t = useTranslations('admin.emailCampaigns');
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [counts, setCounts] = useState<AudienceCounts>({ ALL_CLIENTS: 0, LEADS: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<EmailCampaignAudience>('ALL_CLIENTS');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.admin.emailCampaigns.list(token);
      setCampaigns(res.campaigns);
      setCounts(res.audienceCounts);
      setError(null);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const audienceCount = (a: EmailCampaignAudience) =>
    a === 'TEST' ? 1 : a === 'LEADS' ? counts.LEADS : counts.ALL_CLIENTS;

  async function handleCreate() {
    if (!subject.trim() || !body.trim() || saving) return;
    setSaving(true);
    try {
      await api.admin.emailCampaigns.create(
        { subject: subject.trim(), body: body.trim(), audience },
        token,
      );
      setSubject('');
      setBody('');
      setAudience('ALL_CLIENTS');
      setComposerOpen(false);
      await load();
    } catch {
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSend(c: EmailCampaign) {
    const count = audienceCount(c.audience);
    if (!window.confirm(t('sendConfirm', { subject: c.subject, count }))) return;
    setBusyId(c.id);
    try {
      const res = await api.admin.emailCampaigns.send(c.id, token);
      if (!res.transportConfigured) window.alert(t('sentMockResult'));
      await load();
    } catch {
      setError(t('error'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: EmailCampaign) {
    if (!window.confirm(t('deleteConfirm', { subject: c.subject }))) return;
    setBusyId(c.id);
    try {
      await api.admin.emailCampaigns.remove(c.id, token);
      await load();
    } catch {
      setError(t('error'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        {!composerOpen && (
          <Button onClick={() => setComposerOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('newCampaign')}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {composerOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('composer.heading')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-deep">
                {t('composer.subjectLabel')}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('composer.subjectPlaceholder')}
                maxLength={200}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-bamboo-deep"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-deep">
                {t('composer.bodyLabel')}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('composer.bodyPlaceholder')}
                rows={8}
                maxLength={20000}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-bamboo-deep"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-navy-deep">
                {t('composer.audienceLabel')}
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {AUDIENCE_ORDER.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      audience === a
                        ? 'border-bamboo-deep bg-bamboo/10'
                        : 'border-line bg-white hover:border-bamboo-deep/50'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-navy-deep">
                      {t(`audiences.${a}`)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(`audiences.${a}_hint`)}
                    </span>
                    <span className="mt-2 block font-mono text-xs text-bamboo-deep">
                      {t('recipients', { count: audienceCount(a) })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCreate} disabled={saving || !subject.trim() || !body.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? t('composer.saving') : t('composer.save')}
              </Button>
              <Button variant="ghost" onClick={() => setComposerOpen(false)} disabled={saving}>
                {t('composer.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {campaigns.map((c) => {
                const sentInfo =
                  c.status === 'SENT' || c.status === 'FAILED'
                    ? t('sentSummary', {
                        sent: c.sentCount,
                        total: c.recipientCount,
                        failed: c.failedCount,
                      })
                    : t('recipients', { count: audienceCount(c.audience) });
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}
                        >
                          {t(`statuses.${c.status}`)}
                        </span>
                        <p className="truncate text-sm font-semibold text-navy-deep">{c.subject}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(`audiences.${c.audience}`)} · {sentInfo} ·{' '}
                        {new Date(c.createdAt).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                    {c.status === 'DRAFT' && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSend(c)}
                          disabled={busyId === c.id}
                          className="gap-1.5"
                        >
                          {busyId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {busyId === c.id ? t('sending') : t('sendCta')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          className="gap-1.5 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('deleteCta')}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
