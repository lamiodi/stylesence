'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Heart, X } from 'lucide-react'
import { toast } from 'sonner'
import { navigate, Link } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/site/product-card'
import { Reveal } from '@/components/site/reveal'
import { useWishlist } from '@/lib/store/wishlist'
import { useCustomer } from '@/hooks/use-customer'
import { useMounted } from '@/hooks/use-mounted'
import { formatNaira } from '@/lib/money'
import type { ProductsResponse } from '@/lib/types'

export function WishlistPage() {
  const items = useWishlist((s) => s.items)
  const remove = useWishlist((s) => s.remove)
  const clear = useWishlist((s) => s.clear)
  const mounted = useMounted()
  const { data: customer } = useCustomer()
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
                : `${list.length} ${list.length === 1 ? 'piece' : 'pieces'} — ${
                    customer ? 'saved to your account and this device.' : 'kept on this device.'
                  }`}
            </p>
            {customer && list.length > 0 ? (
              <p className="mt-1.5 font-mono text-[0.66rem] tracking-[0.08em] text-muted-foreground/70">
                {customer.name.split(' ')[0]} · synced
              </p>
            ) : null}
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
        <>
          <Reveal className="mt-10">
            <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-16 text-center sm:py-20">
              <Heart className="h-8 w-8 text-muted-foreground/40" strokeWidth={1} aria-hidden />
              <p className="mt-5 font-display text-3xl font-light italic">Nothing saved — yet.</p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {customer
                  ? 'Tap the heart on any piece — saved pieces follow your account across devices.'
                  : 'Tap the heart on any piece and it will wait for you here, on this device.'}
              </p>
              <Button
                className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
                onClick={() => navigate('/shop')}
              >
                Discover the collection
              </Button>
            </div>
          </Reveal>
          <BestsellerRescue />
        </>
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
                  secondaryImage: item.secondaryImage ?? null,
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

/**
 * Editorial rescue strip on the empty wishlist — the four most-considered
 * pieces (same query + key the home bestsellers row and the empty-bag rescue
 * use, so the cache is shared). Hearts on these cards move pieces straight
 * into the wishlist, live. Silent on error: an empty wishlist should never
 * fail loudly because a suggestion fetch stumbled.
 */
function BestsellerRescue() {
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'bestsellers'],
    queryFn: async () => {
      const res = await fetch('/api/products?sort=rating&perPage=4')
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as ProductsResponse
    },
    staleTime: 5 * 60_000,
  })

  const products = data?.products ?? []
  if (isLoading || products.length === 0) return null

  return (
    <section className="mt-16 border-t border-line pt-10" aria-label="Most considered pieces">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Most considered</p>
            <h2 className="mt-2 font-display text-2xl font-light tracking-tight sm:text-3xl">
              Where others began
            </h2>
          </div>
          <Link
            to="/shop"
            className="eyebrow-ink hidden shrink-0 items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso sm:inline-flex"
          >
            All pieces
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          The pieces the house keeps reaching for — one tap on a heart moves them
          straight into this page.
        </p>
      </Reveal>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
        {products.map((p, i) => (
          <Reveal key={p.slug} delay={i * 0.06}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}
