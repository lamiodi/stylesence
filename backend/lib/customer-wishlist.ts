import { sql, cuid, sqlIn, sqlJoin } from '@/lib/db'

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
  const rows = await sql<{ slug: string; isActive: boolean }[]>`
    SELECT slug, "isActive" FROM "Product" WHERE slug IN ${sqlIn([...slugs])}
  `
  const active = new Set(rows.filter((p) => p.isActive).map((p) => p.slug))
  for (const slug of slugs) {
    if (!active.has(slug)) return slug
  }
  return null
}

/** Replace the persisted wishlist atomically (delete + batch insert, position = index). */
export async function replaceWishlist(customerId: string, slugs: readonly string[]): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM "WishlistItem" WHERE "customerId" = ${customerId}`
    if (slugs.length === 0) return
    const rows = slugs.map(
      (slug, position) => sql`(${cuid()}, ${customerId}, ${slug}, ${position}, now())`,
    )
    await tx`
      INSERT INTO "WishlistItem" (id, "customerId", slug, position, "createdAt")
      VALUES ${sqlJoin(rows, ', ')}
    `
  })
}

/** Hydrate persisted rows into the client item shape — active products only, position order.
 *  WishlistItem stores bare slugs (no FK), so products are looked up by slug;
 *  rows pointing at inactive/deleted pieces are filtered from the view. */
export async function hydrateWishlistItems(customerId: string): Promise<WishlistItemView[]> {
  const rows = await sql<{ slug: string }[]>`
    SELECT slug FROM "WishlistItem" WHERE "customerId" = ${customerId} ORDER BY position ASC
  `
  if (rows.length === 0) return []

  type ProductRow = { slug: string; name: string; price: number; imgs: string[] | null }
  const products = await sql<ProductRow[]>`
    SELECT p.slug, p.name, p.price,
      (SELECT json_agg(src.url)
        FROM (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 2) src
      ) AS imgs
    FROM "Product" p
    WHERE p."isActive" = true AND p.slug IN ${sqlIn(rows.map((r) => r.slug))}
  `
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const items: WishlistItemView[] = []
  for (const row of rows) {
    const product = bySlug.get(row.slug)
    if (!product) continue
    items.push({
      slug: product.slug,
      name: product.name,
      price: product.price,
      primaryImage: product.imgs?.[0] ?? null,
      secondaryImage: product.imgs?.[1] ?? null,
    })
  }
  return items
}
