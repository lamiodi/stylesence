import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function RatingStars({
  rating,
  size = 14,
  className,
  interactive = false,
}: {
  rating: number
  size?: number
  className?: string
  interactive?: boolean
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-[3px]', className)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rated ${rating} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = rating >= i - 0.25
        const half = !filled && rating >= i - 0.75
        return (
          <Star
            key={i}
            width={size}
            height={size}
            aria-hidden
            className={cn(
              'shrink-0',
              filled
                ? 'fill-espresso text-espresso'
                : half
                  ? 'fill-espresso/40 text-espresso/60'
                  : 'text-muted-foreground/35',
            )}
            strokeWidth={1.5}
          />
        )
      })}
    </span>
  )
}
