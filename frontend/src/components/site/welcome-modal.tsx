'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/**
 * Homepage welcome modal — the house-list offer (the ATELIER10 code the
 * newsletter welcome email already carries), with a worldwide-delivery line
 * for visitors outside the Paystack markets.
 *
 * One shot per visitor:
 *   • never within the first 5 seconds on the page
 *   • desktop: exit intent (pointer leaving through the top) or 45% scroll
 *   • mobile: 45% scroll depth or a 15s dwell timer
 *   • once per browser session, re-eligible after 30 days
 *   • suppressed while any Radix overlay is open (cart sheet, dialogs)
 */
const SEEN_KEY = 'ss-welcome-last'
const SESSION_KEY = 'ss-welcome-session'
const REASK_MS = 30 * 24 * 60 * 60 * 1000
const MIN_AGE_MS = 5_000
const DWELL_MAX_MS = 15_000
const SCROLL_THRESHOLD = 0.45

/** Timezones of the home markets — everyone else sees the worldwide line. */
const HOME_TIMEZONES = ['Africa/Lagos', 'Africa/Accra', 'Africa/Johannesburg', 'Africa/Nairobi']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  const international = useMemo(() => {
    try {
      return !HOME_TIMEZONES.includes(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let store: Storage | null = null
    try {
      store = localStorage
      const last = Number(localStorage.getItem(SEEN_KEY) ?? 0)
      if (Number.isFinite(last) && Date.now() - last < REASK_MS) return
      if (sessionStorage.getItem(SESSION_KEY) === '1') return
    } catch {
      // Private mode — show it; persistence simply won't stick.
    }

    const arrivedAt = Date.now()
    let fired = false
    const fire = () => {
      if (fired) return
      if (Date.now() - arrivedAt < MIN_AGE_MS) return
      // Never stack on the cart sheet / another dialog.
      if (document.querySelector('[data-state="open"]')) return
      fired = true
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch { /* ignore */ }
      try {
        store?.setItem(SEEN_KEY, String(Date.now()))
      } catch { /* ignore */ }
      setOpen(true)
    }

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable > 0 && window.scrollY / scrollable >= SCROLL_THRESHOLD) fire()
    }
    const onExitIntent = (e: MouseEvent) => {
      if (e.clientY <= 8 && !e.relatedTarget) fire()
    }

    const coarse = window.matchMedia('(pointer: coarse)').matches
    const dwell = coarse ? window.setTimeout(fire, DWELL_MAX_MS) : null
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('mouseout', onExitIntent)
    return () => {
      if (dwell !== null) window.clearTimeout(dwell)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onExitIntent)
    }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      if (!res.ok) throw new Error('Request failed')
      setSubscribed(true)
    } catch {
      toast.error('Could not join the list — please try again in a moment.')
    }
    setBusy(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-none border-line bg-card p-0 sm:max-w-md">
        <div className="px-8 pt-10 pb-8 sm:px-10">
          <p className="eyebrow">The house list</p>
          <DialogTitle className="mt-3 font-display text-3xl font-light leading-tight tracking-tight text-balance">
            Ten percent, with our compliments.
          </DialogTitle>
          <DialogDescription asChild>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              First look at new pieces, atelier notes and private sales — plus{' '}
              <span className="font-mono text-[0.72rem] tracking-[0.14em] text-espresso">ATELIER10</span>{' '}
              for your first order.
            </p>
          </DialogDescription>
          {international ? (
            <p className="mt-3 border-l-2 border-espresso/50 pl-3 text-xs leading-relaxed text-muted-foreground">
              We deliver worldwide — 7–15 days to most destinations, duties settled by the recipient.
            </p>
          ) : null}

          {subscribed ? (
            <div className="mt-7 flex items-start gap-3 border border-line bg-secondary/50 p-4">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
              <div>
                <p className="text-sm font-medium">Welcome to the house.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your code is on its way — check your inbox (and the studio&apos;s occasional letters).
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="mt-7">
              <label htmlFor="welcome-email" className="sr-only">
                Email address
              </label>
              <div className="flex">
                <input
                  id="welcome-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="h-12 min-w-0 flex-1 border border-line-strong bg-background px-4 text-sm outline-none transition-colors focus:border-espresso"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-12 shrink-0 items-center gap-2 border border-foreground bg-foreground px-5 text-[0.64rem] font-medium uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Send my code'}
                  {!busy ? <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden /> : null}
                </button>
              </div>
              <p className="mt-3 text-[0.62rem] leading-relaxed text-muted-foreground">
                One email when it matters. Unsubscribe any time — no noise, ever.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
