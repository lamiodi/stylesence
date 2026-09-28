import { db } from '@/lib/db'
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

  const updated = await db.customer.update({ where: { id: customer.id }, data })
  return ok({ customer: toCustomerProfile(updated) })
}
