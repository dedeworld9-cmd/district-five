import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { getSession } from '@/lib/session';

// Shell for the public pages: header, page content and footer.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSession());
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div className="site-bg" aria-hidden="true" />
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter signedIn={signedIn} />
    </div>
  );
}
