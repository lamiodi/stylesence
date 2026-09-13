'use client'

import { useMemo } from 'react'
import { History } from 'lucide-react'
import { Link } from '@/lib/router'
import { formatNaira } from '@/lib/money'
import { useMounted } from '@/hooks/use-mounted'
import { useRecentlyViewed } from '@/lib/store/recently-viewed'
import { ProductImage } from './price'
import { Reveal } from './reveal'

/**
 * "Recently viewed" rail — persisted client history of the last 8 pieces,
 * rendered as a horizontal editorial strip. Hidden until the client
 * hydrates (avoids SSR/localStorage mismatch) and when empty.
 */
export function RecentlyViewedStrip({
  excludeSlug,
  className,
}: {
  /** current product slug to omit (used on the PDP) */
  excludeSlug?: string
  className?: string
}) {
  const mounted = useMounted()
  const items = useRecentlyViewed((s) => s.items)

  const visible = useMemo(
    () => items.filter((i) => i.slug !== excludeSlug).slice(0, 8),
    [items, excludeSlug],
  )

  if (!mounted || visible.length === 0) return null

  return (
    <section className={className} aria-label="Recently viewed pieces">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <History className="h-3 w-3" strokeWidth={1.5} aria-hidden />
              Recently viewed
            </p>
            <h2 className="mt-2 font-display text-2xl font-light tracking-tight sm:text-3xl">
              Where you have been
            </h2>
          </div>
          <p className="hidden font-mono text-[0.68rem] text-muted-foreground/70 tabular-nums sm:block">
            {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <ul className="no-scrollbar -mx-4 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-4 md:gap-6 lg:grid-cols-6 xl:grid-cols-8">
          {visible.map((item) => (
            <li key={item.slug} className="w-[9.5rem] shrink-0 snap-start md:w-auto">
              <Link
                to={`/product/${item.slug}`}
                className="group block focus-visible:outline-2 focus-visible:outline-ring"
                ariaLabel={`View ${item.name} again`}
              >
                <div className="relative overflow-hidden">
                  <ProductImage
                    src={item.primaryImage}
                    alt={item.name}
                    label={item.name}
                    ratio="aspect-[3/4]"
                    className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </div>
                <p className="mt-2.5 truncate font-display text-[0.9rem] leading-tight tracking-tight">
                  {item.name}
                </p>
                <p className="mt-1 font-mono text-[0.75rem] text-muted-foreground tabular-nums">
                  {formatNaira(item.price)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
