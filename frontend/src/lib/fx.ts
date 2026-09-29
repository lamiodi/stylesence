/**
 * Display-currency conversion — Phase 1, display-only estimates.
 *
 * Naira is the only charged currency: every cart, checkout, order and receipt
 * amount is authoritative in NGN. USD/GBP renderings are estimates at the
 * single studio rate below, derived from the client's own 2026-09-29 price
 * sheet (₦1,330/$ and ₦1,786/£). The sheet's per-product quotes differ
 * slightly from any one rate — with these, the Camille sets and both Ariella
 * dresses render exactly; the Àrẹ̀wà Set shows $263/£196 vs the quoted
 * $264/£193. Exact per-product price books (priceUsdCents/priceGbpPence) are
 * a later, chargeable phase — keep this file in sync with backend/lib/fx.ts
 * when that lands.
 */
export type CurrencyCode = 'NGN' | 'USD' | 'GBP'

export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; locale: string; label: string }
> = {
  NGN: { code: 'NGN', symbol: '₦', locale: 'en-NG', label: '₦ NGN' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', label: '$ USD' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', label: '£ GBP' },
}

/** Studio rate: naira per unit of the display currency. */
export const NAIRA_PER_UNIT: Record<CurrencyCode, number> = {
  NGN: 1,
  USD: 1330,
  GBP: 1786,
}

/** Naira amount → whole units of the display currency. */
export function convertFromNaira(naira: number, currency: CurrencyCode): number {
  if (currency === 'NGN') return Math.round(naira)
  return Math.round(naira / NAIRA_PER_UNIT[currency])
}

/** Naira amount → formatted display string (e.g. ₦149,999 / $113 / £84). */
export function formatMoney(naira: number, currency: CurrencyCode): string {
  const c = CURRENCIES[currency]
  return `${c.symbol}${convertFromNaira(naira, currency).toLocaleString(c.locale)}`
}

/** ISO 3166-1 alpha-2 country code → suggested display currency. */
export function currencyForCountry(code: string | null | undefined): CurrencyCode {
  if (code === 'US') return 'USD'
  if (code === 'GB') return 'GBP'
  return 'NGN'
}

/**
 * Timezone fallback for when the geo header is unavailable (local dev,
 * hardened browsers). Only used to suggest — never to charge.
 */
export function currencyForTimezone(tz: string | null | undefined): CurrencyCode {
  if (!tz) return 'NGN'
  if (tz === 'Europe/London') return 'GBP'
  if (tz.startsWith('America/')) return 'USD'
  return 'NGN'
}
