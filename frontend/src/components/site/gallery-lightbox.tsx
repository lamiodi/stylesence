'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/**
 * Full-screen image zoom lightbox for the PDP gallery.
 *
 * Built on the shadcn/ui Dialog (Radix) so it inherits the a11y discipline:
 * focus trap, aria-modal, labelled by a (screen-reader) title, Escape to
 * close and body-scroll lock. Backdrop is the charcoal ink (#26231F) with
 * hairline ivory controls; the image itself stays centred and uncluttered.
 *
 * prefers-reduced-motion: the open/close fade and the image crossfade are
 * suppressed (instant open, instant swap). The global CSS rule in
 * globals.css already zeroes CSS animation durations; the framer crossfade
 * is gated here via useReducedMotion().
 *
 * Controlled component — the parent owns both the open state and the
 * current index (usually the PDP gallery's own imgIndex), so the gallery
 * behind the overlay stays in sync while the lightbox browses.
 */
export function GalleryLightbox({
  images,
  index,
  open,
  onOpenChange,
  onNavigate,
  label,
}: {
  images: { url: string; alt: string | null }[]
  /** Index of the image currently shown (shared with the PDP gallery). */
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Report navigation inside the lightbox (prev/next/arrows). */
  onNavigate: (index: number) => void
  /** Product name — used for the dialog title and image alt fallback. */
  label: string
}) {
  const reduced = useReducedMotion()
  const count = images.length
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, count - 1))
  const current = images[safeIndex]
  const multi = count > 1

  // The dialog is opened without a Radix trigger (both affordances live in the
  // gallery), so Radix has no element to hand focus back to — remember the
  // opener ourselves and restore focus on close (one rAF after unmount).
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return
    }
    const opener = openerRef.current
    if (!opener) return
    openerRef.current = null
    const raf = requestAnimationFrame(() => {
      if (opener.isConnected) opener.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  const go = (delta: 1 | -1) => {
    if (!multi) return
    onNavigate((safeIndex + delta + count) % count)
  }

  if (count === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // No description node in a lightbox — silence Radix's aria-describedby warning.
        aria-describedby={undefined}
        // Explicit (Radix 1.1 does not set it itself) — this dialog is strictly modal.
        aria-modal={true}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            go(-1)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            go(1)
          }
        }}
        className={cn(
          // Full-bleed charcoal overlay — overrides the centred card defaults
          // (incl. the sm:max-w-lg variant, which needs its own sm: override).
          'inset-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 p-0 shadow-none sm:max-w-none',
          'grid grid-rows-1 overflow-hidden bg-[#26231F]',
          // Keep the fade, drop the card zoom.
          'data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100',
          // Reduced motion: no open/close fade at all (instant appear/disappear).
          reduced && 'data-[state=open]:animate-none data-[state=closed]:animate-none',
        )}
      >
        <DialogTitle className="sr-only">{label} — image viewer</DialogTitle>

        <div
          className="relative h-dvh w-full"
          onClick={(e) => {
            // click on the charcoal itself (not the image or controls) dismisses
            if (e.target === e.currentTarget) onOpenChange(false)
          }}
        >
          {/* ————— image stage (click on the empty charcoal to dismiss) ————— */}
          <div className="absolute inset-x-14 bottom-16 top-16 sm:inset-x-20">
            <div
              className="relative h-full w-full"
              onClick={(e) => {
                if (e.target === e.currentTarget) onOpenChange(false)
              }}
            >
              {current.url.endsWith('.mp4') || current.url.endsWith('.webm') ? (
                <video
                  key={safeIndex}
                  src={current.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
                />
              ) : reduced ? (
                <img
                  key={safeIndex}
                  src={current.url}
                  alt={current.alt ?? label}
                  className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
                />
              ) : (
                <AnimatePresence initial={false}>
                  <motion.img
                    key={safeIndex}
                    src={current.url}
                    alt={current.alt ?? label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain"
                  />
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* ————— top bar: mono counter + close ————— */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-4 sm:p-6">
            <p
              aria-live="polite"
              className="font-mono text-[0.72rem] tracking-[0.12em] text-[#F6F1E9]/80 tabular-nums"
            >
              {safeIndex + 1} / {count}
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close image viewer"
              className="flex h-11 w-11 items-center justify-center border border-[rgba(246,241,233,0.28)] text-[#F6F1E9]/85 transition-colors hover:border-[#F6F1E9] hover:text-[#F6F1E9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          {/* ————— prev / next ————— */}
          {multi ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[rgba(246,241,233,0.28)] bg-[#26231F]/60 text-[#F6F1E9]/85 backdrop-blur-sm transition-colors hover:border-[#F6F1E9] hover:text-[#F6F1E9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:left-6"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[rgba(246,241,233,0.28)] bg-[#26231F]/60 text-[#F6F1E9]/85 backdrop-blur-sm transition-colors hover:border-[#F6F1E9] hover:text-[#F6F1E9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-6"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
