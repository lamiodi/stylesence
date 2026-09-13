import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Clearly-labelled development placeholder for unresolved commercial details.
 * Used for: payment gateway, shipping rates, email sending, social links, etc.
 */
export function DevPlaceholder({
  title,
  children,
  className,
  compact = false,
}: {
  title: string
  children?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'relative rounded-[--radius] border border-dashed border-espresso/45 bg-[color-mix(in_oklch,var(--espresso)_7%,transparent)]',
        compact ? 'px-3 py-2' : 'px-4 py-3.5',
        className,
      )}
      role="note"
      aria-label={`Development placeholder: ${title}`}
    >
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-espresso" aria-hidden />
        <div className="min-w-0">
          <p className="eyebrow !text-[0.6rem] text-espresso">
            Dev placeholder — {title}
          </p>
          {children ? (
            <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
