import { sql } from '@/lib/db'
import type { AdminProductSource } from '@/lib/api-helpers'

/**
 * Shared admin-product fetch: one joined query per product set (base row +
 * category + ordered images + variants with un-notified waitlist counts +
 * review statuses + curated relations), shaped for toAdminProduct.
 */

export type AdminProductRow = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  description: string
  details: string | null
  material: string | null
  care: string | null
  price: number
  compareAtPrice: number | null
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
  categorySlug: string | null
  categoryName: string | null
  images: Array<{ url: string; alt: string | null; color: string | null; position: number }> | null
  variants: Array<{ id: string; size: string; color: string; colorHex: string; sku: string; stock: number; waitingCount?: number }> | null
  reviews: Array<{ status: string }> | null
  curated: Array<{ position: number; slug: string }> | null
}

/** SELECT fragment (from "Product" p LEFT JOIN "Category" c) — append WHERE/ORDER BY. */
export function adminProductSelect() {
  return sql<AdminProductRow[]>`
    SELECT p.*, c.slug AS "categorySlug", c.name AS "categoryName",
      (SELECT json_agg(row_to_json(src))
        FROM (SELECT pi.url, pi.alt, pi.color, pi.position FROM "ProductImage" pi
              WHERE pi."productId" = p.id ORDER BY pi.position ASC) src
      ) AS images,
      (SELECT json_agg(row_to_json(src))
        FROM (SELECT v.id, v.size, v.color, v."colorHex", v.sku, v.stock,
                (SELECT COUNT(*)::int FROM "StockAlert" sa
                  WHERE sa."variantId" = v.id AND sa."notifiedAt" IS NULL) AS "waitingCount"
              FROM "ProductVariant" v WHERE v."productId" = p.id) src
      ) AS variants,
      (SELECT json_agg(row_to_json(src))
        FROM (SELECT r.status FROM "Review" r WHERE r."productId" = p.id) src
      ) AS reviews,
      (SELECT json_agg(row_to_json(src))
        FROM (SELECT pr.position, pr2.slug FROM "ProductRelation" pr
              JOIN "Product" pr2 ON pr2.id = pr."relatedId"
              WHERE pr."productId" = p.id ORDER BY pr.position ASC) src
      ) AS curated
    FROM "Product" p
    LEFT JOIN "Category" c ON c.id = p."categoryId"
  `
}

/** Map a joined row into the shape toAdminProduct consumes. */
export function rowToAdminSource(row: AdminProductRow): AdminProductSource {
  return {
    ...row,
    category: row.categorySlug && row.categoryName ? { slug: row.categorySlug, name: row.categoryName } : null,
    images: row.images ?? [],
    variants: (row.variants ?? []).map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      sku: v.sku,
      stock: v.stock,
      _count: { stockAlerts: v.waitingCount ?? 0 },
    })),
    reviews: row.reviews ?? [],
    curatedRelations: (row.curated ?? []).map((c) => ({ position: c.position, related: { slug: c.slug } })),
  }
}

/** Full admin product shape by id (null when missing). */
export async function getAdminProductById(id: string): Promise<AdminProductSource | null> {
  const rows = await sql<AdminProductRow[]>`
    ${adminProductSelect()}
    WHERE p.id = ${id}
    LIMIT 1
  `
  return rows[0] ? rowToAdminSource(rows[0]) : null
}
