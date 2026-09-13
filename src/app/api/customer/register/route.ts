import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { CUSTOMER_COOKIE, createCustomerSession, customerCookieOptions, hashPassword } from '@/lib/auth'
import { customerRegisterInput } from '@/lib/validators'

/**
 * POST /api/customer/register — create a customer account and sign in.
 * 201 `{ customer: { id, name, email } }` + the `ss_customer` cookie.
 * 409 (no detail beyond the fact) when the email is already registered.
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, customerRegisterInput)
  if (!parsed.ok) return parsed.response
  const { name, email, password } = parsed.data

  const existing = await db.customer.findUnique({ where: { email }, select: { id: true } })
  if (existing) return fail(409, 'An account with this email already exists.')

  let customer: { id: string; name: string; email: string }
  try {
    customer = await db.customer.create({
      data: { name, email, passwordHash: hashPassword(password) },
      select: { id: true, name: true, email: true },
    })
  } catch (e) {
    // Unique-race between the check above and the insert — same answer, no extra detail.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return fail(409, 'An account with this email already exists.')
    }
    throw e
  }

  const { token, expiresAt } = await createCustomerSession(customer.id)
  const res = ok({ customer }, { status: 201 })
  res.cookies.set(CUSTOMER_COOKIE, token, { ...customerCookieOptions(), expires: expiresAt })
  return res
}
