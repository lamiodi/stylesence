'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { formatDate } from '@/lib/money'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import type { JournalCard } from '@/lib/types'

export function JournalPage() {
  useEffect(() => {
    document.title = 'Journal — Style Sence'
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['journal'],
    queryFn: async () => {
      const res = await fetch('/api/journal')
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as { posts: JournalCard[] }
    },
  })

  const posts = data?.posts ?? []
  const [featured, ...rest] = posts

  return (
    <div className="container-site py-10 sm:py-14">
      <Reveal>
        <p className="eyebrow">Notes & essays</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">The Journal</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Styling notes, atelier dispatches and short essays — written slowly, published
          when they are ready.
        </p>
      </Reveal>

      {isLoading ? (
        <div className="mt-10 animate-pulse space-y-8" aria-busy>
          <div className="aspect-[3/2] w-full bg-secondary" />
          <div className="grid gap-8 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] bg-secondary" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {featured ? (
            <Reveal delay={0.08} className="mt-10">
              <Link
                to={`/journal/${featured.slug}`}
                className="group grid gap-8 border-t border-line pt-10 lg:grid-cols-2 lg:gap-14"
              >
                <div className="relative overflow-hidden">
                  <ProductImage
                    src={featured.coverImage}
                    alt={featured.title}
                    label={featured.title}
                    ratio="aspect-[4/5] lg:aspect-[5/6]"
                    className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                  <span className="eyebrow absolute left-4 top-4 bg-background/90 px-3 py-1.5 !text-[0.55rem] backdrop-blur-sm">
                    Featured
                  </span>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="eyebrow">
                    {featured.category} · {featured.readTime} min read
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-light leading-tight tracking-tight text-balance group-hover:text-espresso sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                    {featured.excerpt}
                  </p>
                  <p className="mt-5 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/70">
                    {formatDate(featured.publishedAt)}
                  </p>
                  <span className="eyebrow-ink mt-7 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors group-hover:border-espresso group-hover:text-espresso">
                    Read the piece
                    <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          ) : null}

          {rest.length > 0 ? (
            <div className="mt-16 grid gap-8 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {rest.map((post, i) => (
                <Reveal key={post.slug} delay={i * 0.08}>
                  <Link to={`/journal/${post.slug}`} className="group block">
                    <ProductImage
                      src={post.coverImage}
                      alt={post.title}
                      label={post.title}
                      ratio="aspect-[4/5]"
                      className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                    />
                    <p className="eyebrow mt-4">
                      {post.category} · {post.readTime} min read
                    </p>
                    <h3 className="mt-2 font-display text-xl font-light leading-snug tracking-tight group-hover:text-espresso">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                    <p className="mt-3 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/70">
                      {formatDate(post.publishedAt)}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : null}

          <div className="mt-16 border-t border-line pt-10 text-center">
            <p className="font-display text-2xl font-light italic text-muted-foreground">
              Volume 03 — mills & dye houses — is being written.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="eyebrow-ink mt-6 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
            >
              Meanwhile, the collection
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
