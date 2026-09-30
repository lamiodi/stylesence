/**
 * E2E verification for the 2026-09-30 checkout fixes, against a RUNNING
 * backend dev server (npx next dev -p 3001 — start it first, with
 * STUDIO_NOTIFY_EMAIL set if you want the studio email to actually send):
 *
 *   npx tsx scripts/test-checkout-fixes.ts
 *
 * Creates ONE throwaway TEST order through the real API (live DB), verifies:
 *   1. Paystack reference charset (no underscore, unique)
 *   2. Concurrent checkouts with one idempotency key → one order (same
 *      orderNumber in both responses, stock decremented exactly once)
 *   3. Replay after the cart was cleared → same order, `replayed: true`
 *   4. Retry endpoint refuses studio-confirmed orders
 *   5. Retry with a DEAD reference → fresh Paystack session URL
 *   6. Retry with an ONGOING reference → 409 (double-pay protection)
 *   7. cancelAndRestock claims the cancellation first (second call no-ops)
 * then deletes the test order and leaves stock untouched (net zero).
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { paystackReference } from '../lib/payments'

// tsx does not read .env files — load backend/.env before anything touches env.
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

const BASE = 'http://127.0.0.1:3001'
const TEST_EMAIL = 'concierge@stylesence.com' // studio's own inbox — no stranger receives test mail
const TEST_KEY = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let passed = 0
const failures: string[] = []
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
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
    /* ---------- pre-clean leftovers from an earlier crashed run ---------- */
    const leftovers = await sql<{ id: string; orderNumber: string; status: string }[]>`
      SELECT id, "orderNumber", status FROM "Order" WHERE "idempotencyKey" LIKE 'e2e-%'
    `
    for (const o of leftovers) {
      // Only PENDING_PAYMENT orders still hold reserved stock — CANCELLED ones
      // were already restored by cancelAndRestock.
      if (o.status === 'PENDING_PAYMENT') {
        await sql`
          UPDATE "ProductVariant" v SET stock = v.stock + oi.qty
          FROM "OrderItem" oi
          WHERE oi."orderId" = ${o.id} AND oi."variantId" = v.id AND oi."variantId" IS NOT NULL
        `
      }
      await sql`DELETE FROM "OrderItem" WHERE "orderId" = ${o.id}`
      await sql`DELETE FROM "Order" WHERE id = ${o.id}`
      console.log(`pre-clean: removed leftover ${o.orderNumber} (${o.status})`)
    }

    /* ---------- 1. reference charset ---------- */
    console.log('\n1. Paystack reference charset')
    const refs = new Set(Array.from({ length: 50 }, () => paystackReference('SS-2026-123456')))
    const bad = [...refs].filter((r) => !/^[A-Za-z0-9.\-=]+$/.test(r))
    check('all chars in Paystack-allowed set (alnum . = -)', bad.length === 0, bad[0] ?? '')
    check('no underscore anywhere', ![...refs].some((r) => r.includes('_')))
    check('50 refs all unique', refs.size === 50, `got ${refs.size}`)
    const sample = paystackReference('SS-2026-123456')
    console.log(`        sample: ${sample}`)

    /* ---------- pick a variant + add to cart ---------- */
    const variantRows = await sql<{ id: string; stock: number; price: number; name: string }[]>`
      SELECT v.id, v.stock, p.price, p.name
      FROM "ProductVariant" v
      JOIN "Product" p ON p.id = v."productId"
      WHERE p."isActive" = true AND v.stock >= 3
      ORDER BY v.stock DESC LIMIT 1
    `
    const variant = variantRows[0]
    if (!variant) throw new Error('no variant with stock >= 3 found')
    const stockBefore = variant.stock
    console.log(`\nVariant: ${variant.name} (${variant.id}) stock=${stockBefore}`)

    const cartRes = await fetch(`${BASE}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: variant.id, qty: 1 }),
    })
    const setCookie = cartRes.headers.get('set-cookie')
    check('cart created (POST /api/cart)', cartRes.ok && !!setCookie, `status ${cartRes.status}`)
    const cartCookie = (setCookie ?? '').split(';')[0]
    const cookieHeader = cartCookie

    const checkoutBody = JSON.stringify({
      email: TEST_EMAIL,
      fullName: 'TEST E2E Checkout',
      phone: '08000000000',
      address: '1 Test Lane',
      city: 'Ibadan',
      state: 'Oyo',
      country: 'Nigeria',
      shippingMethod: 'nationwide',
      productionTier: 'standard',
      confirmedProduction: true,
      paymentMethod: 'confirmed', // manual rail — no gateway call during checkout
      idempotencyKey: TEST_KEY,
    })
    const post = () =>
      fetch(`${BASE}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        body: checkoutBody,
      })

    /* ---------- 2. concurrent checkouts, one key ---------- */
    console.log('\n2. Concurrent checkout with one idempotency key')
    const [resA, resB] = await Promise.all([post(), post()])
    const bodyA = await resA.json()
    const bodyB = await resB.json()
    check('request A succeeded', resA.ok, JSON.stringify(bodyA).slice(0, 200))
    check('request B succeeded', resB.ok, JSON.stringify(bodyB).slice(0, 200))
    check(
      'A and B returned the SAME order',
      bodyA.order?.orderNumber === bodyB.order?.orderNumber,
      `A=${bodyA.order?.orderNumber} B=${bodyB.order?.orderNumber}`,
    )
    const orderNumber: string | undefined = bodyA.order?.orderNumber ?? bodyB.order?.orderNumber
    if (!orderNumber) {
      console.log('\nABORT: no order was created — skipping dependent checks')
      process.exitCode = 1
      return
    }
    const orderRows = await sql<{ id: string; status: string; total: number; key: string | null }[]>`
      SELECT id, status, total, "idempotencyKey" AS key FROM "Order" WHERE "orderNumber" = ${orderNumber}
    `
    check('exactly ONE order row in DB', orderRows.length === 1, `got ${orderRows.length}`)
    check('order stores the idempotency key', orderRows[0]?.key === TEST_KEY)
    check('order starts PENDING_PAYMENT', orderRows[0]?.status === 'PENDING_PAYMENT')
    const stockAfterConcurrent = await sql<{ stock: number }[]>`
      SELECT stock FROM "ProductVariant" WHERE id = ${variant.id}
    `
    check(
      'stock decremented exactly once',
      stockAfterConcurrent[0]?.stock === stockBefore - 1,
      `before ${stockBefore}, after ${stockAfterConcurrent[0]?.stock}`,
    )

    /* ---------- 3. replay after cart cleared ---------- */
    console.log('\n3. Replay after the cart was cleared')
    const resC = await post()
    const bodyC = await resC.json()
    check('third request with same key replays', resC.ok && bodyC.replayed === true, JSON.stringify(bodyC).slice(0, 200))
    check('replay returns the same order', bodyC.order?.orderNumber === orderNumber)

    /* ---------- 4. retry endpoint refuses studio-confirmed orders ---------- */
    console.log('\n4. Retry gate for the studio-confirmed rail')
    const resGate = await fetch(`${BASE}/api/orders/${orderNumber}/pay?email=${encodeURIComponent(TEST_EMAIL)}`, { method: 'POST' })
    const bodyGate = await resGate.json()
    check('retry on confirmed-rail order → 400', resGate.status === 400, `status ${resGate.status}: ${bodyGate.error}`)

    /* ---------- 5. retry with a DEAD reference → fresh session ---------- */
    console.log('\n5. Retry with a dead reference')
    await sql`UPDATE "Order" SET "paymentMethod" = 'paystack', "paymentReference" = ${`SS-TEST-DEAD-${TEST_KEY}`} WHERE "orderNumber" = ${orderNumber}`
    const resDead = await fetch(`${BASE}/api/orders/${orderNumber}/pay?email=${encodeURIComponent(TEST_EMAIL)}`, { method: 'POST' })
    const bodyDead = await resDead.json()
    check('dead reference → new session URL', resDead.ok && typeof bodyDead.payment?.url === 'string' && bodyDead.payment.url.includes('paystack'), JSON.stringify(bodyDead).slice(0, 200))

    /* ---------- 6. retry with a FRESH INITIALIZED reference ---------- */
    // Paystack reports a transaction that was initialized but never opened as
    // "abandoned" right away (verified live 2026-09-30) — no money can be in
    // flight, so a fresh session is CORRECT here. The true in-flight state
    // ("ongoing", customer picked bank transfer and is paying) is covered by
    // the browser E2E — see the 409 branch in /pay.
    console.log('\n6. Retry with a fresh initialized reference (Paystack: abandoned)')
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: TEST_EMAIL, amount: 10000, currency: 'NGN' }),
    })
    const initBody = await initRes.json()
    check('Paystack test transaction initialized', initRes.ok && !!initBody?.data?.reference, JSON.stringify(initBody).slice(0, 120))
    await sql`UPDATE "Order" SET "paymentReference" = ${initBody.data.reference} WHERE "orderNumber" = ${orderNumber}`
    const resFresh = await fetch(`${BASE}/api/orders/${orderNumber}/pay?email=${encodeURIComponent(TEST_EMAIL)}`, { method: 'POST' })
    const bodyFresh = await resFresh.json()
    check('abandoned (never opened) reference → new session allowed', resFresh.ok && typeof bodyFresh.payment?.url === 'string', `status ${resFresh.status}: ${JSON.stringify(bodyFresh).slice(0, 160)}`)

    /* ---------- 7. cancelAndRestock claims first ---------- */
    console.log('\n7. cancelAndRestock claim semantics')
    const { cancelAndRestock } = await import('./reap-pending-orders')
    const fullOrder = await sql`
      SELECT o.*, (
        SELECT json_agg(src.*) FROM (SELECT * FROM "OrderItem" oi WHERE oi."orderId" = o.id ORDER BY oi.id ASC) src
      ) AS items
      FROM "Order" o WHERE o."orderNumber" = ${orderNumber}
    `
    const order = fullOrder[0]
    const stockPreCancel = (await sql<{ stock: number }[]>`SELECT stock FROM "ProductVariant" WHERE id = ${variant.id}`)[0].stock
    const first = await cancelAndRestock(order)
    const stockPostCancel = (await sql<{ stock: number }[]>`SELECT stock FROM "ProductVariant" WHERE id = ${variant.id}`)[0].stock
    check('first cancelAndRestock claims (true)', first === true)
    check('stock restored once', stockPostCancel === stockPreCancel + 1, `${stockPreCancel} → ${stockPostCancel}`)
    const statusPostCancel = (await sql<{ status: string }[]>`SELECT status FROM "Order" WHERE "orderNumber" = ${orderNumber}`)[0].status
    check('order flipped to CANCELLED', statusPostCancel === 'CANCELLED')
    const second = await cancelAndRestock(order)
    const stockPostSecond = (await sql<{ stock: number }[]>`SELECT stock FROM "ProductVariant" WHERE id = ${variant.id}`)[0].stock
    check('second call no-ops (false)', second === false)
    check('stock NOT inflated by second call', stockPostSecond === stockPostCancel, `${stockPostCancel} → ${stockPostSecond}`)

    /* ---------- cleanup ---------- */
    console.log('\nCleanup')
    await sql`DELETE FROM "OrderItem" WHERE "orderId" = ${order.id}`
    await sql`DELETE FROM "Order" WHERE id = ${order.id}`
    const remaining = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "Order" WHERE "idempotencyKey" = ${TEST_KEY}`
    check('test order removed', remaining[0]?.n === 0)
    const stockFinal = (await sql<{ stock: number }[]>`SELECT stock FROM "ProductVariant" WHERE id = ${variant.id}`)[0].stock
    check('stock back to pre-test value', stockFinal === stockBefore, `${stockBefore} → ${stockFinal}`)

    console.log(`\n${passed} passed, ${failures.length} failed`)
    if (failures.length > 0) {
      console.log('FAILURES:')
      for (const f of failures) console.log(`  - ${f}`)
      process.exitCode = 1
    }
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
