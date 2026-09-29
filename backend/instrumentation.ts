/**
 * Server-start hook (Next.js instrumentation). The backend runs as one
 * long-lived Node server on Render, which makes it the natural home for the
 * PENDING_PAYMENT reaper schedule — no extra cron service to run.
 *
 * Env (see render.yaml):
 *   REAPER_ENABLED   'true' arms the schedule (default: off — dev and any
 *                    environment that hasn't opted in never cancels anything)
 *   REAPER_DRY_RUN   unset/'true' = log-only passes; 'false' = live cancelling
 *   PENDING_TTL_DAYS staleness threshold, default 3
 *
 * register() must return before the server takes requests, so the first
 * pass is deferred and every timer is unref'd.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.REAPER_ENABLED !== 'true') return

  const { reapPendingOrders } = await import('./scripts/reap-pending-orders')
  const ttlDays = Number(process.env.PENDING_TTL_DAYS ?? 3) || 3
  const dryRun = process.env.REAPER_DRY_RUN !== 'false'
  const intervalMs = 6 * 60 * 60 * 1000 // every 6 hours

  const run = () =>
    reapPendingOrders(dryRun, ttlDays).catch((err) =>
      console.error('[reaper] scheduled run failed:', err),
    )

  console.log(`[reaper] armed — every ${intervalMs / 3_600_000}h, TTL ${ttlDays}d, ${dryRun ? 'DRY-RUN' : 'live'}`)
  const first = setTimeout(run, 60_000)
  const every = setInterval(run, intervalMs)
  first.unref?.()
  every.unref?.()
}
