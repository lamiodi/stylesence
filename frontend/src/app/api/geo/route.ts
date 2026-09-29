import type { NextRequest } from 'next/server'

/**
 * Visitor country for the display-currency suggestion. Reads Vercel's
 * injected geo header — no third-party IP API, no keys. Null when absent
 * (local dev, hardened proxies); the client then falls back to a timezone
 * heuristic. This concrete route outranks the after-files `/api/*` rewrite
 * to the Render backend (docs/01-app rewrites: filesystem routes are checked
 * before afterFiles rewrites) and must never be cached — the answer is
 * per-visitor.
 */
export function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country')
  return Response.json({ country }, { headers: { 'Cache-Control': 'private, no-store' } })
}
