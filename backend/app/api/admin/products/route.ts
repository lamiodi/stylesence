import { sql, cuid, sqlJoin } from '@/lib/db'
import { fail, ok, readValidated, slugify, toAdminProduct, bumpStorefrontCache, type AdminProductSource } from '@/lib/api-helpers'
import { adminProductSelect, rowToAdminSource, type AdminProductRow } from '@/lib/admin-products'
import { requireAdmin } from '@/lib/auth'
import { generateSku } from '@/lib/sku'
import { productInput } from '@/lib/validators'
import { galleryColorError } from '@/lib/gallery-colors'

/** GET /api/admin/products — ALL products (incl. inactive), newest first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const rows = await sql<AdminProductRow[]>`
    ${adminProductSelect()}
    ORDER BY p."createdAt" DESC
  `
  return ok({ products: rows.map(rowToAdminSource).map(toAdminProduct) })
}

/** POST /api/admin/products — create with images + variants; auto slug + SKUs. */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, productInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data
  const galleryError = galleryColorError(input.images ?? [], input.variants ?? [])
  if (galleryError) return fail(400, galleryError)

  // Category (optional) must exist when provided.
  let categoryId: string | null = null
  let category: { slug: string; name: string } | null = null
  if (input.categoryId) {
    const rows = await sql<{ id: string; slug: string; name: string }[]>`
      SELECT id, slug, name FROM "Category" WHERE id = ${input.categoryId} LIMIT 1
    `
    if (!rows[0]) return fail(400, 'Category not found')
    categoryId = rows[0].id
    category = { slug: rows[0].slug, name: rows[0].name }
  }

  const slugTaken = async (candidate: string) => {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM "Product" WHERE slug = ${candidate} LIMIT 1
    `
    return Boolean(rows[0])
  }

  // Slug: explicit (must be free) or generated from the name (suffixed when taken).
  let slug = input.slug ?? slugify(input.name)
  if (!slug) return fail(400, 'Could not derive a slug from the name — please provide one')
  if (await slugTaken(slug)) {
    if (input.slug) return fail(400, `Slug "${slug}" is already in use`)
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`
      if (!(await slugTaken(candidate))) {
        slug = candidate
        break
      }
    }
    if (await slugTaken(slug)) {
      return fail(409, 'Could not generate a unique slug — please provide one')
    }
  }

  // Unique SKUs for the new variants (ids + skus generated once, shared by
  // the INSERT and the response shape).
  const skuRows = await sql<{ sku: string }[]>`SELECT sku FROM "ProductVariant"`
  const takenSkus = new Set(skuRows.map((v) => v.sku))
  const productId = cuid()
  const images = (input.images ?? []).map((img, position) => ({
    url: img.url,
    alt: img.alt ?? null,
    color: img.color ?? null,
    position,
  }))
  const variants = (input.variants ?? []).map((v) => ({
    id: cuid(),
    size: v.size,
    color: v.color,
    colorHex: v.colorHex ?? '#EDE7DC',
    stock: v.stock,
    sku: generateSku(v.color, v.size, takenSkus),
  }))

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO "Product" (id, slug, name, subtitle, description, details, material, care,
        price, "compareAtPrice", "categoryId", "isActive", "isFeatured", "createdAt", "updatedAt")
      VALUES (${productId}, ${slug}, ${input.name}, ${input.subtitle ?? null}, ${input.description},
        ${input.details ?? null}, ${input.material ?? null}, ${input.care ?? null}, ${input.price},
        ${input.compareAtPrice ?? null}, ${categoryId}, ${input.isActive ?? true}, ${input.isFeatured ?? false},
        now(), now())
    `
    if (images.length > 0) {
      const imageRows = images.map(
        (img) => sql`(${cuid()}, ${productId}, ${img.url}, ${img.alt}, ${img.position}, ${img.color})`,
      )
      await tx`INSERT INTO "ProductImage" (id, "productId", url, alt, position, color) VALUES ${sqlJoin(imageRows, ', ')}`
    }
    if (variants.length > 0) {
      const variantRows = variants.map(
        (v) => sql`(${v.id}, ${productId}, ${v.size}, ${v.color}, ${v.colorHex}, ${v.sku}, ${v.stock})`,
      )
      await tx`INSERT INTO "ProductVariant" (id, "productId", size, color, "colorHex", sku, stock) VALUES ${sqlJoin(variantRows, ', ')}`
    }
  })

  // The just-written shape is fully known — no re-fetch needed.
  const created: AdminProductSource = {
    id: productId,
    slug,
    name: input.name,
    subtitle: input.subtitle ?? null,
    description: input.description,
    details: input.details ?? null,
    material: input.material ?? null,
    care: input.care ?? null,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    categoryId,
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
    category,
    images,
    variants: variants.map((v) => ({ ...v, _count: { stockAlerts: 0 } })),
    reviews: [],
    curatedRelations: [],
  }

  bumpStorefrontCache()

  return ok({ product: toAdminProduct(created) }, { status: 201 })
}
