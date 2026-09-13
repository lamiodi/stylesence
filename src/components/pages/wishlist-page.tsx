'use client'

import { useEffect } from 'react'
import { Heart, X } from 'lucide-react'
import { toast } from 'sonner'
import { navigate, Link } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/site/product-card'
import { Reveal } from '@/components/site/reveal'
import { useWishlist } from '@/lib/store/wishlist'
import { useMounted } from '@/hooks/use-mounted'
import { formatNaira } from '@/lib/money'

export function WishlistPage() {
  const items = useWishlist((s) => s.items)
  const remove = useWishlist((s) => s.remove)
  const clear = useWishlist((s) => s.clear)
  const mounted = useMounted()
  useEffect(() => {
    document.title = 'Wishlist — Style Sence'
  }, [])

  const list = mounted ? items : []

  return (
    <div className="container-site py-10 sm:py-14">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Saved for consideration</p>
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">The wishlist</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {list.length === 0
                ? 'Pieces you love will gather here.'
                : `${list.length} ${list.length === 1 ? 'piece' : 'pieces'} — kept on this device.`}
            </p>
          </div>
          {list.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clear()
                toast('Wishlist cleared')
              }}
              className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/70 underline decoration-line-strong underline-offset-4 transition-colors hover:text-destructive"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </Reveal>

      {list.length === 0 ? (
        <Reveal className="mt-10">
          <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-24 text-center">
            <Heart className="h-8 w-8 text-muted-foreground/40" strokeWidth={1} aria-hidden />
            <p className="mt-5 font-display text-3xl font-light italic">Nothing saved — yet.</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Tap the heart on any piece and it will wait for you here, on this device.
            </p>
            <Button
              className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
              onClick={() => navigate('/shop')}
            >
              Discover the collection
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
          {list.map((item, i) => (
            <div key={item.slug} className="relative">
              <ProductCard
                product={{
                  id: item.slug,
                  slug: item.slug,
                  name: item.name,
                  subtitle: null,
                  price: item.price,
                  compareAtPrice: null,
                  primaryImage: item.primaryImage,
                  secondaryImage: null,
                  colors: [],
                  sizes: [],
                  rating: null,
                  reviewCount: 0,
                  isNew: false,
                }}
                index={i}
              />
              <button
                type="button"
                onClick={() => {
                  remove(item.slug)
                  toast(`${item.name} — removed`, { description: formatNaira(item.price) })
                }}
                className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center bg-background/90 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive"
                aria-label={`Remove ${item.name} from wishlist`}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
