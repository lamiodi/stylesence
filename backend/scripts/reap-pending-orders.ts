/**
 * PENDING_PAYMENT reaper — closes out gateway-rail orders whose payment
 * window has definitively ended, releasing their stock and promo usage.
 *
 * Scope (deliberately narrow):
 *   • Only gateway orders (paystack / stripe) WITH a stored paymentReference.
 *     Studio-confirmed orders and reference-less gateway orders (gateway was
 *     down at checkout — the customer was told the studio will be in touch)
 *     are a human process and are never auto-cancelled.
 *   • Only orders older than PENDING_TTL_DAYS (default 3).
 *   • Each candidate gets a last-chance gateway verification first:
 *       paid → settle (PAID + confirmation email, exactly-once as always);
 *       definitive failure (Paystack failed/abandoned/reversed/expired,
 *       Stripe unpaid) → cancel + restock + promo refund in one transaction;
 *       anything else (network error, still ongoing, unknown) → untouched.
 *
 * Usage:
 *   npx tsx scripts/reap-pending-orders.ts            # dry-run (default)
 *   REAP_LIVE=1 npx tsx scripts/reap-pending-orders.ts # live cancelling
 * In production instrumentation.ts schedules it (REAPER_ENABLED /
 * REAPER_DRY_RUN / PENDING_TTL_DAYS envs — see render.yaml).
 */
import { db } from '../lib/db'
import { settleGatewayPayment } from '../lib/order-settle'
import { refundPromoUsage } from '../lib/promo'
import { verifyPaystack, verifyStripe } from '../lib/payments'

const DEFAULT_TTL_DAYS = 3

/** Paystack statuses that mean the session can never complete. */
const PAYSTACK_DEAD = new Set(['failed', 'abandoned', 'reversed', 'expired'])

export interface ReapSummary {
  cutoff: Date
  candidates: number
  settled: number
  cancelled: number
  skipped: number
  dryRun: boolean
}

/** One reaper pass. Safe to run concurrently with traffic — every mutation
 * is guarded (settle is exactly-once; cancel flips on PENDING_PAYMENT). */
export async function reapPendingOrders(dryRun: boolean, ttlDays = DEFAULT_TTL_DAYS): Promise<ReapSummary> {
  const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000)
  const stale = await db.order.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      paymentMethod: { in: ['paystack', 'stripe'] },
      paymentReference: { not: null },
      createdAt: { lt: cutoff },
    },
    include: { items: true },
  })

  const summary: ReapSummary = { cutoff, candidates: stale.length, settled: 0, cancelled: 0, skipped: 0, dryRun }

  for (const order of stale) {
    const reference = order.paymentReference!
    try {
      const result =
        order.paymentMethod === 'paystack'
          ? await verifyPaystack(reference)
          : await verifyStripe(reference)

      if (result.paid) {
        // Late landing (webhook missed + customer never returned) — settle now.
        const outcome = await settleGatewayPayment(order, reference, result.amountNaira)
        if (outcome === 'settled') {
          summary.settled++
          console.log(`[reaper] settled ${order.orderNumber} via last-chance verify`)
        } else if (outcome === 'amount-mismatch') {
          summary.skipped++
          console.error(`[reaper] AMOUNT MISMATCH on ${order.orderNumber} — manual review needed`)
        } else {
          summary.skipped++ // raced in via webhook/verify — fine
        }
        continue
      }

      const gatewayStatus = (result.gatewayStatus ?? '').toLowerCase()
      const dead =
        order.paymentMethod === 'paystack'
          ? PAYSTACK_DEAD.has(gatewayStatus)
          : gatewayStatus === 'unpaid' // Stripe session expired without paying
      if (!dead) {
        summary.skipped++
        console.log(`[reaper] skipping ${order.orderNumber} — gateway status "${gatewayStatus || 'unknown'}" is not definitive`)
        continue
      }

      if (dryRun) {
        summary.skipped++
        console.log(`[reaper][dry-run] would cancel + restock ${order.orderNumber} (${gatewayStatus})`)
        continue
      }

      await db.$transaction(async (tx) => {
        // Same restock contract as an admin cancel (legacy rows without a
        // variant link are skipped, not failed).
        for (const item of order.items) {
          if (!item.variantId) continue
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          })
        }
        await refundPromoUsage(tx, order.promoCode, order.promoCodes)
        await tx.order.update({
          where: { id: order.id, status: 'PENDING_PAYMENT' },
          data: { status: 'CANCELLED' },
        })
      })
      summary.cancelled++
      console.log(`[reaper] cancelled + restocked ${order.orderNumber} (${gatewayStatus})`)
    } catch (err) {
      summary.skipped++
      console.error(`[reaper] error processing ${order.orderNumber} — left untouched:`, err)
    }
  }

  console.log(
    `[reaper] pass complete — ${summary.candidates} candidates, ${summary.settled} settled, ` +
      `${summary.cancelled} cancelled, ${summary.skipped} skipped${dryRun ? ' (dry-run)' : ''}`,
  )
  return summary
}

// CLI entry — direct execution only (instrumentation imports the function).
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('reap-pending-orders.ts')) {
  const ttlDays = Number(process.env.PENDING_TTL_DAYS ?? DEFAULT_TTL_DAYS) || DEFAULT_TTL_DAYS
  const dryRun = process.env.REAP_LIVE !== '1' && process.env.REAPER_DRY_RUN !== 'false'
  reapPendingOrders(dryRun, ttlDays)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[reaper] fatal:', err)
      process.exit(1)
    })
}
