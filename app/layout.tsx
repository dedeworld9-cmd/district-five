import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'District Five Department Hub', template: '%s · District Five' },
  description: 'The District Five Department Hub on The Lounge Roleplay: law enforcement (BCSO, SAHP), Fire/EMS (SAFD, SAEMS) and dispatch, overseen by DPS.',
};

export const viewport: Viewport = { themeColor: '#07090e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
