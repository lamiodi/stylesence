/** Quick order inspection — npx tsx --env-file=.env scripts/inspect-order.ts [orderNumber] */
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)
  const target = process.argv[2]
  const rows = target
    ? await sql`SELECT "orderNumber", "paymentMethod", status, "paymentReference", total, "createdAt", email FROM "Order" WHERE "orderNumber" = ${target}`
    : await sql`SELECT "orderNumber", "paymentMethod", status, "paymentReference", total, "createdAt", email FROM "Order" ORDER BY "createdAt" DESC LIMIT 5`
  rows.forEach((r: Record<string, unknown>) =>
    console.log(
      r.orderNumber, '| method:', r.paymentMethod, '| status:', r.status,
      '| ref:', String(r.paymentReference || 'none').slice(0, 44),
      '| total:', r.total, '|', new Date(r.createdAt as string).toISOString(), '|', r.email,
    ),
  )
  await sql.end()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
