"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  RefreshCcw,
  Loader2,
  Webhook,
  UploadCloud,
  IndianRupee,
  AlertOctagon,
  type LucideIcon,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { HealthSnapshot, HealthStatus } from "@/server/services/health.service";

export function HealthDashboard({ initialSnapshot }: { initialSnapshot: HealthSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (!res.ok) throw new Error("Health check request failed");
      const data: HealthSnapshot = await res.json();
      setSnapshot(data);
    } catch {
      // Keep showing the last known-good snapshot rather than clearing the
      // page — a failed refresh is itself useful information, shown
      // inline, without losing what we already know.
      setRefreshError("Couldn't refresh just now. Showing the last known status.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <OverallBanner
        status={snapshot.overallStatus}
        generatedAt={snapshot.generatedAt}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      {refreshError && <p className="text-sm text-danger">{refreshError}</p>}

      <ApplicationCard app={snapshot.application} />

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Core services</h2>
        <div className="card divide-y divide-border">
          {snapshot.checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-ink">{check.name}</p>
                <p className="text-xs text-ink-faint">
                  {check.detail}
                  {check.latencyMs != null && ` · ${check.latencyMs}ms`}
                </p>
              </div>
              <StatusBadge status={check.status} />
            </div>
          ))}
        </div>
      </section>

      <ActivityCard
        icon={Webhook}
        title="Webhook activity"
        rows={[
          { label: "Last event received", value: formatOrNever(snapshot.webhookActivity.lastEventAt) },
          {
            label: "Last event type / status",
            value: snapshot.webhookActivity.lastEventType
              ? `${snapshot.webhookActivity.lastEventType} — ${snapshot.webhookActivity.lastEventStatus}`
              : "—",
          },
          { label: "Last successfully processed", value: formatOrNever(snapshot.webhookActivity.lastSuccessAt) },
          {
            label: "Failures in the last 24h",
            value: String(snapshot.webhookActivity.recentFailureCount),
            warn: snapshot.webhookActivity.recentFailureCount > 0,
          },
        ]}
      />

      <ActivityCard
        icon={UploadCloud}
        title="Storage / upload activity"
        rows={[
          { label: "Last successful upload", value: formatOrNever(snapshot.storageActivity.lastSuccessfulUploadAt) },
          {
            label: "Last failed upload",
            value: formatOrNever(snapshot.storageActivity.lastFailedUploadAt),
            warn: !!snapshot.storageActivity.lastFailedUploadAt,
          },
        ]}
      />

      <ActivityCard
        icon={IndianRupee}
        title="Payment activity"
        rows={[
          { label: "Last successful payment", value: formatOrNever(snapshot.paymentActivity.lastSuccessfulPaymentAt) },
          {
            label: "Last failed payment",
            value: formatOrNever(snapshot.paymentActivity.lastFailedPaymentAt),
            warn: !!snapshot.paymentActivity.lastFailedPaymentAt,
          },
        ]}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Recent operational errors</h2>
          <span className="text-xs text-ink-faint">
            {snapshot.recentErrors.totalRecentCount} in the last 24h
          </span>
        </div>
        {snapshot.recentErrors.items.length === 0 ? (
          <div className="card flex items-center gap-2.5 p-4 text-sm text-ink-muted">
            <CheckCircle2 size={16} className="text-success" />
            No recent errors.
          </div>
        ) : (
          <div className="card divide-y divide-border">
            {snapshot.recentErrors.items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <AlertOctagon size={15} className="mt-0.5 shrink-0 text-danger" />
                <div className="min-w-0">
                  <p className="break-words text-sm text-ink">{item.message}</p>
                  <p className="text-xs text-ink-faint">
                    {formatDateTime(item.at)} · <span className="uppercase">{item.source}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OverallBanner({
  status,
  generatedAt,
  refreshing,
  onRefresh,
}: {
  status: HealthStatus;
  generatedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="flex items-center gap-3">
        <StatusIcon status={status} size={28} />
        <div>
          <p className="font-display text-lg font-semibold text-ink">System status: {statusLabel(status)}</p>
          <p className="text-xs text-ink-faint">Last checked {formatDateTime(generatedAt)}</p>
        </div>
      </div>
      <button onClick={onRefresh} disabled={refreshing} className="btn-secondary">
        {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
        Refresh
      </button>
    </div>
  );
}

function ApplicationCard({ app }: { app: HealthSnapshot["application"] }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-semibold text-ink">Application</h2>
      <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Status" value={statusLabel(app.status)} />
        <Stat label="Environment" value={app.environment} />
        <Stat label="Version" value={app.version} />
        <Stat label="Uptime" value={formatUptime(app.uptimeSeconds)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function ActivityCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: LucideIcon;
  title: string;
  rows: { label: string; value: string; warn?: boolean }[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Icon size={16} className="text-ink-faint" />
        {title}
      </h2>
      <div className="card divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm text-ink-muted">{row.label}</span>
            <span className={cn("text-sm font-medium", row.warn ? "text-warning" : "text-ink")}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const styles: Record<HealthStatus, string> = {
    HEALTHY: "bg-success/15 text-success",
    WARNING: "bg-warning/15 text-warning",
    ERROR: "bg-danger/15 text-danger",
    NOT_CONFIGURED: "bg-ink-faint/15 text-ink-faint",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium", styles[status])}>
      <StatusIcon status={status} size={13} />
      {statusLabel(status)}
    </span>
  );
}

function StatusIcon({ status, size = 16 }: { status: HealthStatus; size?: number }) {
  if (status === "HEALTHY") return <CheckCircle2 size={size} className="text-success" />;
  if (status === "WARNING") return <AlertTriangle size={size} className="text-warning" />;
  if (status === "ERROR") return <XCircle size={size} className="text-danger" />;
  return <MinusCircle size={size} className="text-ink-faint" />;
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case "HEALTHY":
      return "Healthy";
    case "WARNING":
      return "Warning";
    case "ERROR":
      return "Error";
    case "NOT_CONFIGURED":
      return "Not Configured";
  }
}

function formatOrNever(iso: string | null): string {
  return iso ? formatDateTime(iso) : "Never";
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.join(" ") || "0m";
}
