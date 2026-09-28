import { Copy } from 'lucide-react'
import { FOREIGN_ACCOUNT } from '@/lib/payment-details'

/**
 * Direct-transfer block for international customers. With real account
 * details configured (lib/payment-details.ts) it lists them with one-tap
 * copy buttons; without them it points to the WhatsApp concierge so the
 * flow never dead-ends.
 */
export function ForeignTransferBlock({ compact = false }: { compact?: boolean }) {
  if (!FOREIGN_ACCOUNT) {
    return (
      <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
        The studio sends international transfer details with your order
        confirmation — or WhatsApp{' '}
        <a
          href="https://wa.me/2348163022233"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          +234 816 302 2233
        </a>{' '}
        and we will send them right away.
      </p>
    )
  }

  const rows: [string, string][] = [
    ['Bank', FOREIGN_ACCOUNT.bankName],
    ['Account name', FOREIGN_ACCOUNT.accountName],
    [FOREIGN_ACCOUNT.iban ? 'Account number' : `Account number (${FOREIGN_ACCOUNT.currency})`, FOREIGN_ACCOUNT.accountNumber],
    ...(FOREIGN_ACCOUNT.iban ? [['IBAN', FOREIGN_ACCOUNT.iban] as [string, string]] : []),
    ['SWIFT/BIC', FOREIGN_ACCOUNT.swift],
  ]

  return (
    <div className={compact ? '' : 'border border-line bg-card p-4'}>
      <p className="eyebrow">Direct international transfer</p>
      <dl className="mt-2.5 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
            <dd className="flex items-center gap-1.5">
              <span className="font-mono text-[0.78rem] tabular-nums">{v}</span>
              <button
                type="button"
                aria-label={`Copy ${k}`}
                onClick={() => navigator.clipboard?.writeText(v)}
                className="text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <Copy className="h-3 w-3" strokeWidth={1.5} aria-hidden />
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[0.66rem] leading-relaxed text-muted-foreground">
        {FOREIGN_ACCOUNT.note ?? 'Reference your order number as the transfer narration.'} Send
        payment proof on WhatsApp{' '}
        <a
          href="https://wa.me/2348163022233"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          +234 816 302 2233
        </a>{' '}
        — production begins the moment payment lands.
      </p>
    </div>
  )
}
