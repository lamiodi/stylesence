import { sql, cuid } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { reviewInput } from '@/lib/validators'
import { checkIpRateLimit, clientKey } from '@/lib/rate-limit'

/**
 * POST /api/products/[slug]/reviews
 * Creates a PENDING review → 201 `{ review, status: "PENDING" }`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!checkIpRateLimit(`review:${clientKey(req)}`, 5, 10 * 60 * 1000)) {
    return fail(429, 'Too many reviews from this network — please try again later.')
  }

  const { slug } = await params

  const parsed = await readValidated(req, reviewInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const products = await sql<{ id: string; isActive: boolean }[]>`
    SELECT id, "isActive" FROM "Product" WHERE slug = ${slug} LIMIT 1
  `
  const product = products[0]
  if (!product || !product.isActive) return fail(404, 'Product not found')

  const reviews = await sql<{ id: string; author: string; rating: number; title: string | null; body: string; createdAt: Date }[]>`
    INSERT INTO "Review" (id, "productId", author, email, rating, title, body, status, "createdAt")
    VALUES (${cuid()}, ${product.id}, ${input.author}, ${input.email ?? null}, ${input.rating},
            ${input.title ?? null}, ${input.body}, 'PENDING', now())
    RETURNING id, author, rating, title, body, "createdAt"
  `
  const review = reviews[0]

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
