/**
 * Deletes expired temporary batch-download ZIPs from R2 and marks their
 * jobs EXPIRED. Run this on a schedule (cron, a scheduled task in your
 * host, GitHub Actions, etc) — see docs/DEPLOYMENT.md "Scheduled cleanup."
 *
 * Usage: npm run cleanup:archives
 */
import { cleanupExpiredArchives } from "../src/server/services/download.service";

async function main() {
  const count = await cleanupExpiredArchives();
  console.log(`Cleaned up ${count} expired archive(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
