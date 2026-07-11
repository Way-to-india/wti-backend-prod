/**
 * Enrichment worker entry.
 *   bun run src/scripts/enrichment-worker.ts          # continuous (PM2)
 *   bun run src/scripts/enrichment-worker.ts --once    # single drain (cron tick)
 */
import { runWorker, drainOnce } from '@/services/enrichment/worker';

const once = process.argv.includes('--once');

(async () => {
  if (once) {
    const n = await drainOnce(20);
    console.log(`[enrichment-worker] drained ${n} job(s)`);
    process.exit(0);
  }
  await runWorker();
})().catch((e) => { console.error('[enrichment-worker] fatal:', e); process.exit(1); });
