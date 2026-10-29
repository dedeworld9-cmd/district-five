import type { ReactNode } from 'react';

// Heading block shared by every public section: title, one short intro line, optional link on the right.
export function SectionHeading({ id, title, intro, action }: { id?: string; title: string; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="h2">{title}</h2>
        {intro && <p className="mt-2 body-sm sm:text-[15px]">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

