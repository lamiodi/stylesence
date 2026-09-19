'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Site-wide "return to the top" pill — appears after scrolling past ~1.5
 * viewports, hides near the top. Fixed above the footer on the right, under
 * the PDP sticky buy bar on mobile (bottom offset is safe under it via CSS
 * since the buy bar is lg:hidden and this is bottom-24 on small screens,
 * bottom-8 from lg). Reduced motion: the show/hide is an opacity/translate
 * transition covered by the global override; visibility itself is instant.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      setVisible(window.scrollY > window.innerHeight * 1.5)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <button
      type="button"
      aria-label="Return to the top of the page"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={cn(
        'no-print fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center border border-line-strong bg-background/95 text-muted-foreground shadow-[0_2px_12px_oklch(0.235_0.008_70_/_0.08)] backdrop-blur-sm transition-all duration-300 motion-reduce:transition-none lg:bottom-24 lg:right-8',
        'hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
      tabIndex={visible ? 0 : -1}
      inert={!visible}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </button>
  )
}
