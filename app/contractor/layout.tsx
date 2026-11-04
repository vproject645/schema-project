import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contractor Hub — Schema',
  description: 'Track permit blockers, field blockers, professional stamps and owner inputs, and coordinate RFIs before they delay the job.',
};

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
