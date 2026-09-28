import { db } from '@/lib/db'

/**
 * Server-side wishlist persistence for signed-in customers.
 * The zustand store (localStorage) stays the single source of truth for the UI;
 * these helpers hydrate / replace the WishlistItem rows behind the API.
 */

/** Wishlist item shape served to the client (mirrors the storefront card basics). */
export interface WishlistItemView {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  secondaryImage: string | null
}

/** De-duplicate a slug list preserving first-seen order. */
export function dedupeSlugs(slugs: readonly string[]): string[] {
  return [...new Set(slugs)]
}

/**
 * Validate that every slug resolves to an existing, active product.
 * Returns the first offending slug (for a 400 message) or null when all are fine.
 */
export async function findOffendingWishlistSlug(slugs: readonly string[]): Promise<string | null> {
  if (slugs.length === 0) return null
  const products = await db.product.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, isActive: true },
  })
  const active = new Set(products.filter((p) => p.isActive).map((p) => p.slug))
  for (const slug of slugs) {
    if (!active.has(slug)) return slug
  }
  return null
}

/** Replace the persisted wishlist atomically (deleteMany + createMany, position = index). */
export async function replaceWishlist(customerId: string, slugs: readonly string[]): Promise<void> {
  await db.$transaction([
    db.wishlistItem.deleteMany({ where: { customerId } }),
    db.wishlistItem.createMany({
      data: slugs.map((slug, position) => ({ customerId, slug, position })),
    }),
  ])
}

/** Hydrate persisted rows into the client item shape — active products only, position order.
 *  WishlistItem stores bare slugs (no FK), so products are looked up by slug;
 *  rows pointing at inactive/deleted pieces are filtered from the view. */
export async function hydrateWishlistItems(customerId: string): Promise<WishlistItemView[]> {
  const rows = await db.wishlistItem.findMany({
    where: { customerId },
    orderBy: { position: 'asc' },
    select: { slug: true },
  })
  if (rows.length === 0) return []

  const products = await db.product.findMany({
    where: { slug: { in: rows.map((r) => r.slug) }, isActive: true },
    select: {
      slug: true,
      name: true,
      price: true,
      images: { orderBy: { position: 'asc' }, take: 2, select: { url: true } },
    },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const items: WishlistItemView[] = []
  for (const row of rows) {
    const product = bySlug.get(row.slug)
    if (!product) continue
    items.push({
      slug: product.slug,
      name: product.name,
      price: product.price,
      primaryImage: product.images[0]?.url ?? null,
      secondaryImage: product.images[1]?.url ?? null,
    })
  }
  return items
}
