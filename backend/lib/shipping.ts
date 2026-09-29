/** Store flat rates in whole NGN, reviewed 2026-09-29. Small apparel parcel estimates,
 * not live courier quotes. Keep backend/lib/shipping.ts and frontend/src/lib/shipping.ts
 * identical: each service deploys independently. See scripts/check-shipping.cjs. */
export type ShippingMethod = 'local' | 'nationwide' | 'international'
export const DELIVERY_ZONES = [
  { id: 'lagos', label: 'Lagos', price: 5000, eta: '1–3 business days', method: 'local' },
  { id: 'southwest', label: 'Ogun, Oyo, Osun, Ondo and Ekiti', price: 8000, eta: '2–5 business days', method: 'nationwide' },
  { id: 'nigeria', label: 'Rest of Nigeria', price: 12500, eta: '3–7 business days', method: 'nationwide' },
  { id: 'west-africa', label: 'Ghana, Côte d’Ivoire, Senegal and Cameroon', price: 35000, eta: '7–15 business days', method: 'international' },
  { id: 'africa', label: 'Kenya and South Africa', price: 50000, eta: '7–15 business days', method: 'international' },
  { id: 'uk', label: 'United Kingdom', price: 55000, eta: '10–15 business days', method: 'international' },
  { id: 'europe', label: 'Europe and Middle East', price: 65000, eta: '7–15 business days', method: 'international' },
  { id: 'north-america', label: 'United States and Canada', price: 75000, eta: '7–15 business days', method: 'international' },
  { id: 'other', label: 'Asia, Oceania, Brazil and Mexico', price: 85000, eta: '10–20 business days', method: 'international' },
] as const
const states = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT — Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara']
const southwest = ['Ogun','Oyo','Osun','Ondo','Ekiti']
const international: Record<string, string[]> = {
  'west-africa': ['Ghana','Côte d’Ivoire','Senegal','Cameroon'],
  africa: ['Kenya','South Africa'], uk: ['United Kingdom'],
  europe: ['Ireland','France','Germany','Netherlands','Belgium','Spain','Italy','Portugal','Switzerland','Sweden','Norway','Denmark','Finland','Austria','Poland','United Arab Emirates','Saudi Arabia','Qatar','Turkey'],
  'north-america': ['United States','Canada'],
  other: ['China','India','Japan','Australia','New Zealand','Brazil','Mexico'],
}
export function deliveryZone(country: string, state: string) {
  if (country === 'Nigeria') {
    if (!states.includes(state)) return null
    return DELIVERY_ZONES.find(z => z.id === (state === 'Lagos' ? 'lagos' : southwest.includes(state) ? 'southwest' : 'nigeria'))!
  }
  const id = Object.keys(international).find(key => international[key].includes(country))
  return DELIVERY_ZONES.find(z => z.id === id) ?? null
}
export function shippingError(country: string, state: string, method: ShippingMethod): string | null {
  const zone = deliveryZone(country, state)
  if (!zone) return country === 'Nigeria' ? 'Select a valid Nigerian state.' : 'Contact the studio for a delivery quote to this destination before ordering.'
  if (zone.method !== method) return 'The delivery method does not match your destination. Please review your address.'
  return null
}
export const SHIPPING_METHODS = {
  local: { label: 'Lagos Delivery', eta: '1–3 business days', note: 'Flat rate within Lagos.' },
  nationwide: { label: 'Nationwide Delivery', eta: '2–7 business days', note: 'Flat rate by destination state.' },
  international: { label: 'International Delivery', eta: '7–20 business days', note: 'Flat rate by destination country. Import duties and taxes are paid by the recipient.' },
} as const
