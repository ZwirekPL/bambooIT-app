import { getBackendToken } from '@/lib/server-token';
import { ScraperStatsManager } from '@/components/admin/ScraperStatsManager';

export const metadata = {
  title: 'Statystyki scrapera',
};

export default async function ScraperStatsPage() {
  const token = (await getBackendToken()) ?? '';
  return <ScraperStatsManager token={token} />;
}
