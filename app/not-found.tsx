import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-32 text-center">
      <div className="label">Not found</div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight">That page or record does not exist, or you cannot see it.</h1>
      <Link href="/hub" className="btn mt-8">Back to the hub</Link>
    </main>
  );
}
