import { sql, cuid } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { CUSTOMER_COOKIE, createCustomerSession, customerCookieOptions, hashPassword } from '@/lib/auth'
import { customerRegisterInput } from '@/lib/validators'
import { sendWelcomeCustomerEmail } from '@/lib/email'

/**
 * POST /api/customer/register — create a customer account and sign in.
 * 201 `{ customer: { id, name, email } }` + the `ss_customer` cookie.
 * 409 (no detail beyond the fact) when the email is already registered.
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, customerRegisterInput)
  if (!parsed.ok) return parsed.response
  const { name, email, password } = parsed.data

  const existingRows = await sql<{ id: string }[]>`
    SELECT id FROM "Customer" WHERE email = ${email} LIMIT 1
  `
  if (existingRows[0]) return fail(409, 'An account with this email already exists.')

  let customer: { id: string; name: string; email: string }
  try {
    const rows = await sql<{ id: string; name: string; email: string }[]>`
      INSERT INTO "Customer" (id, name, email, "passwordHash", "createdAt", "updatedAt")
      VALUES (${cuid()}, ${name}, ${email}, ${hashPassword(password)}, now(), now())
      RETURNING id, name, email
    `
    customer = rows[0]
  } catch (e) {
    // Unique-race between the check above and the insert — same answer, no extra detail.
    if ((e as { code?: string }).code === '23505') {
      return fail(409, 'An account with this email already exists.')
    }
    throw e
  }

  const { token, expiresAt } = await createCustomerSession(customer.id)

  // Non-blocking welcome email dispatch via Resend
  sendWelcomeCustomerEmail(customer.email, customer.name).catch((err) =>
    console.error('[api/customer/register] Failed to dispatch welcome email:', err)
  )

  const res = ok({ customer }, { status: 201 })
  res.cookies.set(CUSTOMER_COOKIE, token, { ...customerCookieOptions(), expires: expiresAt })
  return res
}
