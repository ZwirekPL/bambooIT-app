'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Plus } from 'lucide-react';

interface Props {
  patientId: string;
}

export function CreateManualPlanSheet({ patientId }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations('dietitian.createManual');

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [kcal, setKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [contentText, setContentText] = useState('{"text": ""}');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    let content: Record<string, unknown>;
    try {
      content = JSON.parse(contentText);
    } catch {
      setError(t('jsonError'));
      setLoading(false);
      return;
    }

    const token = '';
    try {
      await api.dietPlans.createManual(
        patientId,
        {
          kcal: kcal ? parseInt(kcal, 10) : undefined,
          proteinG: proteinG ? parseInt(proteinG, 10) : undefined,
          fatG: fatG ? parseInt(fatG, 10) : undefined,
          carbsG: carbsG ? parseInt(carbsG, 10) : undefined,
          content,
        },
        token
      );
      setOpen(false);
      setKcal('');
      setProteinG('');
      setFatG('');
      setCarbsG('');
      setContentText('{"text": ""}');
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('trigger')}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mp-kcal" className="text-xs">
                {t('kcalLabel')}
              </Label>
              <Input
                id="mp-kcal"
                type="number"
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mp-protein" className="text-xs">
                {t('proteinLabel')}
              </Label>
              <Input
                id="mp-protein"
                type="number"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mp-fat" className="text-xs">
                {t('fatLabel')}
              </Label>
              <Input
                id="mp-fat"
                type="number"
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mp-carbs" className="text-xs">
                {t('carbsLabel')}
              </Label>
              <Input
                id="mp-carbs"
                type="number"
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mp-content" className="text-xs">
              {t('contentLabel')}
            </Label>
            <textarea
              id="mp-content"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={14}
              placeholder={t('contentPlaceholder')}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t('submitting') : t('submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
