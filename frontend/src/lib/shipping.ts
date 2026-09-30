/** Store delivery rates in whole NGN, reviewed 2026-09-29. Domestic Nigeria is
 * priced per state on the KTI Logistics interstate card — one flat fee per
 * order (the card covers a 0.5–2.5kg parcel; the studio settles any overweight
 * surcharge with the courier). International ships DHL Express, priced on
 * chargeable weight with every piece capped into the 0–2kg band (KG_PER_PIECE).
 * Rates are the studio's courier cards, not live quotes. Keep
 * backend/lib/shipping.ts and frontend/src/lib/shipping.ts identical: each
 * service deploys independently. See scripts/check-shipping.cjs. */
export type ShippingMethod = 'local' | 'nationwide' | 'international'

/** Chargeable weight per piece — each product is billed within the 0–2kg band. */
export const KG_PER_PIECE = 2

/** DHL Express International eta, after dispatch from the atelier. */
const DHL_ETA = '3–7 business days'

/** DHL rate-card weight caps (kg), aligned index-for-index with zone ladders. */
const DHL_WEIGHT_CAPS = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10] as const

export interface DhlZone {
  id: string
  label: string
  countries: readonly string[]
  /** Rate per weight cap: index 0 = 0–2kg … last = 9.5–10kg. */
  ladder: readonly number[]
  /** Rate per kg past 10kg, added to the 10kg rate. */
  above10PerKg: number
}

/** DHL Express zones (updated rate card). The last entry is the rest-of-world
 * fallback for destinations outside the card — it prices on the Zone 3 ladder
 * and the studio confirms the courier per order. */
export const DHL_ZONES: readonly DhlZone[] = [
  {
    id: 'dhl-1',
    label: 'Zone 1 — United Kingdom & Ireland',
    countries: ['United Kingdom', 'Ireland'],
    ladder: [75000, 98000, 105000, 121500, 130000, 143500, 150000, 170000, 186800, 206000, 226000, 253000],
    above10PerKg: 24000,
  },
  {
    id: 'dhl-2',
    label: 'Zone 2 — Benin, Ghana, Gambia, Sierra Leone, Togo, Liberia, Mali, Niger & Cameroon',
    countries: ['Benin', 'Ghana', 'Gambia', 'Sierra Leone', 'Togo', 'Liberia', 'Mali', 'Niger', 'Cameroon'],
    ladder: [78000, 102000, 110800, 117500, 128000, 142500, 156000, 174000, 197000, 220000, 242000, 267000],
    above10PerKg: 25000,
  },
  {
    id: 'dhl-3',
    label: 'Zone 3 — USA, Canada & Mexico',
    countries: ['United States', 'Canada', 'Mexico'],
    ladder: [90000, 120000, 140000, 158000, 170000, 179500, 198800, 227000, 259800, 285000, 315000, 342000],
    above10PerKg: 33000,
  },
  {
    id: 'dhl-4',
    label: 'Zone 4 — Germany, Belgium, Italy, Sweden, France, Netherlands, Switzerland, Malta, Iceland, Luxembourg, Turkey, Finland & Spain',
    countries: ['Germany', 'Belgium', 'Italy', 'Sweden', 'France', 'Netherlands', 'Switzerland', 'Malta', 'Iceland', 'Luxembourg', 'Turkey', 'Finland', 'Spain'],
    ladder: [95000, 123500, 145000, 155000, 174500, 180000, 197000, 228000, 255000, 283800, 325000, 375000],
    above10PerKg: 35000,
  },
  {
    id: 'dhl-5',
    label: 'Zone 5 — South Africa, Tanzania, Uganda, Egypt, Mauritania, Algeria, Rwanda, Namibia & Botswana',
    countries: ['South Africa', 'Tanzania', 'Uganda', 'Egypt', 'Mauritania', 'Algeria', 'Rwanda', 'Namibia', 'Botswana'],
    ladder: [98000, 125000, 148000, 160000, 175800, 185000, 200000, 238500, 270000, 297000, 335000, 375000],
    above10PerKg: 35500,
  },
  {
    id: 'dhl-6',
    label: 'Zone 6 — UAE, Saudi Arabia, Lebanon, Bahrain, Israel, Oman, Jordan & Syria',
    countries: ['United Arab Emirates', 'Saudi Arabia', 'Lebanon', 'Bahrain', 'Israel', 'Oman', 'Jordan', 'Syria'],
    ladder: [200000, 230000, 250000, 274000, 286500, 289800, 305000, 358000, 390000, 425000, 455000, 492000],
    above10PerKg: 57000,
  },
  {
    id: 'dhl-7',
    label: 'Zone 7 — India, Singapore, Thailand, Philippines, Malaysia, Pakistan, Maldives, Georgia, Hong Kong, Japan & Vietnam',
    countries: ['India', 'Singapore', 'Thailand', 'Philippines', 'Malaysia', 'Pakistan', 'Maldives', 'Georgia', 'Hong Kong', 'Japan', 'Vietnam'],
    ladder: [115000, 135000, 157000, 173800, 188000, 195000, 210000, 240000, 298000, 334000, 369000, 406000],
    above10PerKg: 38500,
  },
  {
    id: 'dhl-8',
    label: 'Zone 8 — Australia, Caribbean & South America',
    countries: ['Australia', 'Trinidad and Tobago', 'Grenada', 'Jamaica', 'Saint Lucia', 'Uruguay', 'Guyana', 'New Zealand', 'Saint Kitts and Nevis', 'French Guiana', 'Dominica', 'Barbados'],
    ladder: [121800, 165000, 178000, 190800, 207500, 230000, 250000, 305000, 355000, 395000, 441000, 511000],
    above10PerKg: 48000,
  },
  {
    id: 'dhl-worldwide',
    label: 'Rest of the world',
    countries: [],
    ladder: [90000, 120000, 140000, 158000, 170000, 179500, 198800, 227000, 259800, 285000, 315000, 342000],
    above10PerKg: 33000,
  },
]

/** Zone for a destination country — every country is orderable; destinations
 * outside the DHL card fall back to the rest-of-world zone (last in the list). */
export function dhlZoneFor(country: string): DhlZone {
  return DHL_ZONES.find((z) => z.countries.includes(country)) ?? DHL_ZONES[DHL_ZONES.length - 1]
}

/** DHL rate for a shipment of `weightKg` — bracketed up to 10kg, then the 10kg
 * rate plus the per-kg rate for every started kilogram past 10kg. */
export function dhlRate(zone: DhlZone, weightKg: number): number {
  const bracket = DHL_WEIGHT_CAPS.findIndex((cap) => weightKg <= cap)
  if (bracket !== -1) return zone.ladder[bracket]
  const overKg = Math.ceil(weightKg - 10)
  return zone.ladder[zone.ladder.length - 1] + overKg * zone.above10PerKg
}

/** A delivery zone resolved from the address. `price` is the domestic flat fee
 * or the single-piece DHL rate — use zonePrice() for a multi-piece parcel. */
export interface DeliveryZone {
  id: string
  label: string
  method: ShippingMethod
  eta: string
  price: number
  /** Present on international zones — the DHL rate card this destination prices on. */
  dhl?: DhlZone
}

/** Domestic flat zones + one entry per DHL zone (single-piece rate as `price`).
 * The four interstate bands mirror the KTI card: West ₦7,500; the South-East,
 * South-South, Kwara, Abuja FCT and Kano tier ₦10,000; Benue ₦10,500; and the
 * rest of the card ₦12,500. Lagos is not on the KTI card — the studio runs it
 * locally: ₦6,000 to the Island, ₦7,000 to the Mainland. The card photo cuts
 * the North-East off after Gombe; Adamawa, Bauchi, Borno, Taraba and Yobe are
 * banded with Gombe at ₦12,500 pending the full card. */
export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  { id: 'lagos-island', label: 'Lagos — Island', price: 6000, eta: '1–3 business days', method: 'local' },
  { id: 'lagos-mainland', label: 'Lagos — Mainland', price: 7000, eta: '1–3 business days', method: 'local' },
  { id: 'ng-west', label: 'Ogun, Oyo, Osun, Ondo and Ekiti', price: 7500, eta: '3–5 business days', method: 'nationwide' },
  { id: 'ng-base', label: 'South-East, South-South, Kwara, FCT — Abuja and Kano', price: 10000, eta: '3–5 business days', method: 'nationwide' },
  { id: 'ng-benue', label: 'Benue', price: 10500, eta: '3–5 business days', method: 'nationwide' },
  { id: 'ng-far', label: 'Rest of Nigeria', price: 12500, eta: '5–7 business days', method: 'nationwide' },
  ...DHL_ZONES.map((dhl) => ({
    id: dhl.id,
    label: dhl.label,
    method: 'international' as const,
    eta: DHL_ETA,
    price: dhl.ladder[0],
    dhl,
  })),
]

/** Delivery zone id per Nigerian province — keys mirror geo.ts NG_PROVINCES
 * exactly. Lagos splits into Island and Mainland for the studio's local run;
 * every other state prices on its KTI interstate band. */
const NG_STATE_BANDS: Readonly<Record<string, string>> = {
  // Lagos (studio-local run)
  'Lagos — Island': 'lagos-island', 'Lagos — Mainland': 'lagos-mainland',
  // West
  Ogun: 'ng-west', Oyo: 'ng-west', Osun: 'ng-west', Ondo: 'ng-west', Ekiti: 'ng-west',
  // East & South-South
  Abia: 'ng-base', Anambra: 'ng-base', Ebonyi: 'ng-base', Enugu: 'ng-base', Imo: 'ng-base',
  'Akwa Ibom': 'ng-base', 'Cross River': 'ng-base', Bayelsa: 'ng-base', Delta: 'ng-base',
  Edo: 'ng-base', Rivers: 'ng-base',
  // North Central
  Kwara: 'ng-base', 'FCT — Abuja': 'ng-base', Benue: 'ng-benue', Kogi: 'ng-far',
  Nasarawa: 'ng-far', Niger: 'ng-far', Plateau: 'ng-far',
  // North West
  Kano: 'ng-base', Jigawa: 'ng-far', Kaduna: 'ng-far', Katsina: 'ng-far', Kebbi: 'ng-far',
  Sokoto: 'ng-far', Zamfara: 'ng-far',
  // North East — cut off after Gombe on the card photo, banded with Gombe
  Gombe: 'ng-far', Adamawa: 'ng-far', Bauchi: 'ng-far', Borno: 'ng-far', Taraba: 'ng-far',
  Yobe: 'ng-far',
}

export function deliveryZone(country: string, state: string): DeliveryZone | null {
  if (country === 'Nigeria') {
    const band = NG_STATE_BANDS[state]
    if (!band) return null
    return { ...DELIVERY_ZONES.find(z => z.id === band)!, label: state }
  }
  const dhl = dhlZoneFor(country)
  return { id: dhl.id, label: dhl.label, method: 'international', eta: DHL_ETA, price: dhl.ladder[0], dhl }
}

/** Delivery fee for a parcel of `pieces` product units. Domestic stays a flat
 * per-order fee; international prices on chargeable weight — every piece
 * counts as up to KG_PER_PIECE kg on the destination's DHL card. */
export function zonePrice(zone: DeliveryZone | null, pieces: number): number {
  if (!zone) return 0
  if (zone.method !== 'international' || !zone.dhl) return zone.price
  return dhlRate(zone.dhl, Math.max(1, pieces) * KG_PER_PIECE)
}

export function shippingError(country: string, state: string, method: ShippingMethod): string | null {
  const zone = deliveryZone(country, state)
  if (!zone) return country === 'Nigeria' ? 'Select a valid Nigerian state.' : 'Contact the studio for a delivery quote to this destination before ordering.'
  if (zone.method !== method) return 'The delivery method does not match your destination. Please review your address.'
  return null
}
export const SHIPPING_METHODS = {
  local: { label: 'Lagos Delivery', eta: '1–3 business days', note: 'Flat rate within Lagos — island or mainland.' },
  nationwide: { label: 'Nationwide Delivery', eta: '3–7 business days', note: 'Flat rate by destination state.' },
  international: { label: 'DHL Express International', eta: DHL_ETA, note: 'Priced by destination and parcel weight — each piece counts as up to 2kg. A DHL tracking number is issued once payment is confirmed. Import duties and taxes are paid by the recipient.' },
} as const
