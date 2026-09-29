/**
 * Shared social-metadata builders.
 *
 * Next.js shallow-merges route metadata: a page-level `openGraph` or
 * `twitter` object replaces the root layout's whole block (see the
 * generate-metadata guide in node_modules/next/dist/docs). So every page
 * that sets openGraph must restate the brand fields — siteName, type,
 * locale and above all the image — or shares go out bare. These builders
 * make that impossible to get wrong: one call returns the complete object.
 */
import type { Metadata } from 'next'

/** Brand social preview — the polka-dot duo, face-aware 1200×630 crop. */
export const OG_IMAGE =
  'https://res.cloudinary.com/qaruxkhf/image/upload/c_fill,g_auto:face,w_1200,h_630,q_auto,f_jpg/v1790053123/stylesence/products/IMG_2416_mfhure.jpg'

export const OG_IMAGE_ALT = 'Two models in Style Sence polka-dot silk sets'

const BRAND_SUFFIX = 'Style Sence by SKR'

/**
 * Re-crop any Cloudinary asset to the 1200×630 social-preview standard,
 * replacing whatever transformation chain the URL already carries.
 * g_auto:face keeps the model's face inside the wide crop; video assets
 * contribute their first-second poster frame. Non-Cloudinary or missing
 * URLs fall back to the house preview.
 */
export function ogImageUrl(url?: string | null): string {
  if (!url) return OG_IMAGE
  const marker = '/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return OG_IMAGE
  const prefix = url.slice(0, idx + marker.length)
  // Asset path starts at the "v<digits>" version segment — which may sit
  // behind an existing transformation chain, so scan for it, not anchor.
  const segments = url.slice(idx + marker.length).split('/')
  const versionAt = segments.findIndex((s) => /^v\d+$/.test(s))
  const rest = segments.slice(versionAt === -1 ? 0 : versionAt).join('/')
  const chain = url.includes('/video/upload/')
    ? 'so_1,c_fill,w_1200,h_630,q_auto,f_jpg'
    : 'c_fill,g_auto:face,w_1200,h_630,q_auto,f_jpg'
  return `${prefix}${chain}/${rest}`
}

type PageMetaInput = {
  title: string
  description: string
  /** Canonical path beginning with "/" — resolved against metadataBase. */
  path: string
  /** Optional page-specific preview image (e.g. the product photo). */
  image?: string | null
  imageAlt?: string
  noindex?: boolean
}

/**
 * Complete per-page Metadata: title + canonical + full openGraph and
 * twitter objects. The og/twitter titles carry the brand suffix so social
 * cards match the templated <title>.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  noindex,
}: PageMetaInput): Metadata {
  const socialTitle = `${title} — ${BRAND_SUFFIX}`
  const preview = ogImageUrl(image)
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: BRAND_SUFFIX,
      type: 'website',
      locale: 'en_US',
      images: [{ url: preview, width: 1200, height: 630, alt: imageAlt ?? OG_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [preview],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  }
}
