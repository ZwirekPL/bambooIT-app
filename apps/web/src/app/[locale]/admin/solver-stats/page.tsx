import { getBackendToken } from '@/lib/server-token';
import { SolverStatsManager } from '@/components/admin/SolverStatsManager';

export const metadata = {
  title: 'Statystyki solvera (Faza D)',
};

export default async function SolverStatsPage() {
  const token = (await getBackendToken()) ?? '';
  return <SolverStatsManager token={token} />;
}
