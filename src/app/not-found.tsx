import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-raised text-ink-faint">
        <Compass size={24} />
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-sm text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-2 flex gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/shop" className="btn-secondary">Browse bundles</Link>
      </div>
    </div>
  );
}
