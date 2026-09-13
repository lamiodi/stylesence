import { db } from '@/lib/db'
import { ok } from '@/lib/api-helpers'

/** GET /api/journal — published posts, newest first. */
export async function GET() {
  const posts = await db.journalPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
  })
  return ok({
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      coverImage: p.coverImage,
      publishedAt: p.publishedAt,
      readTime: p.readTime,
    })),
  })
}
