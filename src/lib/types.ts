/** Shared API response types — mirrors the backend contract in worklog.md */

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
  shippingMethod: string
  shipping: number
  subtotal: number
  discount: number
  promoCode: string | null
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
}

export const ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const SHIPPING_METHODS = {
  standard: { label: 'Standard Delivery', price: 3500, eta: '3–5 business days', note: ' Nationwide courier with tracking.' },
  express: { label: 'Express Delivery', price: 7500, eta: '1–2 business days', note: ' Lagos same-day dispatch before 11am.' },
} as const
export type ShippingMethod = keyof typeof SHIPPING_METHODS
