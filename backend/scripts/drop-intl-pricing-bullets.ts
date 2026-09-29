/**
 * One-off: strip the "International pricing: $… · £…" details bullets added
 * 2026-09-29 — superseded by the live display-currency converter (frontend
 * fx.ts), which renders estimates on every price surface. Made-to-measure
 * and garment-measurement bullets stay. Idempotent.
 */
import { db } from '../lib/db'

async function main() {
  const products = await db.product.findMany({
    where: { details: { contains: 'International pricing:' } },
    select: { id: true, slug: true, details: true },
  })
  for (const p of products) {
    const kept = (p.details ?? '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('International pricing:'))
    await db.product.update({ where: { id: p.id }, data: { details: kept.join('\n') } })
    console.log(`${p.slug}: removed ${p.details!.split('\n').length - kept.length} line(s)`)
  }
  console.log(`Done — ${products.length} product(s) touched.`)
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
