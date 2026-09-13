'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { formatDate } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import type { JournalPostView } from '@/lib/types'

export function JournalPostPage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['journal', slug],
    queryFn: async () => {
      const res = await fetch(`/api/journal/${slug}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { post: JournalPostView }
    },
    retry: false,
  })

  const post = data?.post

  useEffect(() => {
    if (post) document.title = `${post.title} — Style Sence Journal`
  }, [post])

  if (isLoading) {
    return (
      <div className="container-site max-w-3xl py-16" aria-busy>
        <div className="animate-pulse space-y-8">
          <div className="h-6 w-40 bg-secondary" />
          <div className="h-12 w-4/5 bg-secondary" />
          <div className="aspect-[16/10] w-full bg-secondary" />
          <div className="h-4 w-full bg-secondary" />
          <div className="h-4 w-11/12 bg-secondary" />
        </div>
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className="container-site flex flex-col items-center py-32 text-center">
        <p className="font-display text-4xl font-light italic">This page is unwritten.</p>
        <Button className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]" onClick={() => navigate('/journal')}>
          Back to the journal
        </Button>
      </div>
    )
  }

  const blocks = post.body.split('\n\n')

  return (
    <article className="container-site max-w-3xl py-10 sm:py-14">
      <Reveal>
        <Link
          to="/journal"
          className="eyebrow inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          The Journal
        </Link>
        <p className="eyebrow mt-6">
          {post.category} · {post.readTime} min read · {formatDate(post.publishedAt)}
        </p>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-5 border-l-2 border-espresso pl-5 font-display text-lg italic leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <ProductImage
          src={post.coverImage}
          alt={post.title}
          label={post.title}
          ratio="aspect-[16/10]"
          eager
          className="w-full"
        />
      </Reveal>

      <Reveal delay={0.14}>
        <div className="mt-12">
          {blocks.map((block, i) => {
            if (block.startsWith('## ')) {
              return (
                <h2 key={i} className="mt-12 font-display text-2xl font-light tracking-tight sm:text-[1.7rem]">
                  {block.replace(/^##\s+/, '')}
                </h2>
              )
            }
            return (
              <p key={i} className="mt-6 text-[1.02rem] leading-[1.85] text-foreground/90 first:mt-0">
                {block}
              </p>
            )
          })}
        </div>
      </Reveal>

      <Reveal delay={0.18} className="mt-16">
        <div className="border-t border-line pt-10 text-center">
          <p className="font-display text-2xl font-light italic">Dress the philosophy.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="eyebrow-ink mt-5 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
          >
            Shop the collection
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </Reveal>
    </article>
  )
}
