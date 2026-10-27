import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'District Five Departments Hub', template: '%s · District Five' },
  description: 'District Five Departments Hub for The Lounge Roleplay: law enforcement (BCSO, SAHP) and Fire/EMS (SAFD, SAEMS).',
};

export const viewport: Viewport = { themeColor: '#07090e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
