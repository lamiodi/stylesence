import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { stockAlertInput } from '@/lib/validators'

/**
 * POST /api/products/[slug]/stock-alerts — back-in-stock waitlist signup.
 * No auth (the email is the identity); the `@@unique([variantId, email])`
 * constraint dedupes repeat submissions. Guests welcome.
 * 200 `{ ok: true, alreadyWaiting: false }` on signup,
 * 200 `{ ok: true, alreadyWaiting: true }` when already on the list.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const parsed = await readValidated(req, stockAlertInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  })
  if (!product || !product.isActive) return fail(404, 'This piece has been retired.')

  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    select: { productId: true, stock: true },
  })
  if (!variant || variant.productId !== product.id) {
    return fail(404, 'This size is not available on this piece.')
  }
  if (variant.stock !== 0) {
    return fail(400, 'This size is back in stock — add it to your bag.')
  }

  try {
    await db.stockAlert.create({
      data: { email: input.email, variantId: input.variantId },
    })
  } catch (e) {
    // Already waiting on this exact (variant, email) pair — same happy outcome.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return ok({ ok: true, alreadyWaiting: true })
    }
    throw e
  }

  return ok({ ok: true, alreadyWaiting: false })
}
