/**
 * Adds the checkout idempotency column: "Order"."idempotencyKey" + a unique
 * index so a retried checkout returns the first order instead of creating a
 * duplicate (see app/api/checkout — the route replays on this key).
 *
 * Run: npx tsx scripts/add-order-idempotency-key.ts
 * Idempotent: IF NOT EXISTS on both statements; NULL keys never conflict in a
 * Postgres unique index, so legacy/reference-less orders are unaffected.
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

// tsx does not read .env files — load backend/.env manually.
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 10,
    prepare: false,
    ssl: /sslmode=require/i.test(url) ? { rejectUnauthorized: false } : undefined,
  })
  try {
    await sql`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey")`
    const col = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Order' AND column_name = 'idempotencyKey'
    `
    const idx = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'Order' AND indexname = 'Order_idempotencyKey_key'
    `
    console.log(
      col.length === 1 && idx.length === 1
        ? 'OK — "Order"."idempotencyKey" + unique index "Order_idempotencyKey_key" in place.'
        : `MISMATCH — column: ${col.length}, index: ${idx.length}`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error('FAILED:', (e as { code?: string }).code ?? '', (e as Error).message)
  process.exit(1)
})
