/**
 * Naive in-memory IP rate limiter for public mutating endpoints (reviews,
 * newsletter, stock-alerts) — same trade-off as the login limiter in
 * lib/auth.ts: one long-lived Render instance, a restart simply clears the
 * window, which is fine for damping abuse, not for hard guarantees.
 */

const buckets = new Map<string, number[]>()

/** Best-effort client IP — behind the Vercel→Render proxy chain this is
 * x-forwarded-for's first hop; 'unknown' buckets everyone else together. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function recent(bucket: string, now: number, windowMs: number): number[] {
  return (buckets.get(bucket) ?? []).filter((t) => now - t < windowMs)
}

/**
 * True when the key is under the limit; records nothing when limited.
 * Calls that pass count immediately (fail-closed on the burst itself).
 */
export function checkIpRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = recent(key, now, windowMs)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}
