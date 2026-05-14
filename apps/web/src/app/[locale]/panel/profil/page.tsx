import type { Metadata } from 'next';
import { BRAND } from '@config/brand';
import { CompanyProfileForm } from '@/components/client-panel/CompanyProfileForm';

export const metadata: Metadata = {
  title: `Dane firmy — ${BRAND.name}`,
  robots: { index: false, follow: false },
};

export default function ClientProfilePage() {
  return <CompanyProfileForm />;
}
