'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  disabled = false,
  className,
  compact = false,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  compact?: boolean
}) {
  const btn = cn(
    'flex items-center justify-center text-foreground transition-colors',
    'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-40',
    compact ? 'h-7 w-7' : 'h-11 w-11',
  )

  return (
    <div
      className={cn(
        'inline-flex items-center border border-line-strong',
        compact ? 'h-7' : 'h-11',
        className,
      )}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className={compact ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={1.5} />
      </button>
      <span
        className={cn(
          'flex min-w-8 items-center justify-center border-x border-line font-mono tabular-nums',
          compact ? 'h-7 text-xs' : 'h-11 text-sm',
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus className={compact ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={1.5} />
      </button>
    </div>
  )
}
