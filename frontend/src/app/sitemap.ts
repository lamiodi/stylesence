import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const now = new Date()
  // The storefront is a hash-routed SPA — the indexable URL set is the root
  // today; moving to real routes would expand this automatically.
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
  ]
}
