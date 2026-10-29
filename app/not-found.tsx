import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-32 text-center">
      <p className="text-[14px] text-muted">Not found</p>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight">That page or record does not exist, or you cannot see it.</h1>
      <div className="mt-8 flex justify-center gap-2">
        <Link href="/" className="btn">Public site</Link>
        <Link href="/hub" className="btn">Member hub</Link>
      </div>
    </main>
  );
}
