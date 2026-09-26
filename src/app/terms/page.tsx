import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { termsDocs } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: 'Terms of Use — Fursatly',
  description: 'The rules for using Fursatly, what we do and do not guarantee, and how to request content removal.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalPage docs={termsDocs} />;
}
