import { cookies } from 'next/headers'
import { ok } from '@/lib/api-helpers'
import { ADMIN_COOKIE, adminCookieOptions, deleteAdminSession } from '@/lib/auth'

/** POST /api/admin/logout — deletes the session row + clears the cookie. */
export async function POST() {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE)?.value
  if (token) {
    await deleteAdminSession(token)
  }
  const res = ok({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(), maxAge: 0 })
  return res
}
