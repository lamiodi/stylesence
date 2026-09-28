import { db } from '@/lib/db'
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
 * POST /api/customer/wishlist/merge — union the submitted slugs (a device's local
 * wishlist) with the persisted server set: submitted-first, then existing,
 * de-duplicated, capped at 60. Persists the merged set and returns the hydrated
 * items so the client can adopt it as the new local truth.
 */
export async function POST(req: Request) {
  const customer = await getCustomerFromCookies()
  if (!customer) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, wishlistSlugsInput)
  if (!parsed.ok) return parsed.response
  const submitted = dedupeSlugs(parsed.data.slugs)

  const offending = await findOffendingWishlistSlug(submitted)
  if (offending) return fail(400, `Unknown product slug: ${offending}`)

  const existing = await db.wishlistItem.findMany({
    where: { customerId: customer.id },
    orderBy: { position: 'asc' },
    select: { slug: true },
  })

  const merged = dedupeSlugs([...submitted, ...existing.map((row) => row.slug)]).slice(0, 60)
  await replaceWishlist(customer.id, merged)
  const items = await hydrateWishlistItems(customer.id)
  return ok({ items })
}
