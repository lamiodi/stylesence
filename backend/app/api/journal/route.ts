import { sql } from '@/lib/db'
import { cachedJson, okCached } from '@/lib/api-helpers'

/** GET /api/journal — published posts, newest first. */
export async function GET() {
  const body = await cachedJson('journal:', 60_000, async () => {
    const posts = await sql<
      {
        slug: string
        title: string
        excerpt: string
        category: string
        coverImage: string | null
        publishedAt: Date
        readTime: number
      }[]
    >`
      SELECT slug, title, excerpt, category, "coverImage", "publishedAt", "readTime"
      FROM "JournalPost"
      WHERE "isPublished" = true
      ORDER BY "publishedAt" DESC
    `
    return {
      posts: posts.map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        category: p.category,
        coverImage: p.coverImage,
        publishedAt: p.publishedAt,
        readTime: p.readTime,
      })),
    }
  })
  return okCached(body)
}
