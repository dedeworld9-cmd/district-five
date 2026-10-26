import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'District Five Law Enforcement Hub', template: '%s · District Five' },
  description: 'Hub for the District Five PS5 law enforcement roleplay community: BCSO and SAHP under DPS.',
};

export const viewport: Viewport = { themeColor: '#07090e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
