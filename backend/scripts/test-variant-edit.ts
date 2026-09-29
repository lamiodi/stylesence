/**
 * E2E test for the full variant-set PATCH (throwaway inactive product).
 * Run: npx tsx scripts/test-variant-edit.ts  — server must be on :3001.
 */
const BASE = 'http://localhost:3001'
let cookie = ''

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const json = (await res.json().catch(() => ({}))) as Record<string, any>
  return { status: res.status, json }
}

const EMAIL = 'owner@stylesence.example'
// Dev-seed password first; override with ADMIN_TEST_PASSWORD when rotated.
const PASSWORDS = [process.env.ADMIN_TEST_PASSWORD, 'stylesence-dev-2026'].filter(
  (p): p is string => typeof p === 'string' && p.length > 0,
)

async function main() {
let login: { status: number; json: Record<string, any> } = { status: 0, json: {} }
for (const pw of PASSWORDS) {
  login = await api('POST', '/api/admin/login', { email: EMAIL, password: pw })
  if (login.status === 200) break
}
if (login.status !== 200) {
  console.log('FAIL: login →', login.status, JSON.stringify(login.json))
  process.exit(1)
}
console.log('✓ login ok')

// 1. Create throwaway product (inactive — never visible on the storefront).
const create = await api('POST', '/api/admin/products', {  name: 'ZZ Variant Edit E2E (auto-cleanup)',
  description: 'Temporary test piece — deleted by the test run.',
  price: 1000,
  isActive: false,
  images: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.png', alt: 'test' }],
  variants: [
    { size: 'S', color: 'Ivory', colorHex: '#EDE7DC', stock: 0 },
    { size: 'M', color: 'Ivory', colorHex: '#EDE7DC', stock: 4 },
    { size: 'L', color: 'Old Rose', colorHex: '#C97B6B', stock: 2 },
  ],
})
if (create.status !== 201) {
  console.log('FAIL: create →', create.status, JSON.stringify(create.json))
  process.exit(1)
}
const product = create.json.product
const id = product.id as string
const v0 = product.variants[0] // S/Ivory stock 0
const v1 = product.variants[1] // M/Ivory
const v2 = product.variants[2] // L/Old Rose (to be removed)
console.log(`✓ created ${product.slug} with ${product.variants.length} variants`)

try {
  // 2. Full-set edit: rename v0 colour + restock 0→3, keep v1 as-is, drop v2, add two new rows.
  const patch = await api('PATCH', `/api/admin/products/${id}`, {
    variants: [
      { id: v0.id, size: 'S', color: 'Ecru', colorHex: '#E8E0D2', stock: 3 },
      { id: v1.id, size: 'M', color: 'Ivory', colorHex: '#EDE7DC', stock: 4 },
      { size: 'XL', color: 'Charcoal', colorHex: '#3B3A37', stock: 6 },
      { size: 'XXL', color: 'Ecru', stock: 1 }, // no hex → default
    ],
  })
  if (patch.status !== 200) {
    console.log('FAIL: patch variants →', patch.status, JSON.stringify(patch.json))
    process.exit(1)
  }
  const variants: any[] = patch.json.product.variants
  const byKey = Object.fromEntries(variants.map((v) => [`${v.size}|${v.color}`, v]))
  const checks: [boolean, string][] = [
    [variants.length === 4, `expected 4 variants, got ${variants.length}`],
    [byKey['S|Ecru']?.id === v0.id, 'kept row should retain its id'],
    [byKey['S|Ecru']?.colorHex === '#E8E0D2', 'kept row colourHex should update'],
    [!variants.some((v) => v.id === v2.id), 'dropped row (L/Old Rose) should be deleted'],
    [Boolean(byKey['XL|Charcoal']?.sku?.startsWith('SS-')), 'new row should get an SS- SKU'],
    [byKey['XXL|Ecru']?.colorHex === '#EDE7DC', 'missing hex should default to ivory'],
    [patch.json.notifiedStockAlerts === 0, 'restock count with no waitlist should be 0'],
  ]
  const failed = checks.filter(([ok]) => !ok).map(([, msg]) => msg)
  if (failed.length) {
    console.log('FAIL: variant-set assertions →', failed.join('; '))
    console.log(JSON.stringify(variants, null, 2))
    process.exit(1)
  }
  console.log('✓ full variant-set edit: rename/keep/drop/add all correct')

  // 3. Guard: foreign variant id rejected.
  const foreign = await api('PATCH', `/api/admin/products/${id}`, {
    variants: [{ id: 'not-a-real-variant-id', size: 'S', color: 'X', stock: 1 }],
  })
  if (foreign.status !== 400) {
    console.log('FAIL: foreign variant id should 400 →', foreign.status)
    process.exit(1)
  }
  console.log('✓ foreign variant id rejected (400)')

  // 4. Guard: variants + variantStocks together rejected.
  const both = await api('PATCH', `/api/admin/products/${id}`, {
    variants: [{ size: 'S', color: 'Ecru', stock: 1 }],
    variantStocks: [{ id: v1.id, stock: 2 }],
  })
  if (both.status !== 400) {
    console.log('FAIL: variants+variantStocks should 400 →', both.status)
    process.exit(1)
  }
  console.log('✓ variants + variantStocks together rejected (400)')

  // 5. Legacy stock-only path still works.
  const legacy = await api('PATCH', `/api/admin/products/${id}`, {
    variantStocks: [{ id: v1.id, stock: 9 }],
  })
  if (legacy.status !== 200 || legacy.json.product.variants.find((v: any) => v.id === v1.id)?.stock !== 9) {
    console.log('FAIL: legacy variantStocks path →', legacy.status)
    process.exit(1)
  }
  console.log('✓ legacy variantStocks path intact')

  // 6. Empty set (delete every variant) is allowed by the API.
  const empty = await api('PATCH', `/api/admin/products/${id}`, { variants: [] })
  if (empty.status !== 200 || empty.json.product.variants.length !== 0) {
    console.log('FAIL: empty variant set →', empty.status)
    process.exit(1)
  }
  console.log('✓ empty variant set allowed server-side (UI enforces ≥1)')
} finally {
  const del = await api('DELETE', `/api/admin/products/${id}`)
  console.log(del.status === 200 ? '✓ throwaway product deleted' : `WARN: cleanup delete → ${del.status}`)
}
console.log('ALL E2E CHECKS PASSED')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
