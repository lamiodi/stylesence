/** Shared API response types — mirrors the backend contract in worklog.md */

export const PROMO_STACK_MAX = 2

export interface Category {
  id: string
  slug: string
  name: string
  tagline: string | null
  imageUrl: string | null
  productCount: number
}

export interface ColorRef {
  name: string
  hex: string
}

export interface ProductCard {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  compareAtPrice: number | null
  primaryImage: string | null
  secondaryImage: string | null
  colors: ColorRef[]
  sizes: string[]
  rating: number | null
  reviewCount: number
  isNew: boolean
}

export interface ProductFacets {
  colors: (ColorRef & { count: number })[]
  sizes: { size: string; count: number }[]
  priceRange: { min: number; max: number } | null
}

export interface ProductsResponse {
  products: ProductCard[]
  total: number
  page: number
  perPage: number
  facets: ProductFacets
}

export interface ProductVariant {
  id: string
  size: string
  color: string
  colorHex: string
  stock: number
  sku: string
}

export interface ProductReview {
  id: string
  author: string
  rating: number
  title: string | null
  body: string
  createdAt: string
}

export interface RelatedProduct {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  secondaryImage: string | null
  /** First in-stock variant (canonical size/colour order) — powers "Add the look to bag". Null when sold out. */
  defaultVariantId: string | null
  /** True when at least one variant is in stock. */
  inStock: boolean
}

/** How the PDP "related" set was assembled. */
export type RelatedSource = 'curated' | 'mixed' | 'category' | 'any'

export interface ProductDetail {
  id: string
  slug: string
  name: string
  subtitle: string | null
  description: string
  price: number
  compareAtPrice: number | null
  material: string | null
  care: string | null
  details: string[]
  category: { slug: string; name: string } | null
  images: { url: string; alt: string | null }[]
  variants: ProductVariant[]
  rating: number | null
  reviewCount: number
  reviews: ProductReview[]
  related: RelatedProduct[]
  relatedSource: RelatedSource
}

export interface CartItem {
  id: string
  qty: number
  variant: { id: string; size: string; color: string; colorHex: string; stock: number }
  product: { slug: string; name: string; price: number; primaryImage: string | null }
  /** Round 13 made-to-order: how the size was chosen. */
  sizeMode: 'standard' | 'custom'
  /** Client measurements in cm — present on custom lines. */
  customMeasurements: CustomMeasurements | null
  /** Per-item tailoring instructions ("make it tighter around the waist"…). */
  notes: string | null
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  itemCount: number
}

export interface OrderItemView {
  productName: string
  productSlug: string
  size: string
  color: string
  imageUrl: string | null
  unitPrice: number
  qty: number
  /** Round 13 made-to-order snapshot. */
  sizeMode: 'standard' | 'custom'
  customMeasurements: CustomMeasurements | null
  notes: string | null
}

export interface OrderView {
  orderNumber: string
  status: string
  email: string
  fullName: string
  address: string
  city: string
  state: string
  country: string
  phone: string | null
  /** Delivery notes captured at checkout. */
  notes: string | null
  shippingMethod: string
  shipping: number
  subtotal: number
  discount: number
  promoCode: string | null
  /** All applied codes (stacking, Round 12) — null on legacy single-code orders. */
  promoCodes: string[] | null
  /** Round 13 production timeline — 'standard' (7–10 working days) | 'express' (2–3, fee applies). */
  productionTier: 'standard' | 'express'
  /** Express production add-on charged (0 on standard). */
  productionFee: number
  total: number
  createdAt: string
  items: OrderItemView[]
}

export interface JournalCard {
  slug: string
  title: string
  excerpt: string
  category: string
  coverImage: string | null
  publishedAt: string
  readTime: number
}

export interface JournalPostView extends JournalCard {
  body: string
}

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

export interface PromoInfo {
  code: string
  label: string | null
  type: string
  value: number
  minSubtotal: number
  discount: number
  freeShipping: boolean
  /** May combine with one other stackable code of a different type class. */
  stackable: boolean
}

/** POST /api/promo/validate response — the whole applied stack. */
export interface PromoStackInfo {
  promos: PromoInfo[]
  discount: number
  freeShipping: boolean
}

export const ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/* ——— Round 13: made-to-order measurements (cm) ——— */

/** The seven measurements the atelier accepts, with sane validation ranges. */
export const MEASUREMENT_FIELDS = [
  { key: 'bust', label: 'Bust', min: 60, max: 180 },
  { key: 'waist', label: 'Waist', min: 50, max: 160 },
  { key: 'hips', label: 'Hips', min: 60, max: 190 },
  { key: 'shoulder', label: 'Shoulder', min: 30, max: 60 },
  { key: 'sleeve', label: 'Sleeve length', min: 25, max: 75 },
  { key: 'length', label: 'Dress length', min: 40, max: 160 },
  { key: 'height', label: 'Height', min: 120, max: 210 },
] as const

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]['key']
export type CustomMeasurements = Partial<Record<MeasurementKey, number>>

/** "Bust 92 · Waist 74 · Height 168" for compact display. */
export function formatMeasurements(m: CustomMeasurements | null | undefined): string {
  if (!m) return ''
  return MEASUREMENT_FIELDS.map((f) => {
    const short = f.key === 'length' ? 'Length' : f.label.replace(' length', '')
    return `${short} ${m[f.key]}`
  })
    .filter((s) => !s.endsWith(' undefined'))
    .join(' · ')
}

/* ——— Round 13: production timeline ——— */

/** Made-to-order production tiers. Express fee is a clearly-labelled dev placeholder. */
export const PRODUCTION_TIERS = {
  standard: { label: 'Standard Production', eta: '7–10 working days', fee: 0 },
  express: { label: 'Express Production', eta: '2–3 working days', fee: 15_000 },
} as const
export type ProductionTier = keyof typeof PRODUCTION_TIERS

export const SHIPPING_METHODS = {
  local: { label: 'Local Delivery', price: 2500, eta: '1–2 business days', note: 'Lagos metro courier — same-day dispatch before 11am.' },
  nationwide: { label: 'Nationwide Delivery', price: 3500, eta: '3–5 business days', note: 'Nationwide courier with tracking.' },
  international: { label: 'International Delivery', price: 25000, eta: '7–14 business days', note: 'Door-to-door international courier, duties handled at the door.' },
} as const
export type ShippingMethod = keyof typeof SHIPPING_METHODS

/** Display label for a stored shippingMethod — current keys plus legacy
 *  pre-Round-13 orders ('standard'/'express'). */
export function shippingLabel(method: string): string {
  switch (method) {
    case 'local':
      return SHIPPING_METHODS.local.label
    case 'nationwide':
      return SHIPPING_METHODS.nationwide.label
    case 'international':
      return SHIPPING_METHODS.international.label
    case 'express':
      return 'Express Delivery'
    case 'standard':
      return 'Nationwide Delivery'
    default:
      return method
  }
}

/* ——— Customer accounts ——— */

/** Signed-in customer profile (safe fields — never a password hash). */
export interface CustomerView {
  id: string
  name: string
  email: string
  phone: string | null
  defaultAddress: string | null
  defaultCity: string | null
  defaultState: string | null
  createdAt: string
}

/** Order history row for the account page (same shape as GET /api/orders?email=). */
export interface CustomerOrderSummary {
  orderNumber: string
  status: string
  total: number
  itemCount: number
  createdAt: string
}

/** Server-hydrated wishlist item. */
export interface WishlistItemView {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  secondaryImage: string | null
}

/* ——— Editorial looks (home "Shop the look") ——— */

/** One shoppable piece inside a look (anchor is always pieces[0]). */
export interface LookPiece {
  slug: string
  name: string
  price: number
}

/** A home look: an anchor piece + its curated partners (or category fallback). */
export interface LookView {
  slug: string
  title: string
  subtitle: string | null
  categoryName: string | null
  image: string | null
  pieces: LookPiece[]
  /** 'curated' = built from admin ProductRelation curation; 'featured' = featured/category fallback. */
  source: 'curated' | 'featured'
}

