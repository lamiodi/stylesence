'use client'

import { useMemo, useState } from 'react'
import { Globe } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { COUNTRIES, POPULAR_COUNTRIES, type CountryEntry } from '@/lib/geo'
import { CURRENCIES, currencyForCountry, type CurrencyCode } from '@/lib/fx'
import { dismissSuggestion, useCurrency } from '@/lib/store/currency'

/**
 * Country + display-currency selector. Auto-opens once after a geo detection
 * that changes the currency away from naira; the navbar pill reopens it any
 * time. Saving is a manual choice (cookies, silences future suggestions);
 * "Not now" only suppresses the auto-suggestion.
 */
export function CurrencyModal() {
  const open = useCurrency((s) => s.modalOpen)
  const setModalOpen = useCurrency((s) => s.setModalOpen)
  const savedCountry = useCurrency((s) => s.country)
  const savedCurrency = useCurrency((s) => s.currency)
  const choose = useCurrency((s) => s.choose)

  const [country, setCountry] = useState(savedCountry ?? 'Nigeria')
  const [currency, setCurrency] = useState<CurrencyCode>(savedCurrency)

  // Re-seed from the store each time it opens (auto-suggest may have just
  // written a detected country). Render-phase adjustment on the open
  // transition — the sanctioned no-effect pattern (react.dev "adjusting state
  // when a prop changes"); React discards the partial render and re-renders
  // immediately, with no cascading effect pass.
  const [seededOpen, setSeededOpen] = useState(open)
  if (open !== seededOpen) {
    setSeededOpen(open)
    if (open) {
      setCountry(savedCountry ?? 'Nigeria')
      setCurrency(savedCurrency)
    }
  }

  const options = useMemo(() => {
    const byName = new Map(COUNTRIES.map((c) => [c.name, c]))
    const popular = POPULAR_COUNTRIES.map((n) => byName.get(n)).filter((c): c is CountryEntry => Boolean(c))
    const rest = COUNTRIES.filter((c) => !(POPULAR_COUNTRIES as readonly string[]).includes(c.name))
    return [...popular, ...rest]
  }, [])

  const onCountryChange = (name: string) => {
    setCountry(name)
    const entry = COUNTRIES.find((c) => c.name === name)
    if (entry) setCurrency(currencyForCountry(entry.code))
  }

  const save = () => choose(country, currency)

  return (
    <Dialog open={open} onOpenChange={setModalOpen}>
      <DialogContent className="rounded-none border-line bg-card p-0 sm:max-w-md">
        <div className="px-8 pt-10 pb-8 sm:px-10">
          <p className="eyebrow flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Your location
          </p>
          <DialogTitle className="mt-3 font-display text-3xl font-light leading-tight tracking-tight text-balance">
            Shopping from where?
          </DialogTitle>
          <DialogDescription asChild>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We deliver worldwide. Pick your destination and we&apos;ll show prices in a
              currency that makes sense — checkout itself is always settled in naira.
            </p>
          </DialogDescription>

          <div className="mt-7 space-y-5">
            <div>
              <label htmlFor="currency-country" className="eyebrow !text-[0.58rem]">
                Ship to
              </label>
              <select
                id="currency-country"
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
                className="mt-1.5 h-11 w-full border border-line-strong bg-background px-3 text-sm outline-none transition-colors focus:border-espresso"
              >
                {options.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="eyebrow !text-[0.58rem]">Show prices in</p>
              <div
                className="mt-1.5 grid grid-cols-3 border border-line-strong"
                role="radiogroup"
                aria-label="Currency"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code, i) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={currency === code}
                    onClick={() => setCurrency(code)}
                    className={cnRadio(currency === code, i > 0)}
                  >
                    {CURRENCIES[code].label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              className="flex h-12 w-full items-center justify-center border border-foreground bg-foreground text-[0.64rem] font-medium uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
            >
              Show me prices in {CURRENCIES[currency].label}
            </button>
            <button
              type="button"
              onClick={() => {
                dismissSuggestion()
                setModalOpen(false)
              }}
              className="mx-auto block text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function cnRadio(selected: boolean, hasBorder: boolean): string {
  return [
    'flex h-11 items-center justify-center px-1 text-[0.66rem] font-medium uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
    hasBorder ? 'border-l border-line' : '',
    selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
  ].join(' ')
}
