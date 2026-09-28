import { fail, ok, readValidated } from '@/lib/api-helpers'
import { getCustomerFromCookies } from '@/lib/auth'
import {
  dedupeSlugs,
  findOffendingWishlistSlug,
  hydrateWishlistItems,
  replaceWishlist,
} from '@/lib/customer-wishlist'
import { wishlistSlugsInput } from '@/lib/validators'

/**
 * /api/customer/wishlist — server persistence for the signed-in customer's wishlist.
 * GET  → `{ items }` hydrated (active products only, position order).
 * PUT  `{ slugs }` → validates every slug (400 names the offending one),
 *      replaces the persisted set atomically, returns the hydrated items in
 *      the submitted order.
 */
export async function GET() {
  const customer = await getCustomerFromCookies()
  if (!customer) return fail(401, 'Unauthorized')

  const items = await hydrateWishlistItems(customer.id)
  return ok({ items })
}

export async function PUT(req: Request) {
  const customer = await getCustomerFromCookies()
  if (!customer) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, wishlistSlugsInput)
  if (!parsed.ok) return parsed.response
  const slugs = dedupeSlugs(parsed.data.slugs)

  const offending = await findOffendingWishlistSlug(slugs)
  if (offending) return fail(400, `Unknown product slug: ${offending}`)

  await replaceWishlist(customer.id, slugs)
  const items = await hydrateWishlistItems(customer.id)
  return ok({ items })
}
