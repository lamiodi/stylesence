/**
 * Cloudinary URL helpers — responsive product imagery without next/image.
 *
 * Stored product URLs are bare `/upload/v…/path` assets. These helpers append
 * delivery transformations (f_auto + q_auto, width variants for srcSet) while
 * leaving non-Cloudinary sources untouched.
 */

const CLD_HOST = ".cloudinary.com";

function isCloudinaryUpload(url: string): boolean {
  return url.includes(CLD_HOST) && url.includes("/upload/");
}

/**
 * Append a transformation to a Cloudinary URL. Two shapes exist:
 *  - plain `/upload/v<id>/…` — insert the transform as a new path component
 *    (`/upload/f_auto,q_auto/v<id>/…`); a comma instead of the slash merges the
 *    transform into the version segment and Cloudinary 404s.
 *  - already-transformed `/upload/<chain>/v<id>/…` — append to the chain with a
 *    comma (`/upload/<chain>,f_auto,q_auto/v<id>/…`).
 */
export function cldTransform(url: string, transform: string): string {
  if (!isCloudinaryUpload(url)) return url
  if (/\/upload\/v\d+\//.test(url)) return url.replace('/upload/', `/upload/${transform}/`)
  return url.replace('/upload/', `/upload/${transform},`)
}

/** Auto-format + auto-quality variant of a URL (WebP/AVIF where supported). */
export function cldOptimize(url: string): string {
  return cldTransform(url, "f_auto,q_auto");
}

export const CLD_WIDTHS = [240, 400, 640, 960, 1280] as const;

/**
 * srcSet of width variants for a Cloudinary image; null when the URL is not
 * Cloudinary (callers then skip srcSet and keep the plain src).
 */
export function cldSrcSet(url: string, widths: readonly number[] = CLD_WIDTHS): string | null {
  if (!isCloudinaryUpload(url)) return null;
  return widths
    .map((w) => `${cldTransform(url, `f_auto,q_auto,w_${w}`)} ${w}w`)
    .join(", ");
}
