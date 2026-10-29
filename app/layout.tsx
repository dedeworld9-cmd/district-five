import type { Metadata, Viewport } from 'next';
import { THEMES } from '@/lib/brand';
import { SITE } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.shortName}` },
  description: `${SITE.name} on ${SITE.community.name}. ${SITE.welcome}`,
  icons: { icon: SITE.logo },
};

export const viewport: Viewport = { themeColor: '#07090e' };

const theme = THEMES[SITE.department];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={theme ? ({ '--theme-a': theme.a, '--theme-b': theme.b, '--theme-bg': theme.bg } as React.CSSProperties) : undefined}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
