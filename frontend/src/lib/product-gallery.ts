/** Colour-specific items first, then deliberately shared items. Legacy galleries remain usable. */
export function imagesForColor<T extends { color?: string | null }>(images: T[], color: string | null): T[] {
  if (!color || !images.some(image => image.color)) return images
  return [
    ...images.filter(image => image.color === color),
    ...images.filter(image => !image.color),
  ]
}
