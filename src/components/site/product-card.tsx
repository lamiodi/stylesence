'use client'

import { memo } from 'react'
import { Heart, ArrowUpRight } from 'lucide-react'
import { Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { ProductImage } from './price'
import { useWishlist } from '@/lib/store/wishlist'
import { useMounted } from '@/hooks/use-mounted'
import type { ProductCard as ProductCardType } from '@/lib/types'

export const ProductCard = memo(function ProductCard({
  product,
  eager = false,
  index = 0,
}: {
  product: ProductCardType
  eager?: boolean
  index?: number
}) {
  const toggle = useWishlist((s) => s.toggle)
  const has = useWishlist((s) => s.has)
  const mounted = useMounted()

  const wished = mounted && has(product.slug)
  const onSale = product.compareAtPrice && product.compareAtPrice > product.price

  return (
    <article className="group relative">
      <Link
        to={`/product/${product.slug}`}
        className="block focus-visible:outline-2 focus-visible:outline-ring"
        ariaLabel={`View ${product.name}`}
      >
        <div className="relative overflow-hidden">
          <ProductImage
            src={product.primaryImage}
            alt={product.name}
            label={product.name}
            eager={eager && index < 4}
            ratio="aspect-[3/4]"
            className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
          />

          {/* editorial tags */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
            {product.isNew ? (
              <span className="eyebrow-ink bg-background/90 px-2.5 py-1 !text-[0.55rem] backdrop-blur-sm">
                New
              </span>
            ) : null}
            {onSale ? (
              <span className="eyebrow bg-espresso px-2.5 py-1 !text-[0.55rem] text-background">
                Archive Price
              </span>
            ) : null}
          </div>

          {/* hover cue */}
          <div className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 translate-y-2 items-center justify-center bg-background/90 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </div>
        </div>

        <div className="pt-3.5">
          <h3 className="font-display text-[1.05rem] leading-snug tracking-tight text-foreground">
            {product.name}
          </h3>
          {product.subtitle ? (
            <p className="mt-0.5 text-[0.78rem] italic text-muted-foreground">{product.subtitle}</p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[0.85rem] font-medium tabular-nums">
              {formatNaira(product.price)}
              {onSale ? (
                <span className="ml-2 text-[0.75rem] text-muted-foreground/70 line-through">
                  {formatNaira(product.compareAtPrice!)}
                </span>
              ) : null}
            </p>
            {product.colors.length > 0 ? (
              <span className="flex items-center gap-1.5" aria-label={`Colours: ${product.colors.map((c) => c.name).join(', ')}`}>
                {product.colors.slice(0, 4).map((c) => (
                  <span
                    key={c.name}
                    className="h-3 w-3 rounded-full border border-line-strong"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                ))}
                {product.colors.length > 4 ? (
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    +{product.colors.length - 4}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {/* wishlist toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          const added = toggle({
            slug: product.slug,
            name: product.name,
            price: product.price,
            primaryImage: product.primaryImage,
            addedAt: Date.now(),
          })
          // feedback comes from the page-level toast
          import('sonner').then(({ toast }) =>
            added
              ? toast.success(`${product.name} — added to wishlist`)
              : toast(`${product.name} — removed from wishlist`),
          )
        }}
        aria-pressed={wished}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        className={cn(
          'absolute right-3 top-3 flex h-9 w-9 items-center justify-center backdrop-blur-sm transition-all duration-300',
          'focus-visible:outline-2 focus-visible:outline-ring',
          wished
            ? 'bg-background/95 text-espresso opacity-100'
            : 'bg-background/85 text-foreground/80 opacity-0 hover:text-espresso group-hover:opacity-100 focus-visible:opacity-100',
          '[@media(hover:none)]:opacity-100',
        )}
      >
        <Heart className={cn('h-4 w-4', wished && 'fill-espresso')} strokeWidth={1.5} />
      </button>
    </article>
  )
})

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="aspect-[3/4] bg-secondary" />
      <div className="pt-4">
        <div className="h-4 w-3/4 bg-secondary" />
        <div className="mt-2 h-3 w-1/2 bg-secondary" />
        <div className="mt-3 h-3 w-1/3 bg-secondary" />
      </div>
    </div>
  )
}
