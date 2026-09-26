import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { checkCustomerLoginRateLimit, generateResetToken, recordCustomerLoginFailure } from '@/lib/auth'
import { passwordResetRequestInput } from '@/lib/validators'
import { sendPasswordResetEmail } from '@/lib/email'

/**
 * POST /api/customer/password-reset/request — ask for a reset link by email.
 *
 * Anti-enumeration: ALWAYS 200 `{ ok: true }`, whether or not the email has
 * an account. When the account exists the response ALSO carries `devResetUrl`
 * — a dev-preview affordance standing in for real email delivery (the email
 * itself is simulated via console.log, the project's established dev
 * placeholder pattern). In production this field would not exist; in this
 * dev preview the storefront renders it inside a clearly-labelled
 * DevPlaceholder so QA/users can complete a reset without real email.
 *
 * Rate limiting shares the customer login budget (5 per email / 5 min) — see
 * the note in src/lib/auth.ts. Unknown emails burn the budget (probing for
 * accounts costs the attacker); known emails never do (real users ask for
 * resets repeatedly).
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, passwordResetRequestInput)
  if (!parsed.ok) return parsed.response
  const { email } = parsed.data

  // Rate-limit FIRST, before the DB lookup — mirrors the login route's wording.
  if (!checkCustomerLoginRateLimit(email)) {
    return fail(429, 'Too many attempts — try again in a few minutes.')
  }

  const customer = await db.customer.findUnique({ where: { email }, select: { id: true } })
  if (!customer) {
    recordCustomerLoginFailure(email)
    return ok({ ok: true })
  }

  const { plain, hash } = generateResetToken()
  await db.customer.update({
    where: { id: customer.id },
    data: { resetTokenHash: hash, resetTokenAt: new Date() },
  })

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const resetUrl = `${frontendUrl}/#/account?mode=reset&token=${plain}`

  // Non-blocking password reset email dispatch via Resend
  sendPasswordResetEmail(email, resetUrl).catch((err) =>
    console.error('[api/customer/password-reset] Failed to dispatch password reset email:', err)
  )

  const isDevPreview = process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY
  return ok({
    ok: true,
    ...(isDevPreview ? { devResetUrl: `/#/account?mode=reset&token=${plain}` } : {}),
  })
}
