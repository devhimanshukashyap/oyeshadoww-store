/**
 * Minimal structured logger.
 *
 * Rules (see docs/SECURITY.md "Logging" section):
 * - Never pass passwords, password hashes, API secrets, Razorpay key
 *   secrets, R2 credentials, or full webhook signatures into `meta`.
 * - Every log line is one JSON object per line (easy to ship to any log
 *   aggregator later) with a timestamp, level, event name, and metadata.
 *
 * Recent-errors buffer: a small, bounded, in-memory ring buffer of the
 * last error-level events, surfaced on Admin -> Health ("Recent
 * application errors"). This is intentionally lightweight — no external
 * log aggregation service, no database table — and only ever stores the
 * event *name* (e.g. "api.unhandled_error") and timestamp, never the
 * full `meta` payload, so there is no path for a future call site's
 * metadata to leak into an admin-visible list even by accident. For the
 * structured, sourced failures (webhook/payment/upload failures), the
 * health page reads the actual database records instead (see
 * health.service.ts) — this buffer is only a catch-all for unexpected
 * errors that aren't already tracked in a table.
 *
 * Caveat: this resets on process restart and is per-instance. That's a
 * fine trade-off for a single-server deployment (the default target for
 * this project — see docs/DEPLOYMENT.md); if you later scale to multiple
 * instances, treat this panel as "recent errors on whichever instance
 * served this request," not a global error feed, or swap it for a real
 * log aggregator.
 */

type Level = "info" | "warn" | "error";

interface LogMeta {
  [key: string]: unknown;
}

export interface RecentErrorEvent {
  event: string;
  ts: string;
}

const RECENT_ERRORS_MAX = 25;
const recentErrors: RecentErrorEvent[] = [];

function write(level: Level, event: string, meta: LogMeta = {}) {
  const ts = new Date().toISOString();
  const line = { ts, level, event, ...meta };
  const serialized = JSON.stringify(line);

  if (level === "error") {
    console.error(serialized);
    recentErrors.unshift({ event, ts });
    if (recentErrors.length > RECENT_ERRORS_MAX) recentErrors.length = RECENT_ERRORS_MAX;
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  info: (event: string, meta?: LogMeta) => write("info", event, meta),
  warn: (event: string, meta?: LogMeta) => write("warn", event, meta),
  error: (event: string, meta?: LogMeta) => write("error", event, meta),
};

/** Returns the most recent error-level events (newest first), for the admin health page. */
export function getRecentErrorEvents(): RecentErrorEvent[] {
  return [...recentErrors];
}
