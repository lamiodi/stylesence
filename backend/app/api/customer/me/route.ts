import type { Customer } from '@/lib/db-types'
import { sql, sqlJoin } from '@/lib/db'
import { fail, ok, readValidated, toCustomerProfile } from '@/lib/api-helpers'
import { getCustomerFromCookies } from '@/lib/auth'
import { customerPatchInput } from '@/lib/validators'

/**
 * /api/customer/me — the signed-in customer profile (cookie `ss_customer`).
 * GET   → 200 `{ customer: profile | null }` — null simply means signed out (never an error).
 * PATCH → 401 when signed out; partial update of name/phone/defaultAddress/defaultCity/
 *         defaultState. Empty strings clear (stored as null); absent keys are untouched.
 */
export async function GET() {
  const customer = await getCustomerFromCookies()
  return ok({ customer: customer ? toCustomerProfile(customer) : null })
}

export async function PATCH(req: Request) {
  const customer = await getCustomerFromCookies()
  if (!customer) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, customerPatchInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const data: {
    name?: string
    phone?: string | null
    defaultAddress?: string | null
    defaultCity?: string | null
    defaultState?: string | null
  } = {}
  if (input.name !== undefined) data.name = input.name
  if (input.phone !== undefined) data.phone = input.phone
  if (input.defaultAddress !== undefined) data.defaultAddress = input.defaultAddress
  if (input.defaultCity !== undefined) data.defaultCity = input.defaultCity
  if (input.defaultState !== undefined) data.defaultState = input.defaultState
  if (Object.keys(data).length === 0) return fail(400, 'Nothing to update')

  // Partial UPDATE built from the patched keys only; Prisma's @updatedAt
  // behaviour is preserved by always setting "updatedAt" = now().
  const assignments = [sql`"updatedAt" = now()`]
  if (data.name !== undefined) assignments.push(sql`name = ${data.name}`)
  if (data.phone !== undefined) assignments.push(sql`phone = ${data.phone}`)
  if (data.defaultAddress !== undefined) assignments.push(sql`"defaultAddress" = ${data.defaultAddress}`)
  if (data.defaultCity !== undefined) assignments.push(sql`"defaultCity" = ${data.defaultCity}`)
  if (data.defaultState !== undefined) assignments.push(sql`"defaultState" = ${data.defaultState}`)

  const rows = await sql<Customer[]>`
    UPDATE "Customer" SET ${sqlJoin(assignments, ', ')}
    WHERE id = ${customer.id}
    RETURNING *
  `
  const updated = rows[0]
  return ok({ customer: toCustomerProfile(updated) })
}
