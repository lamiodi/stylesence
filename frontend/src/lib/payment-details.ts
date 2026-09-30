/**
 * Studio bank details for direct international transfers.
 *
 * The owner fills this in ONCE and every international customer sees it at
 * checkout (Pay on confirmation is the international rail while cards are
 * coming soon) and on pending orders. Keep it null to hide the block — an
 * empty template renders nothing rather than placeholder banking details.
 */
export interface ForeignAccountDetails {
  /** Receiving bank, e.g. 'Wise — TransferWise Ltd'. */
  bankName: string
  /** Exact account name the transfer must address. */
  accountName: string
  /** Account number (or IBAN — use the iban field when separate). */
  accountNumber: string
  /** SWIFT/BIC code. */
  swift: string
  /** Transfer currency the account settles in, e.g. 'USD'. */
  currency: string
  /** UK sort code, when the account is identified by sort code + number. */
  sortCode?: string
  /** Optional IBAN, when the account number is not already one. */
  iban?: string
  /** Optional extra line, e.g. 'Reference your order number'. */
  note?: string
}

// ── Studio's GBP receiving account (owner-supplied 2026-09-30) ──
export const FOREIGN_ACCOUNT: ForeignAccountDetails | null = {
  bankName: 'Monzo Bank',
  accountName: 'Aderonke Ayanmo',
  accountNumber: '21465802',
  sortCode: '04-00-03',
  swift: 'MONZGB21',
  currency: 'GBP',
  note: 'Reference your order number as the transfer narration.',
}
