"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Full detail goes to the browser console / your monitoring — the UI
    // itself only ever shows a safe, generic message.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base px-6 text-center text-ink">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised text-danger">
          <AlertTriangle size={24} />
        </div>
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-ink-muted">Please try again. If this keeps happening, contact support.</p>
        <div className="mt-2 flex gap-3">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-secondary">Go home</Link>
        </div>
      </body>
    </html>
  );
}
