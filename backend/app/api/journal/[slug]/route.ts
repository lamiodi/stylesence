import { sql } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'

/** GET /api/journal/[slug] — single published post incl. body; 404 otherwise. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const rows = await sql<
    {
      slug: string
      title: string
      excerpt: string
      category: string
      coverImage: string | null
      publishedAt: Date
      readTime: number
      body: string
    }[]
  >`
    SELECT slug, title, excerpt, category, "coverImage", "publishedAt", "readTime", body
    FROM "JournalPost"
    WHERE slug = ${slug} AND "isPublished" = true
    LIMIT 1
  `
  const post = rows[0]
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
