import { db } from '@/lib/db'
import { fail, ok, readValidated, slugify, toAdminProduct } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { productInput } from '@/lib/validators'

/** Include shape used for admin product responses (module-private). */
const PRODUCT_INCLUDE = {
  category: { select: { slug: true, name: true } },
  images: { orderBy: { position: 'asc' as const } },
  variants: true,
  reviews: { select: { status: true } },
  curatedRelations: {
    orderBy: { position: 'asc' as const },
    select: { position: true, related: { select: { slug: true } } },
  },
} as const

/** GET /api/admin/products — ALL products (incl. inactive), newest first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: PRODUCT_INCLUDE,
  })
  return ok({ products: products.map(toAdminProduct) })
}

/** Unique SKU in the shape `SS-XXXX-color-size` (random suffix; retries on collision). */
function generateSku(color: string, size: string, taken: Set<string>): string {
  const colorPart = slugify(color) || 'color'
  const sizePart = slugify(size) || 'size'
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    const candidate = `SS-${rand}-${colorPart}-${sizePart}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
  const fallback = `SS-${Date.now().toString(36).toUpperCase()}-${colorPart}-${sizePart}`
  taken.add(fallback)
  return fallback
}

/** POST /api/admin/products — create with images + variants; auto slug + SKUs. */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, productInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  // Category (optional) must exist when provided.
  let categoryId: string | null = null
  if (input.categoryId) {
    const category = await db.category.findUnique({ where: { id: input.categoryId } })
    if (!category) return fail(400, 'Category not found')
    categoryId = category.id
  }

  // Slug: explicit (must be free) or generated from the name (suffixed when taken).
  let slug = input.slug ?? slugify(input.name)
  if (!slug) return fail(400, 'Could not derive a slug from the name — please provide one')
  if (await db.product.findUnique({ where: { slug } })) {
    if (input.slug) return fail(400, `Slug "${slug}" is already in use`)
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`
      if (!(await db.product.findUnique({ where: { slug: candidate } }))) {
        slug = candidate
        break
      }
    }
    if (await db.product.findUnique({ where: { slug } })) {
      return fail(409, 'Could not generate a unique slug — please provide one')
    }
  }

  // Unique SKUs for the new variants.
  const takenSkus = new Set((await db.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku))

  const product = await db.product.create({
    data: {
      name: input.name,
      slug,
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
      images: {
        create: (input.images ?? []).map((img, position) => ({
          url: img.url,
          alt: img.alt ?? null,
          position,
        })),
      },
      variants: {
        create: (input.variants ?? []).map((v) => ({
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? '#EDE7DC',
          stock: v.stock,
          sku: generateSku(v.color, v.size, takenSkus),
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  })

  return ok({ product: toAdminProduct(product) }, { status: 201 })
}
