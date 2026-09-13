import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'

/** GET /api/journal/[slug] — single published post incl. body; 404 otherwise. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const post = await db.journalPost.findFirst({ where: { slug, isPublished: true } })
  if (!post) return fail(404, 'Post not found')

  return ok({
    post: {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      coverImage: post.coverImage,
      publishedAt: post.publishedAt,
      readTime: post.readTime,
      body: post.body,
    },
  })
}
