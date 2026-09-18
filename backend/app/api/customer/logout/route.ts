import { cookies } from 'next/headers'
import { ok } from '@/lib/api-helpers'
import { CUSTOMER_COOKIE, customerCookieOptions, deleteCustomerSession } from '@/lib/auth'

/**
 * POST /api/customer/logout — delete the session row + clear the cookie.
 * Always 200 `{ ok: true }` (idempotent — signing out while signed out is fine).
 */
export async function POST() {
  const jar = await cookies()
  const token = jar.get(CUSTOMER_COOKIE)?.value
  if (token) await deleteCustomerSession(token)

  const res = ok({ ok: true })
  res.cookies.set(CUSTOMER_COOKIE, '', { ...customerCookieOptions(), maxAge: 0 })
  return res
}
