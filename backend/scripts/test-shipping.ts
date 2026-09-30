/**
 * Unit test for the DHL Express shipping card — every zone's 0–2kg rate, the
 * bracket math across parcel sizes, >10kg per-kg pricing, and the country →
 * zone mapping. Run: npx tsx scripts/test-shipping.ts
 */
import {
  DELIVERY_ZONES,
  DHL_ZONES,
  KG_PER_PIECE,
  deliveryZone,
  dhlRate,
  dhlZoneFor,
  zonePrice,
} from '../lib/shipping'

let failures = 0
function check(ok: boolean, label: string, got?: unknown, expected?: unknown) {
  if (!ok) {
    failures++
    console.log(`FAIL ${label}${got !== undefined ? ` — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}` : ''}`)
  }
}

// ——— the card: every zone's ladder spot-checked against the reviewed table ———
const CARD: Record<string, { base: number; four: number; six: number; eight: number; ten: number; perKg: number }> = {
  'dhl-1': { base: 75000, four: 130000, six: 170000, eight: 206000, ten: 253000, perKg: 24000 },
  'dhl-2': { base: 78000, four: 128000, six: 174000, eight: 220000, ten: 267000, perKg: 25000 },
  'dhl-3': { base: 90000, four: 170000, six: 227000, eight: 285000, ten: 342000, perKg: 33000 },
  'dhl-4': { base: 95000, four: 174500, six: 228000, eight: 283800, ten: 375000, perKg: 35000 },
  'dhl-5': { base: 98000, four: 175800, six: 238500, eight: 297000, ten: 375000, perKg: 35500 },
  'dhl-6': { base: 200000, four: 286500, six: 358000, eight: 425000, ten: 492000, perKg: 57000 },
  'dhl-7': { base: 115000, four: 188000, six: 240000, eight: 334000, ten: 406000, perKg: 38500 },
  'dhl-8': { base: 121800, four: 207500, six: 305000, eight: 395000, ten: 511000, perKg: 48000 },
  'dhl-worldwide': { base: 90000, four: 170000, six: 227000, eight: 285000, ten: 342000, perKg: 33000 },
}
for (const zone of DHL_ZONES) {
  const card = CARD[zone.id]
  check(!!card, `zone ${zone.id} present in test card`)
  if (!card) continue
  const idx: Record<number, number> = { 1: 0, 2: 4, 3: 7, 4: 9, 5: 11 }
  for (const [pieces, ladderIdx] of Object.entries(idx)) {
    check(
      zonePrice({ ...deliveryZoneForTest(zone.id) }, Number(pieces)) === zone.ladder[ladderIdx],
      `${zone.id} ${pieces}-piece rate matches ladder row`,
    )
  }
  check(zone.ladder[0] === card.base, `${zone.id} 0–2kg rate`, zone.ladder[0], card.base)
  check(zone.above10PerKg === card.perKg, `${zone.id} above-10kg per-kg rate`, zone.above10PerKg, card.perKg)
}

// ——— bracket math incl. the >10kg per-kg tail ———
const z1 = dhlZoneFor('United Kingdom')
check(dhlRate(z1, 2) === 75000, 'Z1 weight 2kg → 0–2kg rate')
check(dhlRate(z1, 4) === 130000, 'Z1 weight 4kg → 4kg rate')
check(dhlRate(z1, 6) === 170000, 'Z1 weight 6kg → 5.5–6kg rate')
check(dhlRate(z1, 10) === 253000, 'Z1 weight 10kg → 9.5–10kg rate')
check(dhlRate(z1, 12) === 253000 + 2 * 24000, 'Z1 weight 12kg → 10kg + 2×per-kg', dhlRate(z1, 12))
check(dhlRate(z1, 10.5) === 253000 + 24000, 'Z1 10.5kg bills one started kg over')

// ——— country → zone mapping (names must match the checkout geo list) ———
const MAP: [string, string][] = [
  ['United Kingdom', 'dhl-1'], ['Ireland', 'dhl-1'],
  ['Ghana', 'dhl-2'], ['Cameroon', 'dhl-2'], ['Sierra Leone', 'dhl-2'], ['Benin', 'dhl-2'],
  ['United States', 'dhl-3'], ['Canada', 'dhl-3'], ['Mexico', 'dhl-3'],
  ['Germany', 'dhl-4'], ['France', 'dhl-4'], ['Spain', 'dhl-4'], ['Turkey', 'dhl-4'], ['Iceland', 'dhl-4'], ['Luxembourg', 'dhl-4'],
  ['South Africa', 'dhl-5'], ['Egypt', 'dhl-5'], ['Rwanda', 'dhl-5'], ['Botswana', 'dhl-5'],
  ['United Arab Emirates', 'dhl-6'], ['Saudi Arabia', 'dhl-6'], ['Israel', 'dhl-6'],
  ['India', 'dhl-7'], ['Japan', 'dhl-7'], ['Philippines', 'dhl-7'], ['Vietnam', 'dhl-7'],
  ['Australia', 'dhl-8'], ['New Zealand', 'dhl-8'], ['Jamaica', 'dhl-8'], ['Saint Kitts and Nevis', 'dhl-8'],
  ['China', 'dhl-worldwide'], ['Brazil', 'dhl-worldwide'], ['Kenya', 'dhl-worldwide'], ['Portugal', 'dhl-worldwide'],
]
for (const [country, zoneId] of MAP) {
  check(dhlZoneFor(country).id === zoneId, `${country} maps to ${zoneId}`, dhlZoneFor(country).id)
}

// ——— deliveryZone + zonePrice end-to-end ———
const uk = deliveryZone('United Kingdom', 'London')
check(uk?.method === 'international' && uk.dhl !== undefined, 'UK resolves to an international DHL zone')
check(zonePrice(uk, 1) === 75000, 'UK 1 piece = ₦75,000')
check(zonePrice(uk, 3) === 170000, 'UK 3 pieces (6kg) = ₦170,000')
const lagosIsland = deliveryZone('Nigeria', 'Lagos — Island')
check(lagosIsland?.method === 'local' && zonePrice(lagosIsland, 5) === 6000, 'Lagos Island stays flat ₦6,000 regardless of pieces', lagosIsland && zonePrice(lagosIsland, 5))
const lagosMainland = deliveryZone('Nigeria', 'Lagos — Mainland')
check(lagosMainland?.method === 'local' && zonePrice(lagosMainland, 5) === 7000, 'Lagos Mainland stays flat ₦7,000 regardless of pieces', lagosMainland && zonePrice(lagosMainland, 5))
check(deliveryZone('Nigeria', 'Lagos') === null, 'bare "Lagos" is no longer a selectable province')

// ——— Nigeria: per-state KTI interstate card (every band + boundary states) ———
const NG_CARD: [string, number][] = [
  ['Ogun', 7500], ['Ekiti', 7500],
  ['Abia', 10000], ['Rivers', 10000], ['Edo', 10000], ['Kwara', 10000],
  ['FCT — Abuja', 10000], ['Kano', 10000],
  ['Benue', 10500],
  ['Kogi', 12500], ['Kaduna', 12500], ['Sokoto', 12500], ['Gombe', 12500], ['Borno', 12500],
]
for (const [st, fee] of NG_CARD) {
  const z = deliveryZone('Nigeria', st)
  check(z?.method === 'nationwide' && zonePrice(z, 3) === fee, `${st} prices flat at ₦${fee.toLocaleString()}`, z && zonePrice(z, 3), fee)
  check(z?.label === st, `${st} zone labels with the state name`, z?.label, st)
}
check(DELIVERY_ZONES.filter((z) => z.method === 'nationwide').length === 4, 'four KTI interstate bands')
check(deliveryZone('Nigeria', 'Not a State') === null, 'invalid Nigerian state rejected')
check(zonePrice(null, 3) === 0, 'null zone prices 0')
check(KG_PER_PIECE === 2, 'each piece capped at 2kg')
check(DELIVERY_ZONES.filter((z) => z.method === 'international').length === DHL_ZONES.length, 'one delivery zone per DHL zone')

/** Test helper — the international DeliveryZone a country in `zoneId` resolves to. */
function deliveryZoneForTest(zoneId: string) {
  const country =
    DHL_ZONES.find((z) => z.id === zoneId)?.countries[0] ??
    (zoneId === 'dhl-worldwide' ? 'China' : undefined)
  if (!country) throw new Error(`no country for ${zoneId}`)
  return deliveryZone(country, '')!
}

if (failures > 0) {
  console.log(`\n${failures} CHECK(S) FAILED`)
  process.exit(1)
}
console.log('ALL SHIPPING CHECKS PASSED')
