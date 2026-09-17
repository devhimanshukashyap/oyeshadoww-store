import { HealthSkeleton } from "@/components/skeletons";

export default function AdminHealthLoading() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">System Health</h1>
      <p className="mt-1 text-sm text-ink-muted">Checking live status…</p>
      <div className="mt-6">
        <HealthSkeleton />
      </div>
    </div>
  );
}
