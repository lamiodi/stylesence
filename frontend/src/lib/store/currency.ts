'use client'

import { create } from 'zustand'
import { CURRENCIES, currencyForCountry, currencyForTimezone, convertFromNaira, formatMoney, type CurrencyCode } from '@/lib/fx'
import { COUNTRIES } from '@/lib/geo'

/** ISO code → country name, for persisting a readable country next to the currency. */
const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
)

/**
 * Display-currency preference — cookie-backed so it survives visits and can
 * later inform SSR. Read synchronously at store creation: the shell renders
 * nothing until mounted, so the first painted frame already uses the saved
 * currency (no ₦→$ flash). The server render keeps the ₦ default, which is
 * also what search crawlers see.
 *
 * `manual` (visitor picked in the modal) silences all future auto-suggestions.
 * An auto-detected choice is also written to the cookie so the geo fetch runs
 * at most once per visitor.
 */
export const CURRENCY_COOKIE = 'ss-currency'
export const COUNTRY_COOKIE = 'ss-country'
export const MODE_COOKIE = 'ss-currency-mode' // 'manual' | 'auto'
export const ASK_COOKIE = 'ss-currency-ask' // suggestion dismissed for a year
const YEAR_MAX_AGE = 60 * 60 * 24 * 365

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${YEAR_MAX_AGE}; path=/; SameSite=Lax`
}

export interface CurrencyState {
  currency: CurrencyCode
  /** Country NAME (matches the geo.ts entries / checkout values), or null. */
  country: string | null
  manual: boolean
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  /** Visitor's explicit pick in the selector — wins over any future detection. */
  choose: (country: string, currency: CurrencyCode) => void
  /**
   * Auto-detected (geo header or timezone). Applies only while no manual
   * choice exists, then persists to the cookie so detection never re-runs.
   */
  applyDetected: (country: string, currency: CurrencyCode) => void
}

function initialState(): { currency: CurrencyCode; country: string | null; manual: boolean } {
  const currency = (readCookie(CURRENCY_COOKIE) as CurrencyCode | null) ?? 'NGN'
  const valid = currency in CURRENCIES ? currency : 'NGN'
  return {
    currency: valid,
    country: readCookie(COUNTRY_COOKIE),
    manual: readCookie(MODE_COOKIE) === 'manual',
  }
}

export const useCurrency = create<CurrencyState>()((set) => ({
  ...initialState(),
  modalOpen: false,
  setModalOpen: (open) => set({ modalOpen: open }),
  choose: (country, currency) => {
    writeCookie(CURRENCY_COOKIE, currency)
    writeCookie(COUNTRY_COOKIE, country)
    writeCookie(MODE_COOKIE, 'manual')
    set({ country, currency, manual: true, modalOpen: false })
  },
  applyDetected: (country, currency) => {
    if (useCurrency.getState().manual) return
    writeCookie(CURRENCY_COOKIE, currency)
    writeCookie(COUNTRY_COOKIE, country)
    writeCookie(MODE_COOKIE, 'auto')
    set({ country, currency })
  },
}))

/** Did the visitor already dismiss the auto-suggestion? */
export function suggestionDismissed(): boolean {
  return readCookie(ASK_COOKIE) === '1'
}

/** Suppress the auto-suggestion for a year (the modal's "keep browsing" exit). */
export function dismissSuggestion(): void {
  writeCookie(ASK_COOKIE, '1')
}

function safeTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

/**
 * One-shot detection — runs once per visitor, after the page is visible and
 * idle (nothing waits on it). Resolution order: a persisted choice (manual or
 * a previous detection) short-circuits; then the geo route; then the
 * timezone heuristic. When detection moves the currency away from naira, the
 * selector modal suggests it once — never stacking on an open overlay.
 */
export async function detectCurrency(): Promise<void> {
  const st = useCurrency.getState()
  if (st.manual || st.country) return

  let code: string | null = null
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' })
    if (res.ok) {
      const data: { country?: unknown } = await res.json()
      if (typeof data.country === 'string' && data.country.length === 2) code = data.country
    }
  } catch {
    // Offline / blocked — the timezone fallback below still applies.
  }

  const currency = code ? currencyForCountry(code) : currencyForTimezone(safeTimezone())
  if (code) {
    useCurrency.getState().applyDetected(COUNTRY_NAMES[code] ?? code, currency)
  } else {
    // No geo at all: apply the timezone hint in memory only — no cookie, so a
    // real detection can still happen on a later visit.
    useCurrency.setState({ currency })
  }

  if (currency !== 'NGN' && !suggestionDismissed() && !document.querySelector('[data-state="open"]')) {
    dismissSuggestion() // one ask per visitor, whichever way it's closed
    useCurrency.getState().setModalOpen(true)
  }
}

/**
 * Currency-aware money formatter for storefront surfaces. Naira amounts stay
 * canonical everywhere; this only changes how they render, so no surface
 * needs currency logic beyond calling `format`.
 */
export function useMoney() {
  const currency = useCurrency((s) => s.currency)
  return {
    currency,
    /** Selected-currency rendering of a canonical naira amount. */
    format: (naira: number) => formatMoney(naira, currency),
    /** Whole display-currency units of a naira amount (for totals math). */
    convert: (naira: number) => convertFromNaira(naira, currency),
  }
}
