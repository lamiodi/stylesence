import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * Sitemap — static routes plus every live product and journal post, fetched
 * from the backend at request time. Static entries are always emitted; a
 * backend hiccup degrades to the static set rather than an empty sitemap.
 */
const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')

interface ProductRow {
  slug: string
}

interface JournalRow {
  slug: string
  publishedAt?: string | Date | null
}

/** All live product slugs — the endpoint caps perPage at 48, so paginate. */
async function allProductSlugs(): Promise<string[]> {
  const slugs: string[] = []
  let total = Infinity
  for (let page = 1; page <= 5 && slugs.length < total; page++) {
    try {
      const res = await fetch(`${BACKEND}/api/products?perPage=48&page=${page}`, {
        next: { revalidate: 3600 },
      })
      if (!res.ok) break
      const body = (await res.json()) as { products?: ProductRow[]; total?: number }
      slugs.push(...(body.products ?? []).map((p) => p.slug))
      total = typeof body.total === 'number' ? body.total : slugs.length
    } catch {
      break
    }
  }
  return slugs
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/journal`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/help`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const [slugs, posts] = await Promise.all([
    allProductSlugs(),
    fetch(`${BACKEND}/api/journal`, { next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ])

  for (const slug of slugs) {
    entries.push({
      url: `${SITE_URL}/product/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }
  for (const j of ((posts as { posts?: JournalRow[] } | null)?.posts ?? []) as JournalRow[]) {
    entries.push({
      url: `${SITE_URL}/journal/${encodeURIComponent(j.slug)}`,
      lastModified: j.publishedAt ? new Date(j.publishedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  return entries
}
