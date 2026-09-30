import type { Customer } from '@/lib/db-types'
import { sql } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import {
  RESET_TOKEN_TTL_MS,
  clearCustomerLoginFailures,
  hashPassword,
  hashResetToken,
} from '@/lib/auth'
import { passwordResetConfirmInput } from '@/lib/validators'

/**
 * POST /api/customer/password-reset/confirm — choose a new password with a
 * single-use reset token.
 *
 * 200 `{ ok: true }` on success — the password is re-hashed (scrypt), the
 * token is cleared (single-use) and EVERY CustomerSession for the account is
 * deleted: a completed reset signs out all devices, including this one.
 * 400 when the token matches no customer ("invalid or already used") or is
 * older than RESET_TOKEN_TTL_MS ("expired").
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, passwordResetConfirmInput)
  if (!parsed.ok) return parsed.response
  const { token, password } = parsed.data

  // resetTokenHash is not unique-indexed — plain SELECT LIMIT 1, not a unique lookup.
  const hash = hashResetToken(token)
  const rows = await sql<Customer[]>`
    SELECT * FROM "Customer" WHERE "resetTokenHash" = ${hash} LIMIT 1
  `
  const customer = rows[0]
  if (!customer) {
    return fail(400, 'This reset link is invalid or has already been used.')
  }
  if (!customer.resetTokenAt || customer.resetTokenAt.getTime() < Date.now() - RESET_TOKEN_TTL_MS) {
    return fail(400, 'This reset link has expired — request a new one.')
  }

  // scrypt is sync-CPU work — hash BEFORE the transaction, not inside it.
  const passwordHash = hashPassword(password)
  const deletedSessions = await sql.begin(async (tx) => {
    // Security: a completed reset invalidates every signed-in device.
    const deleted = await tx<{ id: string }[]>`
      DELETE FROM "CustomerSession" WHERE "customerId" = ${customer.id} RETURNING id
    `
    await tx`
      UPDATE "Customer"
      SET "passwordHash" = ${passwordHash}, "resetTokenHash" = NULL, "resetTokenAt" = NULL, "updatedAt" = now()
      WHERE id = ${customer.id}
    `
    return deleted.length
  })
  clearCustomerLoginFailures(customer.email)

  console.log(
    `[api/customer/password-reset] password updated for ${customer.email} — ${deletedSessions} session(s) invalidated`,
  )

  return ok({ ok: true })
}
