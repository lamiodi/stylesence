import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  checkLoginRateLimit,
  clearLoginFailures,
  createAdminSession,
  recordLoginFailure,
  verifyPassword,
} from '@/lib/auth'
import { loginInput } from '@/lib/validators'

/**
 * POST /api/admin/login
 * Sets the `ss_admin` cookie on success → `{ admin: { name, email, role } }`.
 * 401 on bad credentials; naive rate limit (5 failures / email / 5 min → 429).
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, loginInput)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  if (!checkLoginRateLimit(email)) {
    return fail(429, 'Too many login attempts. Please wait a few minutes and try again.')
  }

  const admin = await db.adminUser.findUnique({ where: { email } })
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    recordLoginFailure(email)
    return fail(401, 'Invalid email or password')
  }

  clearLoginFailures(email)
  const { token, expiresAt } = await createAdminSession(admin.id)

  const res = ok({ admin: { name: admin.name, email: admin.email, role: admin.role } })
  res.cookies.set(ADMIN_COOKIE, token, { ...adminCookieOptions(), expires: expiresAt })
  return res
}
