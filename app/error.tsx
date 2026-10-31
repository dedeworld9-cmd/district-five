'use client';

// Last-resort boundary: a page that throws shows this instead of a blank screen, with a retry.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-[28px] font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        The page could not load. Nothing you did was lost. Try again, and tell an administrator if it keeps happening.
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="btn btn-brand">Try again</button>
        <a href="/" className="btn">Public site</a>
      </div>
    </main>
  );
}
