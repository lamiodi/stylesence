/**
 * Catch-all route — every storefront address renders the SPA shell, with
 * real per-path server metadata (titles + canonical + OG) so crawlers and
 * link previews see the actual page, not just the homepage. Unknown
 * first-level paths return a real 404.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SpaShell } from '@/components/site/spa-shell'

/** Route segments the SPA knows; anything else is a 404. */
const SEGMENTS = new Set([
  'shop', 'product', 'cart', 'checkout', 'order', 'wishlist',
  'journal', 'about', 'help', 'track', 'account', 'admin',
])

/** Private/transactional pages stay out of the index even though crawlable. */
const NOINDEX = new Set(['admin', 'account', 'order', 'checkout', 'cart', 'track'])

const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '')

async function productName(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND}/api/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { product?: { name?: string } }
    return body.product?.name ?? null
  } catch {
    return null
  }
}

function meta(
  title: string,
  description: string,
  path: string,
  noindex: boolean,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { url: path },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
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
    case undefined:
      return {
        description:
          'Made-to-order luxury womenswear from Lagos — polka-dot silk coordinates, fluid gowns and hand-woven Aso Oke, cut to your measurements.',
        alternates: { canonical: '/' },
        openGraph: { url: '/' },
      }
    case 'shop':
      return meta('Shop the Collection', 'Ready-to-wear and made-to-order pieces — silk coordinates, gowns and hand-woven Aso Oke, cut to your measurements.', path, noindex)
    case 'product': {
      if (!s1) return meta('Piece', 'Made-to-order luxury womenswear by Style Sence.', path, true)
      const name = await productName(s1)
      return meta(
        name ?? 'Piece',
        name
          ? `${name} — made to order in Lagos, cut to your measurements and delivered nationwide.`
          : 'Made-to-order luxury womenswear by Style Sence.',
        path,
        noindex,
      )
    }
    case 'wishlist':
      return meta('Wishlist', 'Pieces saved for later.', path, true)
    case 'journal':
      return meta(s1 ? 'Journal' : 'The Journal', 'Atelier notes, styling stories and craft from the Style Sence studio.', path, noindex)
    case 'about':
      return meta('About Style Sence', 'The house, the atelier and the hands behind every made-to-order piece.', path, noindex)
    case 'help':
      return meta('Client Care', 'Shipping, sizing, care and every answer in between.', path, noindex)
    case 'track':
      return meta('Track Your Order', 'Follow your order from the atelier to your door.', path, true)
    case 'account':
      return meta('Your Account', 'Sign in or create your Style Sence account.', path, true)
    default:
      return meta('Style Sence', 'Made-to-order luxury womenswear from Lagos.', path, true)
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
