'use client';

import { useRef, type ReactNode } from 'react';

// Asks before submitting the form it sits in. The server action behind the form is unchanged:
// the real submit button is only pressed after "Confirm". Uses the native <dialog> for focus and Escape.
export function ConfirmButton({ label, title, children, confirmLabel = 'Confirm', className = 'btn' }: {
  label: string; title: string; children: ReactNode; confirmLabel?: string; className?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => dlg.current?.showModal()}>{label}</button>
      <button ref={submit} type="submit" hidden tabIndex={-1} aria-hidden="true" />
      <dialog ref={dlg} aria-labelledby="confirm-title"
        className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line-strong bg-surface p-6 text-ink backdrop:bg-black/60">
        <h2 id="confirm-title" className="text-[17px] font-semibold">{title}</h2>
        <div className="mt-2 text-[14px] text-muted">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn" onClick={() => dlg.current?.close()}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => { dlg.current?.close(); submit.current?.click(); }}>{confirmLabel}</button>
        </div>
      </dialog>
    </>
  );
}
