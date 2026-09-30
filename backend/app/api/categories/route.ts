import { sql } from '@/lib/db'
import { cachedJson, okCached } from '@/lib/api-helpers'

/** GET /api/categories — ordered by position asc, productCount = active products. */
export async function GET() {
  const body = await cachedJson('categories:', 60_000, async () => {
    const categories = await sql<
      {
        id: string
        slug: string
        name: string
        tagline: string | null
        imageUrl: string | null
        productCount: number
      }[]
    >`
      SELECT c.id, c.slug, c.name, c.tagline, c."imageUrl",
        (SELECT COUNT(*)::int FROM "Product" p
          WHERE p."categoryId" = c.id AND p."isActive" = true) AS "productCount"
      FROM "Category" c
      ORDER BY c.position ASC
    `
    return {
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        imageUrl: c.imageUrl,
        productCount: c.productCount,
      })),
    }
  })
  return okCached(body)
}
