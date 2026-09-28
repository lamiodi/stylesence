/**
 * Paystack brand mark (stacked-rails icon in the brand tile). Used in the
 * checkout payment section and the footer payment marks so customers can
 * see at a glance that card/bank/USSD payment is powered by Paystack.
 */
export function PaystackMark({
  className,
  ariaLabel = 'Paystack',
}: {
  className?: string
  ariaLabel?: string
}) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={ariaLabel} className={className}>
      <rect width="32" height="32" rx="7" fill="#011B33" />
      <rect x="7" y="8" width="18" height="3.2" rx="1.6" fill="#00C3F7" />
      <rect x="7" y="14.4" width="18" height="3.2" rx="1.6" fill="#FFFFFF" />
      <rect x="7" y="20.8" width="12" height="3.2" rx="1.6" fill="#FFFFFF" />
    </svg>
  )
}
