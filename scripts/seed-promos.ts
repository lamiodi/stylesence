/** Seed Style Sence promo codes — idempotent upserts. Run: bun scripts/seed-promos.ts */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const CODES = [
  {
    code: 'SS-FRIEND',
    label: 'Friends of the house — 10% off',
    type: 'PERCENT',
    value: 10,
    minSubtotal: 0,
    maxUsage: null as number | null,
  },
  {
    code: 'HARMATTAN-20',
    label: 'Harmattan edit — 20% off orders over ₦200,000',
    type: 'PERCENT',
    value: 20,
    minSubtotal: 200000,
    maxUsage: 100,
  },
  {
    code: 'ARCHIVE-15K',
    label: '₦15,000 archive credit over ₦150,000',
    type: 'AMOUNT',
    value: 15000,
    minSubtotal: 150000,
    maxUsage: null as number | null,
  },
  {
    code: 'SENCE-SHIP',
    label: 'Complimentary express shipping over ₦100,000',
    type: 'SHIPPING',
    value: 0,
    minSubtotal: 100000,
    maxUsage: null as number | null,
  },
  {
    code: 'SAMPLE-EXPIRED',
    label: 'Retired sample code',
    type: 'PERCENT',
    value: 30,
    minSubtotal: 0,
    maxUsage: null as number | null,
    isActive: false,
    expiresAt: new Date(Date.now() - 14 * 86400000),
  },
]

async function main() {
  for (const c of CODES) {
    await db.promoCode.upsert({
      where: { code: c.code },
      create: c,
      update: {
        label: c.label,
        type: c.type,
        value: c.value,
        minSubtotal: c.minSubtotal,
        maxUsage: c.maxUsage,
        isActive: c.isActive ?? true,
        expiresAt: c.expiresAt ?? null,
      },
    })
    console.log(`✓ ${c.code}`)
  }
  console.log('Promo codes seeded ✔')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
