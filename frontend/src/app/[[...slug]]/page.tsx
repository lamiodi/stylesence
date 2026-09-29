/**
 * Catch-all route — every storefront address renders the SPA shell, with
 * real per-path server metadata (titles + canonical + OG) so crawlers and
 * link previews see the actual page, not just the homepage. Unknown
 * first-level paths return a real 404.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SpaShell } from '@/components/site/spa-shell'
import { pageMetadata } from '@/lib/seo'

/** Route segments the SPA knows; anything else is a 404. */
const SEGMENTS = new Set([
  'shop', 'product', 'cart', 'checkout', 'order', 'wishlist',
  'journal', 'about', 'help', 'track', 'account', 'admin',
])

/** Private/transactional pages stay out of the index even though crawlable. */
const NOINDEX = new Set(['admin', 'account', 'order', 'checkout', 'cart', 'track'])

const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')

/** Product facts for social previews — memoized with the PDP's own fetch. */
async function productSnapshot(slug: string): Promise<{ name?: string; image?: string | null } | null> {
  try {
    const res = await fetch(`${BACKEND}/api/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { product?: { name?: string; primaryImage?: string | null } }
    return { name: body.product?.name, image: body.product?.primaryImage ?? undefined }
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const { slug = [] } = await params
  const [s0, s1] = slug
  const path = slug.length ? `/${slug.map(encodeURIComponent).join('/')}` : '/'
  const noindex = s0 !== undefined && NOINDEX.has(s0)

  switch (s0) {
    // The homepage sets no openGraph of its own — it inherits the root
    // layout's complete brand block (image included) untouched.
    case undefined:
      return {
        description:
          'Made-to-order luxury womenswear from Lagos — polka-dot silk coordinates, fluid gowns and hand-woven Aso Oke, cut to your measurements.',
        alternates: { canonical: '/' },
      }
    case 'shop':
      return pageMetadata({ title: 'Shop the Collection', description: 'Ready-to-wear and made-to-order pieces — silk coordinates, gowns and hand-woven Aso Oke, cut to your measurements.', path, noindex })
    case 'product': {
      if (!s1) return pageMetadata({ title: 'Piece', description: 'Made-to-order luxury womenswear by Style Sence.', path, noindex: true })
      const product = await productSnapshot(s1)
      const name = product?.name
      return pageMetadata({
        title: name ?? 'Piece',
        description: name
          ? `${name} — made to order in Lagos, cut to your measurements and delivered worldwide.`
          : 'Made-to-order luxury womenswear by Style Sence.',
        path,
        noindex,
        image: product?.image,
        imageAlt: name ? `${name} by Style Sence` : undefined,
      })
    }
    case 'wishlist':
      return pageMetadata({ title: 'Wishlist', description: 'Pieces saved for later.', path, noindex: true })
    case 'journal':
      return pageMetadata({ title: s1 ? 'Journal' : 'The Journal', description: 'Atelier notes, styling stories and craft from the Style Sence studio.', path, noindex })
    case 'about':
      return pageMetadata({ title: 'About Style Sence', description: 'The house, the atelier and the hands behind every made-to-order piece.', path, noindex })
    case 'help':
      return pageMetadata({ title: 'Client Care', description: 'Shipping, sizing, care and every answer in between.', path, noindex })
    case 'track':
      return pageMetadata({ title: 'Track Your Order', description: 'Follow your order from the atelier to your door.', path, noindex: true })
    case 'account':
      return pageMetadata({ title: 'Your Account', description: 'Sign in or create your Style Sence account.', path, noindex: true })
    default:
      return pageMetadata({ title: 'Style Sence', description: 'Made-to-order luxury womenswear from Lagos.', path, noindex: true })
  }
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug = [] } = await params
  if (slug.length > 0 && !SEGMENTS.has(slug[0])) notFound()
  return <SpaShell />
}
