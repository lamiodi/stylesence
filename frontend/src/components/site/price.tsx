'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'

/**
 * Price display with optional struck-through compare-at price.
 */
export function Price({
  price,
  compareAtPrice,
  className,
  size = 'md',
}: {
  price: number
  compareAtPrice?: number | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeCls = size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-[0.8rem]' : 'text-sm'
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-mono', sizeCls, className)}>
      <span className="font-medium tabular-nums">{formatNaira(price)}</span>
      {compareAtPrice && compareAtPrice > price ? (
        <span className="text-muted-foreground/70 line-through decoration-[1px] tabular-nums">
          {formatNaira(compareAtPrice)}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Image with graceful tonal fallback — keeps the storefront composed
 * while assets stream in or if a file is missing.
 */
export function ProductImage({
  src,
  alt,
  className,
  label,
  ratio = 'aspect-[3/4]',
  eager = false,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  label?: string
  ratio?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-secondary',
          ratio,
          className,
        )}
        aria-label={alt}
        role="img"
      >
        <div className="px-6 text-center">
          <p className="font-display text-lg italic text-muted-foreground/70">{label ?? alt}</p>
          <p className="eyebrow mt-2 !text-[0.55rem]">Style Sence</p>
        </div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in oklch, var(--foreground) 5%, transparent) 14px 15px)',
          }}
        />
      </div>
    )
  }

  const isVideo = src.endsWith('.mp4') || src.endsWith('.webm')

  return (
    <div className={cn('relative overflow-hidden bg-secondary', ratio, className)}>
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 animate-pulse bg-secondary transition-opacity duration-700',
          loaded && 'opacity-0',
        )}
      />
      {isVideo ? (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-700',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-700',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
