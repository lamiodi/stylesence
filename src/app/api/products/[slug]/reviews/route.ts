import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { reviewInput } from '@/lib/validators'

/**
 * POST /api/products/[slug]/reviews
 * Creates a PENDING review → 201 `{ review, status: "PENDING" }`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const parsed = await readValidated(req, reviewInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const product = await db.product.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  })
  if (!product || !product.isActive) return fail(404, 'Product not found')

  const review = await db.review.create({
    data: {
      productId: product.id,
      author: input.author,
      email: input.email ?? null,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      status: 'PENDING',
    },
  })

  return ok(
    {
      review: {
        id: review.id,
        author: review.author,
        rating: review.rating,
        title: review.title,
        body: review.body,
        createdAt: review.createdAt,
      },
      status: 'PENDING',
    },
    { status: 201 }
  )
}
