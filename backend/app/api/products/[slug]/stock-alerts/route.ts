import { sql, cuid } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { stockAlertInput } from '@/lib/validators'
import { checkIpRateLimit, clientKey } from '@/lib/rate-limit'

/**
 * POST /api/products/[slug]/stock-alerts — back-in-stock waitlist signup.
 * No auth (the email is the identity); the `@@unique([variantId, email])`
 * constraint dedupes repeat submissions. Guests welcome.
 * 200 `{ ok: true, alreadyWaiting: false }` on signup,
 * 200 `{ ok: true, alreadyWaiting: true }` when already on the list.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!checkIpRateLimit(`stock-alert:${clientKey(req)}`, 5, 5 * 60 * 1000)) {
    return fail(429, 'Too many alerts from this network — please try again in a few minutes.')
  }

  const { slug } = await params

  const parsed = await readValidated(req, stockAlertInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const products = await sql<{ id: string; isActive: boolean }[]>`
    SELECT id, "isActive" FROM "Product" WHERE slug = ${slug} LIMIT 1
  `
  const product = products[0]
  if (!product || !product.isActive) return fail(404, 'This piece has been retired.')

  const variants = await sql<{ productId: string; stock: number }[]>`
    SELECT "productId", stock FROM "ProductVariant" WHERE id = ${input.variantId} LIMIT 1
  `
  const variant = variants[0]
  if (!variant || variant.productId !== product.id) {
    return fail(404, 'This size is not available on this piece.')
  }
  if (variant.stock !== 0) {
    return fail(400, 'This size is back in stock — add it to your bag.')
  }

  try {
    await sql`
      INSERT INTO "StockAlert" (id, email, "variantId", "notifiedAt", "createdAt")
      VALUES (${cuid()}, ${input.email}, ${input.variantId}, NULL, now())
    `
  } catch (e) {
    // Already waiting on this exact (variant, email) pair — same happy outcome.
    if ((e as { code?: string }).code === '23505') {
      return ok({ ok: true, alreadyWaiting: true })
    }
    throw e
  }

  return ok({ ok: true, alreadyWaiting: false })
}
