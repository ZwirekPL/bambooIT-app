import { redirect } from 'next/navigation';

// Fallback for root path '/' — middleware handles this, but this
// ensures a redirect to the default locale if middleware is bypassed.
export default function RootPage() {
  redirect('/pl');
}
