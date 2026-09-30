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

/** Append a transformation fragment right after `/upload/` (merging with any existing chain). */
export function cldTransform(url: string, transform: string): string {
  if (!isCloudinaryUpload(url)) return url;
  return url.replace("/upload/", `/upload/${transform},`);
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
