/**
 * Canonical production origin — the standard URL every SEO surface must agree on:
 * metadataBase, canonical, og:url, JSON-LD, sitemap and robots.txt.
 * Vercel serves https://www.stylesence.com as the primary domain and 308-redirects
 * the apex (stylesence.com) to it — so www is the canonical host, and the Vercel
 * SITE_URL env is (correctly) set to the www origin. Change both together or not
 * at: hosting redirect and these tags must never disagree.
 *
 * The env override exists for preview/staging deployments; the fallback is the
 * live www origin so a missing env var can never leak localhost — or a
 * redirecting host — into production tags.
 */
export const SITE_URL = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://www.stylesence.com"
).replace(/\/+$/, "");

/**
 * Hero LCP — the poster frame of the homepage film. Preloaded from
 * app/layout's <head> and shared with the SPA shell, which holds the
 * entrance overlay until this frame can actually paint (fail-open).
 */
export const HERO_POSTER_URL =
  "https://res.cloudinary.com/qaruxkhf/video/upload/so_1,q_auto,f_jpg/v1790053166/stylesence/products/IMG_7612_yc1iae.jpg";

