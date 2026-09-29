'use client'

import { useState } from 'react'
import { Ruler, Clock3, Package } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Link } from '@/lib/router'
import { cn } from '@/lib/utils'

/**
 * "How made-to-order works" — a click-to-open explainer (never an auto
 * popup). Lives beside the hero CTAs on the homepage.
 */
const STEPS = [
  {
    icon: Ruler,
    title: 'Choose & confirm',
    body: 'Pick a size XS–XXL, or add bespoke measurements at checkout. You confirm every detail before a single cut is made.',
  },
  {
    icon: Clock3,
    title: 'Cut to order in Lagos',
    body: 'Each piece is made for you, not pulled from a shelf — standard production is 7–10 working days, express 2–3.',
  },
  {
    icon: Package,
    title: 'Delivered to your door',
    body: '1–3 days in Lagos, 2–7 nationwide, 7–20 days worldwide. Import duties, where they apply, are settled by the recipient.',
  },
] as const

export function HowItWorksModal({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 border-b border-primary-foreground/40 pb-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.24em] text-primary-foreground/75 transition-colors hover:border-primary-foreground hover:text-primary-foreground',
          className,
        )}
      >
        How made-to-order works
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none border-line bg-card p-0 sm:max-w-lg">
          <div className="px-8 pt-10 pb-8 sm:px-10">
            <p className="eyebrow">The atelier</p>
            <DialogTitle className="mt-3 font-display text-3xl font-light leading-tight tracking-tight">
              Made for you, not from a shelf.
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Every Style Sence piece is cut after you order — here is exactly what happens between
                checkout and your doorstep.
              </p>
            </DialogDescription>

            <ol className="mt-8 space-y-6">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong">
                      <Icon className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    </span>
                    <div>
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
                        Step {i + 1}
                      </p>
                      <p className="mt-1 font-display text-lg leading-snug">{step.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="mt-8 border-t border-line pt-5">
              <Link
                to="/help"
                onClick={() => setOpen(false)}
                className="eyebrow-ink border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
              >
                More answers at the help desk
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
