import { sql } from '@/lib/db'
import type { NewsletterSubscriber } from '@/lib/db-types'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/subscribers — newsletter subscribers, newest first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const subscribers = await sql<NewsletterSubscriber[]>`
    SELECT * FROM "NewsletterSubscriber" ORDER BY "createdAt" DESC
  `
  return ok({
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      source: s.source,
      createdAt: s.createdAt,
    })),
  })
}
