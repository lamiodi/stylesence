import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/me → `{ admin: { name, email, role } }` | 401. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  return ok({ admin: { name: admin.name, email: admin.email, role: admin.role } })
}
