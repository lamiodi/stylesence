import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/subscribers — newsletter subscribers, newest first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const subscribers = await db.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } })
  return ok({
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      source: s.source,
      createdAt: s.createdAt,
    })),
  })
}
