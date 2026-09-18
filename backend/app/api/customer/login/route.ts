import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import {
  CUSTOMER_COOKIE,
  checkCustomerLoginRateLimit,
  clearCustomerLoginFailures,
  createCustomerSession,
  customerCookieOptions,
  recordCustomerLoginFailure,
  verifyPassword,
} from '@/lib/auth'
import { customerLoginInput } from '@/lib/validators'

/**
 * POST /api/customer/login — sign in with email + password.
 * 200 `{ customer: { id, name, email } }` + the `ss_customer` cookie.
 * 429 when rate-limited (5 failures / email / 5 min); 401 is deliberately generic.
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, customerLoginInput)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  if (!checkCustomerLoginRateLimit(email)) {
    return fail(429, 'Too many attempts — try again in a few minutes.')
  }

  const customer = await db.customer.findUnique({ where: { email } })
  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    recordCustomerLoginFailure(email)
    return fail(401, 'Incorrect email or password.')
  }

  clearCustomerLoginFailures(email)
  const { token, expiresAt } = await createCustomerSession(customer.id)

  const res = ok({ customer: { id: customer.id, name: customer.name, email: customer.email } })
  res.cookies.set(CUSTOMER_COOKIE, token, { ...customerCookieOptions(), expires: expiresAt })
  return res
}
