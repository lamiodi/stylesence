import { sql, sqlIn, sqlJoin } from '@/lib/db'
import { cachedJson, okCached } from '@/lib/api-helpers'
import type { LookPiece, LookView } from '@/lib/types'

/**
 * GET /api/looks — editorial "Shop the look" rows for the home page.
 * Anchors are products whose admin-curated "Complete the look" relations
 * (ProductRelation) yield at least one active partner; ordered by partner
 * count, then recency. Topped up to 3 with featured pieces (category
 * fallback for their partners) so the section always has content.
 * Each look's pieces[0] is the anchor itself.
 */

const MAX_LOOKS = 3
const MAX_PARTNERS = 3

type AnchorRow = {
  slug: string
  name: string
  subtitle: string | null
  price: number
  categoryName: string | null
  primaryImage: string | null
  partners: LookPiece[]
}

function toLook(anchor: AnchorRow, source: LookView['source']): LookView {
  return {
    slug: anchor.slug,
    title: anchor.name,
    subtitle: anchor.subtitle,
    categoryName: anchor.categoryName,
    image: anchor.primaryImage,
    pieces: [{ slug: anchor.slug, name: anchor.name, price: anchor.price }, ...anchor.partners.slice(0, MAX_PARTNERS)],
    source,
  }
}

async function loadLooks() {
  // 1) Curated anchors: active products with at least one active curated partner.
  //    (The curated partner images Prisma fetched here were never used — only
  //    slug/name/price feed the response.)
  const curatedRows = await sql<
    (Omit<AnchorRow, 'partners'> & {
      relations: Array<{ slug: string; name: string; price: number; isActive: boolean }> | null
    })[]
  >`
    SELECT
      p.slug, p.name, p.subtitle, p.price,
      c.name AS "categoryName",
      (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) AS "primaryImage",
      (SELECT json_agg(json_build_object('slug', r.slug, 'name', r.name, 'price', r.price, 'isActive', r."isActive") ORDER BY pr.position ASC)
        FROM "ProductRelation" pr
        JOIN "Product" r ON r.id = pr."relatedId"
        WHERE pr."productId" = p.id) AS relations
    FROM "Product" p
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE p."isActive" = true
      AND EXISTS (SELECT 1 FROM "ProductRelation" pr WHERE pr."productId" = p.id)
    ORDER BY p."updatedAt" DESC
  `

  const curatedAnchors: AnchorRow[] = curatedRows
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle,
      price: p.price,
      categoryName: p.categoryName,
      primaryImage: p.primaryImage,
      // Curated order preserved; inactive partners are filtered at read time.
      partners: (p.relations ?? [])
        .filter((r) => r.isActive)
        .map((r) => ({ slug: r.slug, name: r.name, price: r.price })),
    }))
    .filter((a) => a.partners.length > 0)

  curatedAnchors.sort((a, b) => b.partners.length - a.partners.length)

  const looks: LookView[] = curatedAnchors.slice(0, MAX_LOOKS).map((a) => toLook(a, 'curated'))

  // 2) Featured top-up when curation runs short (partners = same category).
  if (looks.length < MAX_LOOKS) {
    const usedSlugs = new Set(looks.map((l) => l.slug))
    const conds = [sql`p."isActive" = true`]
    if (usedSlugs.size > 0) conds.push(sql`p.slug NOT IN ${sqlIn([...usedSlugs])}`)
    const featured = await sql<
      (Omit<AnchorRow, 'partners' | 'primaryImage'> & { categoryId: string | null; primaryImage: string | null })[]
    >`
      SELECT
        p.slug, p.name, p.subtitle, p.price, p."categoryId",
        c.name AS "categoryName",
        (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) AS "primaryImage"
      FROM "Product" p
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE ${sqlJoin(conds, ' AND ')}
      ORDER BY p."isFeatured" DESC, p."createdAt" DESC
    `

    for (const p of featured) {
      if (looks.length >= MAX_LOOKS) break
      const partners = p.categoryId
        ? await sql<LookPiece[]>`
            SELECT slug, name, price FROM "Product"
            WHERE "isActive" = true AND "categoryId" = ${p.categoryId} AND slug <> ${p.slug}
            ORDER BY "createdAt" DESC
            LIMIT ${MAX_PARTNERS}
          `
        : []
      // Only fall back to category partners — a look without partners isn't a look.
      if (partners.length === 0) continue
      looks.push(
        toLook(
          {
            slug: p.slug,
            name: p.name,
            subtitle: p.subtitle,
            price: p.price,
            categoryName: p.categoryName,
            primaryImage: p.primaryImage,
            partners,
          },
          'featured',
        ),
      )
    }
  }

  return { looks, total: looks.length }
}

export async function GET() {
  const body = await cachedJson('looks:', 60_000, loadLooks)
  return okCached(body)
}
