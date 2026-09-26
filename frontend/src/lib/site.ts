/**
 * Canonical production origin — the standard URL every SEO surface must agree on:
 * metadataBase, canonical, og:url, JSON-LD, sitemap and robots.txt.
 * Standard registered domain: https://stylesence.com (apex).
 * www.stylesence.com redirects here via DNS/Vercel configuration.
 *
 * The env override exists for preview/staging deployments; the fallback is the
 * real domain so a missing env var can never leak localhost into production tags.
 */
export const SITE_URL = (
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://stylesence.com"
).replace(/\/+$/, "");

