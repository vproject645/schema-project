import type { Metadata, Viewport } from 'next';
import './globals.css';

const title = 'Schema — the autonomous project agent for commercial fit-outs';
const description = 'Start with a brief and your PDFs. Schema builds the understanding, a linked 2D/3D concept, a permit strategy and a reviewed handoff. You approve every decision that matters.';

export const metadata: Metadata = {
  title: { default: title, template: '%s' },
  description,
  applicationName: 'Schema',
  openGraph: { title, description, type: 'website', siteName: 'Schema' },
  twitter: { card: 'summary', title, description },
  icons: { icon: { url: '/icon.svg', type: 'image/svg+xml' } },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#29342c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
