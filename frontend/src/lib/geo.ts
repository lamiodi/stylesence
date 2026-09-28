/**
 * Checkout geography — countries with first-level subdivisions (states /
 * provinces / regions / emirates) for the countries we actually ship to.
 * Countries without a subdivision list fall back to a free-text field.
 *
 * PAYSTACK_COUNTRIES are the African markets paid via Paystack; every other
 * country pays via Stripe (international cards). Mirrors the backend.
 */

export interface CountryEntry {
  name: string
  /** ISO 3166-1 alpha-2 — used for autocomplete + gateway metadata. */
  code: string
  /** States/provinces; when absent the checkout shows a free-text field. */
  provinces?: string[]
  /** Dial code for the phone field hint. */
  dial: string
}

export const PAYSTACK_COUNTRIES = ['Nigeria', 'Ghana', 'South Africa', 'Kenya'] as const

/** Nigeria — all 36 states + FCT (Abuja). */
const NG_PROVINCES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT — Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
]

const US_PROVINCES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
  'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
]

export const COUNTRIES: CountryEntry[] = [
  // — West Africa first: the home market and neighbours —
  { name: 'Nigeria', code: 'NG', dial: '+234', provinces: NG_PROVINCES },
  { name: 'Ghana', code: 'GH', dial: '+233', provinces: [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra',
    'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta',
    'Western', 'Western North',
  ] },
  { name: 'Côte d’Ivoire', code: 'CI', dial: '+225' },
  { name: 'Senegal', code: 'SN', dial: '+221' },
  { name: 'Cameroon', code: 'CM', dial: '+237' },
  // — Paystack markets —
  { name: 'South Africa', code: 'ZA', dial: '+27', provinces: [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape',
  ] },
  { name: 'Kenya', code: 'KE', dial: '+254', provinces: [
    'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa',
    'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
    'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos',
    'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi',
    'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya',
    'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
    'Vihiga', 'Wajir', 'West Pokot',
  ] },
  // — Diaspora & key international markets —
  { name: 'United Kingdom', code: 'GB', dial: '+44', provinces: [
    'England', 'Scotland', 'Wales', 'Northern Ireland',
  ] },
  { name: 'United States', code: 'US', dial: '+1', provinces: US_PROVINCES },
  { name: 'Canada', code: 'CA', dial: '+1', provinces: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon',
  ] },
  { name: 'Ireland', code: 'IE', dial: '+353' },
  { name: 'France', code: 'FR', dial: '+33' },
  { name: 'Germany', code: 'DE', dial: '+49' },
  { name: 'Netherlands', code: 'NL', dial: '+31' },
  { name: 'Belgium', code: 'BE', dial: '+32' },
  { name: 'Spain', code: 'ES', dial: '+34' },
  { name: 'Italy', code: 'IT', dial: '+39' },
  { name: 'Portugal', code: 'PT', dial: '+351' },
  { name: 'Switzerland', code: 'CH', dial: '+41' },
  { name: 'Sweden', code: 'SE', dial: '+46' },
  { name: 'Norway', code: 'NO', dial: '+47' },
  { name: 'Denmark', code: 'DK', dial: '+45' },
  { name: 'Finland', code: 'FI', dial: '+358' },
  { name: 'Austria', code: 'AT', dial: '+43' },
  { name: 'Poland', code: 'PL', dial: '+48' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971', provinces: [
    'Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain',
  ] },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966' },
  { name: 'Qatar', code: 'QA', dial: '+974' },
  { name: 'Turkey', code: 'TR', dial: '+90' },
  { name: 'China', code: 'CN', dial: '+86' },
  { name: 'India', code: 'IN', dial: '+91' },
  { name: 'Japan', code: 'JP', dial: '+81' },
  { name: 'Australia', code: 'AU', dial: '+61', provinces: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
    'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ] },
  { name: 'New Zealand', code: 'NZ', dial: '+64' },
  { name: 'Brazil', code: 'BR', dial: '+55' },
  { name: 'Mexico', code: 'MX', dial: '+52' },
  { name: 'Other (tell us in notes)', code: 'XX', dial: '+' },
]

/** Provinces for a country, or null when the checkout should show free text. */
export function provincesFor(country: string): string[] | null {
  return COUNTRIES.find((c) => c.name === country)?.provinces ?? null
}

/** True when the country pays via Paystack (African markets). */
export function isPaystackCountry(country: string): boolean {
  return (PAYSTACK_COUNTRIES as readonly string[]).includes(country)
}

/** Country list for select inputs — Nigeria first. */
export const COUNTRY_NAMES = COUNTRIES.map((c) => c.name)

/** Dial hint for the phone field. */
export function dialFor(country: string): string {
  return COUNTRIES.find((c) => c.name === country)?.dial ?? '+'
}
