import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { privacyDocs } from '@/lib/legal/privacy';

export const metadata: Metadata = {
  title: 'Privacy Policy — Fursatly',
  description: 'What Fursatly collects, why, who processes it, and your rights.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalPage docs={privacyDocs} />;
}
