'use client';

import { useState } from 'react';

// Save the page as a PDF through the browser's print dialog (on phones: Print, then Save to Files
// or Save as PDF), or share the link. The print stylesheet strips the hub chrome.
export function SaveRecord({ title, label = 'Save as PDF' }: { title: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelled */ }
  };
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button type="button" className="btn btn-sm" onClick={() => window.print()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
        </svg>
        {label}
      </button>
      <button type="button" className="btn btn-sm" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
    </div>
  );
}

// Shown only on paper: who the record belongs to and that it is fictional.
export function PrintHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="print-only mb-6 border-b pb-3">
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>District Five Department Hub · The Lounge Roleplay</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 10, marginTop: 6 }} suppressHydrationWarning>Fictional roleplay record. Not affiliated with any real government agency. Saved {new Date().toLocaleString()}.</div>
    </div>
  );
}
