/**
 * Style Sence by SKR — database seed.
 * Run: bun scripts/seed.ts
 * Idempotent: wipes and re-creates all data.
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// Deterministic PRNG so seeds are stable
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260113)
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const between = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const daysAgo = (d: number, jitterHours = true) =>
  new Date(Date.now() - d * 86400000 - (jitterHours ? between(0, 20) * 3600000 : 0))

type ColorDef = { name: string; hex: string }
const IVORY: ColorDef = { name: 'Ivory', hex: '#EDE7DC' }
const CHARCOAL: ColorDef = { name: 'Charcoal', hex: '#35322D' }
const ESPRESSO: ColorDef = { name: 'Espresso', hex: '#4B3A32' }
const OAT: ColorDef = { name: 'Oat', hex: '#D9D2C4' }
const CHAMPAGNE: ColorDef = { name: 'Champagne', hex: '#D8CBB2' }
const TAUPE: ColorDef = { name: 'Taupe', hex: '#8A7B6C' }
const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL']
const ONE_SIZE = ['One Size']

type SeedProduct = {
  slug: string
  name: string
  subtitle: string
  description: string
  details: string[]
  material: string
  care: string
  price: number
  compareAtPrice?: number
  category: string
  colors: ColorDef[]
  sizes: string[]
  featured?: boolean
  ageDays: number
  detailImage?: boolean
  lowStock?: { color: string; size: string; stock: number }[]
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'silk-slip-dress',
    name: 'The Ivory Silk Slip Dress',
    subtitle: 'Bias-cut sandwashed silk',
    description:
      'The dress that started the house. Cut on the bias from sandwashed silk in our signature ivory, it falls in a fluid column that moves with you — quiet by day, decisive by night.\n\nA sculpted neckline and French seams keep the line clean; the adjustable straps let you set the exact drop. Sized generously through the hip so the silk can skim, not cling.',
    details: [
      'Bias-cut sandwashed silk, 19mm',
      'Adjustable straps with covered sliders',
      'French seams throughout',
      'Falls to ankle bone at 170cm',
      'Made in small batches at our Lagos atelier partner',
    ],
    material: '100% mulberry silk, sandwashed finish',
    care: 'Dry clean recommended. Alternatively: hand wash cold, roll in a towel, dry flat away from direct sun.',
    price: 148000,
    compareAtPrice: 175000,
    category: 'dresses',
    colors: [IVORY, CHARCOAL],
    sizes: APPAREL_SIZES,
    featured: true,
    ageDays: 6,
    detailImage: true,
    lowStock: [{ color: 'Ivory', size: 'XS', stock: 2 }],
  },
  {
    slug: 'wool-column-dress',
    name: 'Charcoal Wool Column Dress',
    subtitle: 'Structured double-face wool',
    description:
      'A column with a spine. Double-face wool holds the shoulder and releases at the waist, ending in a straight hem that photographs like architecture.\n\nConcealed closures and a full ivory lining mean nothing interrupts the silhouette.',
    details: [
      'Double-face Italian wool',
      'Concealed back closure',
      'Fully lined in ivory cupro',
      'Straight column hem, mid-calf',
    ],
    material: '96% virgin wool, 4% elastane; cupro lining',
    care: 'Dry clean only. Steam to release creases.',
    price: 132000,
    category: 'dresses',
    colors: [CHARCOAL, ESPRESSO],
    sizes: APPAREL_SIZES,
    ageDays: 25,
  },
  {
    slug: 'bias-satin-gown',
    name: 'Bias-Cut Satin Gown',
    subtitle: 'Full-length liquid satin',
    description:
      'Our evening statement, poured rather than sewn. Heavyweight satin is cut on the bias so the gown takes its shape from the body beneath it — one seam at the back, nothing else.\n\nChampagne reads warm ivory under candlelight; Ivory reads porcelain under daylight.',
    details: [
      'Heavyweight bias-cut satin',
      'Single back seam construction',
      'Cowl back with weighted drape',
      'Floor length',
    ],
    material: '82% triacetate, 18% polyester satin',
    care: 'Dry clean only. Store on a padded hanger.',
    price: 185000,
    category: 'dresses',
    colors: [CHAMPAGNE, IVORY],
    sizes: APPAREL_SIZES,
    ageDays: 12,
  },
  {
    slug: 'cashmere-crewneck',
    name: 'Relaxed Cashmere Crewneck',
    subtitle: 'Grade-A Mongolian cashmere',
    description:
      'The sweater you will reach for first, every autumn, for a decade. Two-ply Grade-A cashmere knitted at a low gauge so it sits soft and substantial on the shoulder.\n\nRibbed at the cuff and hem to hold shape through seasons of wear.',
    details: [
      'Two-ply Grade-A Mongolian cashmere',
      '7-gauge relaxed knit',
      'Ribbed cuffs and hem',
      'Slight drop shoulder',
    ],
    material: '100% cashmere',
    care: 'Hand wash cold with cashmere shampoo; dry flat. Store folded, never hung.',
    price: 96000,
    category: 'knitwear',
    colors: [IVORY, CHARCOAL, OAT],
    sizes: APPAREL_SIZES,
    featured: true,
    ageDays: 4,
    detailImage: true,
    lowStock: [{ color: 'Oat', size: 'M', stock: 3 }],
  },
  {
    slug: 'merino-turtleneck',
    name: 'Sculpted Merino Turtleneck',
    subtitle: 'Fine-gauge extrafine merino',
    description:
      'A turtleneck with posture. Extrafine merino knitted to a sculpted fit that layers under tailoring without a wrinkle, or stands alone with everything tucked in.\n\nThe neck is double-folded and hand-linked so it stands, softly.',
    details: [
      'Extrafine 19.5-micron merino',
      'Sculpted fit, fine 14-gauge',
      'Double-fold hand-linked neck',
      'Machine washable wool cycle',
    ],
    material: '100% extrafine merino wool',
    care: 'Machine wash cold on wool cycle; dry flat.',
    price: 68000,
    category: 'knitwear',
    colors: [CHARCOAL, IVORY],
    sizes: APPAREL_SIZES,
    ageDays: 18,
  },
  {
    slug: 'knitted-column-skirt',
    name: 'Knitted Column Skirt',
    subtitle: 'Ribbed merino pencil',
    description:
      'The pencil skirt, re-knit. Ribbed merino traces the line of the body and stops mid-calf — pair with the turtleneck for the house uniform.\n\nElasticised interior waist so the rib never pulls.',
    details: [
      'Ribbed extrafine merino',
      'Interior elastic waistband',
      'Mid-calf column length',
      'Back vent for stride',
    ],
    material: '100% extrafine merino wool',
    care: 'Hand wash cold; dry flat.',
    price: 74000,
    category: 'knitwear',
    colors: [CHARCOAL, OAT],
    sizes: APPAREL_SIZES,
    ageDays: 9,
  },
  {
    slug: 'atelier-blazer',
    name: 'The Atelier Blazer',
    subtitle: 'Soft-shoulder tailored wool',
    description:
      'Two years in development. A soft-shoulder blazer with a hand-padded chest, one-button closure and a lapel rolled by hand — sharp enough for the boardroom, soft enough for dinner.\n\nCut with a slightly longer body and single back vent, in charcoal or ivory.',
    details: [
      'Hand-padded chest and lapel',
      'One-button closure, horn button',
      'Single back vent',
      'Bemberg cupro lining',
      'Made in small batches',
    ],
    material: '98% virgin wool, 2% elastane',
    care: 'Dry clean only. Brush after wear; rest 24h between rotations.',
    price: 165000,
    compareAtPrice: 190000,
    category: 'ready-to-wear',
    colors: [CHARCOAL, IVORY],
    sizes: APPAREL_SIZES,
    featured: true,
    ageDays: 2,
    detailImage: true,
    lowStock: [{ color: 'Charcoal', size: 'L', stock: 1 }],
  },
  {
    slug: 'pleated-midi-skirt',
    name: 'Pleated Midi Skirt',
    subtitle: 'Sunray-pleated technical crepe',
    description:
      'Sunray pleats that swing from a flat waistband — the skirt moves like silk but travels like crepe. Hem falls mid-calf and holds its pleat through rain and luggage.\n\nWaistband sits at the natural waist.',
    details: [
      'Sunray pleating, heat-set',
      'Flat bonded waistband',
      'Hidden side zip',
      'Machine washable',
    ],
    material: '100% recycled polyester crepe',
    care: 'Machine wash cold on delicate; hang to dry. Do not iron pleats.',
    price: 82000,
    category: 'ready-to-wear',
    colors: [IVORY, ESPRESSO],
    sizes: APPAREL_SIZES,
    ageDays: 15,
  },
  {
    slug: 'wide-leg-trouser',
    name: 'Wide-Leg Trouser',
    subtitle: 'High-waist fluid drape',
    description:
      'High on the waist, wide to the floor. Our trouser is drafted with a long rise and a leg that breaks just once, over a heel or a flat — your choice.\n\nSide pockets sit flat; centre crease is permanent.',
    details: [
      'High waist, wide leg',
      'Hidden hook-and-bar closure',
      'On-seam side pockets',
      'Permanent centre crease',
    ],
    material: '68% viscose, 29% polyamide, 3% elastane',
    care: 'Dry clean recommended; steam to refresh.',
    price: 89000,
    category: 'ready-to-wear',
    colors: [CHARCOAL, OAT],
    sizes: APPAREL_SIZES,
    ageDays: 21,
  },
  {
    slug: 'poplin-shirt',
    name: 'Organic Poplin Shirt',
    subtitle: 'Crisp organic cotton',
    description:
      'The white shirt, reconsidered in organic cotton poplin with a collar engineered to stand on its own.\n\nSlightly sheer in Ivory; wear it buttoned to the throat or thrown over a slip.',
    details: [
      'GOTS-certified organic cotton poplin',
      'Self-standing collar',
      'Mother-of-pearl buttons',
      'Curved shirttail hem',
    ],
    material: '100% organic cotton',
    care: 'Machine wash warm; iron damp for a pressed finish.',
    price: 62000,
    category: 'ready-to-wear',
    colors: [{ name: 'Ivory', hex: '#F0EBE2' }, CHARCOAL],
    sizes: APPAREL_SIZES,
    ageDays: 30,
  },
  {
    slug: 'longline-wool-coat',
    name: 'Longline Wool Coat',
    subtitle: 'Double-faced cashmere-wool',
    description:
      'A coat to disappear into. Double-faced cashmere-wool, unlined and hand-stitched at every seam, cut long to mid-shin with a concealed placket — nothing but cloth and line.\n\nTaupe for daylight, Charcoal for night.',
    details: [
      'Double-faced cashmere-wool, hand-stitched',
      'Concealed placket',
      'Unlined, raw-edge interior',
      'Mid-shin length',
      'Interior pocket',
    ],
    material: '80% wool, 20% cashmere',
    care: 'Dry clean only. Store on a broad hanger in the garment bag provided.',
    price: 245000,
    compareAtPrice: 280000,
    category: 'outerwear',
    colors: [TAUPE, CHARCOAL],
    sizes: APPAREL_SIZES,
    featured: true,
    ageDays: 11,
  },
  {
    slug: 'quilted-linen-jacket',
    name: 'Quilted Linen Jacket',
    subtitle: 'Diamond-quilted by hand',
    description:
      'Our light outer layer for Harmattan mornings. Diamond-quilted linen over a thin cotton batting — warmth without weight, structure without stiffness.\n\nCollar flips and buttons high when the wind changes.',
    details: [
      'Diamond-quilted European linen',
      'Cotton batting interlayer',
      'Flip collar with throat latch',
      'Welt hand pockets',
    ],
    material: '100% linen shell; cotton batting',
    care: 'Machine wash cold on delicate; line dry. Softens with every wash.',
    price: 128000,
    category: 'outerwear',
    colors: [IVORY],
    sizes: APPAREL_SIZES,
    ageDays: 20,
  },
  {
    slug: 'cashmere-ribbed-scarf',
    name: 'Cashmere Ribbed Scarf',
    subtitle: 'Two-metre brushed wrap',
    description:
      'Two metres of brushed cashmere in a wide rib — the width of a collar, the length of a proper wrap.\n\nEspresso against ivory knit; ivory against everything.',
    details: ['Two-metre length, 45cm width', 'Wide 2x2 rib, brushed finish', 'Hand-knotted fringe'],
    material: '100% cashmere',
    care: 'Dry clean or hand wash cold; dry flat.',
    price: 46000,
    category: 'accessories',
    colors: [ESPRESSO, IVORY, CHARCOAL],
    sizes: ONE_SIZE,
    ageDays: 8,
  },
  {
    slug: 'leather-mini-tote',
    name: 'Leather Mini Tote',
    subtitle: 'Vegetable-tanned calfskin',
    description:
      'A tote scaled down to the essentials — phone, keys, a paperback, the silk dress you are picking up. Vegetable-tanned calfskin that burnishes with use.\n\nCarried by hand or on the crook of the arm.',
    details: [
      'Vegetable-tanned calfskin',
      'Suede-lined interior',
      'Interior slip pocket',
      'Hand-burnished edges',
    ],
    material: 'Calfskin leather; suede lining',
    care: 'Wipe with a dry cloth; condition twice a year. Dev-Note: hardware is polished brass.',
    price: 115000,
    compareAtPrice: 130000,
    category: 'accessories',
    colors: [{ name: 'Charcoal', hex: '#2E2B27' }, ESPRESSO],
    sizes: ONE_SIZE,
    featured: true,
    ageDays: 5,
    lowStock: [{ color: 'Charcoal', size: 'One Size', stock: 0 }],
  },
]

const REVIEWS: { slug: string; author: string; rating: number; title: string; body: string; ageDays: number; status: string }[] = [
  { slug: 'silk-slip-dress', author: 'Adaeze O.', rating: 5, title: 'It moves like water', body: 'Wore this to a gallery opening and three strangers asked where it was from. The bias cut skims instead of clinging — worth every naira.', ageDays: 4, status: 'APPROVED' },
  { slug: 'silk-slip-dress', author: 'Funmi A.', rating: 4, title: 'Beautiful, size up', body: 'The silk is substantial, not see-through. I would size up if you are between sizes — the hip is cut close.', ageDays: 2, status: 'APPROVED' },
  { slug: 'silk-slip-dress', author: 'Ijeoma N.', rating: 5, title: 'The one', body: 'Bought in ivory first, came back for charcoal within the week. The straps adjust enough to wear a proper bra.', ageDays: 1, status: 'PENDING' },
  { slug: 'cashmere-crewneck', author: 'Chiamaka E.', rating: 5, title: 'Softest thing I own', body: 'Two years of promises from other brands and this is the first crewneck that actually delivers. The ivory is a true warm ivory, not white.', ageDays: 3, status: 'APPROVED' },
  { slug: 'cashmere-crewneck', author: 'Yinka B.', rating: 4, title: 'Relaxed indeed', body: 'Size down if you want structure — I kept my usual size for the oversized look. Zero pilling after a month of near-daily wear.', ageDays: 2, status: 'APPROVED' },
  { slug: 'atelier-blazer', author: 'Ngozi U.', rating: 5, title: 'Boardroom to dinner', body: 'The shoulder is soft but the lapel holds. Charcoal with the wide-leg trouser is my uniform now. The tailoring is honestly European-standard.', ageDays: 2, status: 'APPROVED' },
  { slug: 'atelier-blazer', author: 'Temi O.', rating: 5, title: 'Worth the wait', body: 'Pre-ordered and it arrived beautifully finished. Hand-padded chest is not marketing — you feel the difference the moment you put it on.', ageDays: 1, status: 'PENDING' },
  { slug: 'longline-wool-coat', author: 'Amara I.', rating: 5, title: 'Disappeared into it', body: 'Taupe in daylight is gorgeous. Hand-stitched seams inside and out. Size as-is — the coat is cut to layer over knitwear.', ageDays: 8, status: 'APPROVED' },
  { slug: 'longline-wool-coat', author: 'Sade K.', rating: 4, title: 'Luxury weight', body: 'Heavier than expected — this is a real winter coat. Only note: dry cleaning a coat this long costs a bit more.', ageDays: 5, status: 'APPROVED' },
  { slug: 'leather-mini-tote', author: 'Zainab M.', rating: 5, title: 'Burnishes beautifully', body: 'The charcoal leather has already started taking on a patina at the handles. Fits exactly: phone, cardholder, keys, one paperback.', ageDays: 4, status: 'APPROVED' },
  { slug: 'leather-mini-tote', author: 'Bisi T.', rating: 4, title: 'Mini is mini', body: 'Read the dimensions — this is deliberately small. Perfect as the evening bag that is also a day bag. Brass hardware is a lovely muted gold.', ageDays: 3, status: 'APPROVED' },
  { slug: 'bias-satin-gown', author: 'Ify D.', rating: 5, title: 'Poured, not sewn', body: 'Champagne under warm light is unreal. The single back seam means there is nothing to adjust — it just falls right.', ageDays: 9, status: 'APPROVED' },
  { slug: 'bias-satin-gown', author: 'Ronke S.', rating: 4, title: 'Handle with care', body: 'Gorgeous but the satin shows water spots — keep it away from rain. Steams back to life in minutes.', ageDays: 6, status: 'APPROVED' },
  { slug: 'merino-turtleneck', author: 'Halima Y.', rating: 5, title: 'Stands on its own', body: 'The neck actually holds without strangling. Washed twice on wool cycle with zero distortion.', ageDays: 15, status: 'APPROVED' },
  { slug: 'wide-leg-trouser', author: 'Ella C.', rating: 4, title: 'Needs a heel', body: 'The break is long — with flats I needed a hem adjustment at my tailor. With heels, perfect.', ageDays: 12, status: 'APPROVED' },
  { slug: 'wide-leg-trouser', author: 'Kemi J.', rating: 5, title: 'Fluid not stiff', body: 'The drape on these is something else — moves like a skirt, reads like tailoring. Ordered the oat as well.', ageDays: 10, status: 'APPROVED' },
  { slug: 'pleated-midi-skirt', author: 'Tochi A.', rating: 5, title: 'Traveled perfectly', body: 'Took it to Abuja rolled in a case — pleats survived intact. The waistband genuinely does not gap.', ageDays: 11, status: 'APPROVED' },
  { slug: 'poplin-shirt', author: 'Dami F.', rating: 4, title: 'Collar of the year', body: 'The collar stands exactly as pictured. Slightly sheer in ivory — a cami underneath and you are set.', ageDays: 20, status: 'APPROVED' },
  { slug: 'knitted-column-skirt', author: 'Ada N.', rating: 5, title: 'The uniform bottom', body: 'With the turtleneck it is the silhouette of the season. The rib has real recovery — no bagging at the hip after a full day sitting.', ageDays: 7, status: 'APPROVED' },
  { slug: 'wool-column-dress', author: 'Rita E.', rating: 5, title: 'Architecture', body: 'It photographs like a building. Lining is silky and the concealed closure is genuinely invisible.', ageDays: 18, status: 'APPROVED' },
  { slug: 'quilted-linen-jacket', author: 'Nneka V.', rating: 4, title: 'Harmattan hero', body: 'Light but surprisingly warm in the morning chill. The ivory picks up Harmattan dust — keep the brush handy. Softening nicely with washes.', ageDays: 14, status: 'APPROVED' },
  { slug: 'cashmere-ribbed-scarf', author: 'Maya O.', rating: 5, title: 'Gift-worthy', body: 'Bought espresso for my mother and ivory for myself. Wide enough to double as a travel wrap.', ageDays: 6, status: 'APPROVED' },
  { slug: 'cashmere-ribbed-scarf', author: 'Gloria A.', rating: 4, title: 'Lovely, shed a little', body: 'A hint of shedding the first week, none since. The rib is dense and the fringe is properly knotted.', ageDays: 3, status: 'APPROVED' },
  { slug: 'merino-turtleneck', author: 'Zara L.', rating: 3, title: 'Good but slim', body: 'Quality merino, no complaints there. If you are fuller-bust, size up — the sculpted fit is very fitted.', ageDays: 9, status: 'APPROVED' },
  { slug: 'atelier-blazer', author: 'Guest', rating: 5, title: 'Third purchase', body: 'House quality is consistent. Ivory blazer over the champagne gown for a wedding — endless compliments.', ageDays: 3, status: 'PENDING' },
  { slug: 'poplin-shirt', author: 'Guest', rating: 2, title: 'Buttons loosened', body: 'Two buttons needed re-securing after three wears. Otherwise lovely cloth. Awaiting reply from client care.', ageDays: 1, status: 'PENDING' },
]

const JOURNAL = [
  {
    slug: 'the-ivory-edit',
    title: 'The Ivory Edit: Building a Considered Wardrobe',
    category: 'Styling',
    excerpt: 'Fifteen pieces, one palette, no regrets. Our creative director on starting from ivory and building outward.',
    readTime: 6,
    coverImage: '/images/journal/j1.png',
    body: `## Start from ivory

Every wardrobe we admire begins with a single decision, and ours is ivory. Not white — white is an absence. Ivory is a presence: warm, tolerant of other colours, forgiving of wear. It is the ground everything else is drawn on.

When we open consultations at the atelier, we begin by emptying the wardrobe onto a bed and sorting for tone. Almost always, the pieces that survive are the quiet ones — the ivory poplin, the oat cashmere, the charcoal wool. Everything that shouts leaves first.

## Fifteen pieces, no regrets

The Edit is fifteen pieces: five knits, three dresses, two trousers, one skirt, one coat, one jacket, two accessories. It fits in a single suitcase and dresses a full season of life — office, opening, wedding, Sunday.

The trick is that every piece speaks to every other. The column skirt pulls under the blazer. The slip dress layers over the turtleneck in December and stands alone in March. Nothing is orphaned; nothing waits for the "right occasion" that never arrives.

## Buy once, at the right weight

We say it in the lookbook and we will say it here: weight is quality you can feel before you can name. A good knit has heft. A good coat has a long, clean break at the back of the knee. Hold a garment up to the light — the ones worth keeping are the ones that hold their opacity, their shape, their nerve.

## On colour discipline

Charcoal is not black. Black is a wall; charcoal is a room. It reflects a little light back onto the face, which is why our tailoring is cut in charcoal rather than the more severe alternative. Between ivory and charcoal there is a whole quiet country — oat, taupe, espresso, champagne — and that is where the house lives.

## The last word

A considered wardrobe is not a small wardrobe; it is an intentional one. Buy the silk dress you will mend, not the trend you will forget. Keep the palette honest. Let the clothes do the talking, slowly, for years.`,
  },
  {
    slug: 'atelier-notes-volume-02',
    title: 'Atelier Notes — Volume 02',
    category: 'Craft',
    excerpt: 'Inside the workshop: hand-padded lapels, French seams, and why a blazer takes two years to design.',
    readTime: 8,
    coverImage: '/images/journal/j2.png',
    body: `## Two years for a shoulder

The Atelier Blazer started as a sketch in a Lagos notebook and did not reach the rail for two years. The shoulder alone went through eleven muslins. A shoulder must do one impossible thing: be soft enough to move and firm enough to mean it.

Machines can pad a chest. We do not let them. A hand-padded lapel rolls — there is no other word — into a curve that follows the collarbone. You can feel the difference with your eyes closed.

## French seams, everywhere

A French seam encloses the raw edge of the cloth inside itself, so the inside of the garment is as finished as the outside. On the slip dress there are no linings to hide behind — only silk, folded twice on itself, pressed open, and sewn again.

It is slower by half. It is also the reason a bias-cut dress survives its tenth wear.

## Small batches, on purpose

We cut in small batches — never more than the atelier can finish well in a week. When a batch sells out, we cut again only if the cloth still meets the mill specification. Sometimes the mill changes and the colour is retired rather than compromised. Our customers write in and complain. We take it as a compliment to their eyes.

## The pressing room

Half of tailoring is pressing that nobody sees. A wool coat is pressed into its shape at least nine times between cloth and rail. The iron is the needle's quiet partner; it is where stiffness is removed and line is set.

## Notes to the next volume

Volume 03 will cover our mills and the dye houses; we are auditing two in Como this quarter. We will publish what we find, including the failures. Honesty is the only quality control that compounds.`,
  },
  {
    slug: 'on-charcoal',
    title: 'On Charcoal: A Study in Depth',
    category: 'Essays',
    excerpt: 'Why the house cuts its tailoring in charcoal — a short meditation on light, wool, and the colour black refuses to be.',
    readTime: 5,
    coverImage: '/images/journal/j3.png',
    body: `## Black is a wall

Black is definitive. Black is also, under fluorescent office light, flat. It gives the face nothing to work with. We stopped cutting tailoring in black years ago and never missed it.

## Charcoal is a room

Charcoal keeps a little light in reserve. Brushed wool in charcoal holds a faint sheen that moves as you move — depth, not drama. Under daylight it reads warm; under evening light it reads severe only if you want it to.

## The palette around it

Charcoal married to ivory is the oldest contract in modern dress — ask any photograph from the nineteen-fifties. Around that contract we have built a small country of neutrals: oat for daylight, espresso for leather, taupe for coats, champagne for evening.

## On wearing it

Charcoal tailoring wants ivory or nothing beneath it. A poplin shirt with the collar standing. A silk slip in the same family, one tone off. The mistake is contrast — a bright thing under charcoal collapses the whole quiet argument.

## In conclusion

Dress in rooms, not walls. Keep a light in reserve. Let them wonder, quietly, where the depth comes from.`,
  },
]

const ORDER_NAMES = [
  ['Adaeze Okonkwo', 'adaeze.o@example.com'], ['Funmi Adeyemi', 'funmi.a@example.com'],
  ['Chiamaka Eze', 'chiamaka.e@example.com'], ['Ngozi Umeh', 'ngozi.u@example.com'],
  ['Temi Olawuyi', 'temi.o@example.com'], ['Yinka Balogun', 'yinka.b@example.com'],
  ['Sade Kuti', 'sade.k@example.com'], ['Amara Igwe', 'amara.i@example.com'],
  ['Zainab Mohammed', 'zainab.m@example.com'], ['Bisi Tinubu', 'bisi.t@example.com'],
  ['Ify Diokno', 'ify.d@example.com'], ['Ronke Salami', 'ronke.s@example.com'],
  ['Halima Yusuf', 'halima.y@example.com'], ['Ella Cole', 'ella.c@example.com'],
  ['Kemi Johnson', 'kemi.j@example.com'], ['Tochi Anyanwu', 'tochi.a@example.com'],
  ['Dami Fashola', 'dami.f@example.com'], ['Maya Obi', 'maya.o@example.com'],
  ['Claire Bennett', 'claire.b@example.com'], ['Sofia Lindgren', 'sofia.l@example.com'],
]
const ORDER_CITIES: [string, string][] = [
  ['Lagos', 'Lagos'], ['Abuja', 'FCT'], ['Port Harcourt', 'Rivers'], ['Ibadan', 'Oyo'],
  ['Enugu', 'Enugu'], ['Kano', 'Kano'], ['Uyo', 'Akwa Ibom'], ['Benin City', 'Edo'],
]
const STREETS = ['Adeola Odeku Street', 'Awolowo Road', 'Bishop Aboyade Cole Street', 'Kingsway Road', 'Ahmadu Bello Way', 'Glover Road', 'Ekukinam Street', 'Etim Inyang Crescent']

async function main() {
  console.log('Seeding Style Sence by SKR…')

  // wipe (FK order)
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.cartItem.deleteMany()
  await db.cart.deleteMany()
  await db.review.deleteMany()
  await db.productImage.deleteMany()
  await db.productVariant.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.adminSession.deleteMany()
  await db.adminUser.deleteMany()
  await db.newsletterSubscriber.deleteMany()
  await db.journalPost.deleteMany()

  // admin
  await db.adminUser.create({
    data: {
      email: 'owner@stylesence.example',
      name: 'SKR Studio',
      passwordHash: hashPassword('stylesence-dev-2026'),
      role: 'OWNER',
    },
  })
  console.log('✓ admin user (owner@stylesence.example / stylesence-dev-2026)')

  // categories
  const catData = [
    { slug: 'ready-to-wear', name: 'Ready-to-Wear', tagline: 'Tailoring and everyday structure', imageUrl: '/images/products/atelier-blazer.png' },
    { slug: 'dresses', name: 'Dresses', tagline: 'Columns, slips and gowns', imageUrl: '/images/products/silk-slip-dress.png' },
    { slug: 'knitwear', name: 'Knitwear', tagline: 'Cashmere and merino, quietly', imageUrl: '/images/products/cashmere-crewneck.png' },
    { slug: 'outerwear', name: 'Outerwear', tagline: 'Coats with a long line', imageUrl: '/images/products/longline-wool-coat.png' },
    { slug: 'accessories', name: 'Accessories', tagline: 'Leather, cashmere, brass', imageUrl: '/images/products/leather-mini-tote.png' },
  ]
  const cats: Record<string, string> = {}
  for (let i = 0; i < catData.length; i++) {
    const c = await db.category.create({ data: { ...catData[i], position: i } })
    cats[c.slug] = c.id
  }
  console.log('✓ 5 categories')

  // products
  const productIds: Record<string, string> = {}
  const variantIds: { id: string; productId: string; slug: string; price: number; color: string; size: string; image: string; name: string }[] = []
  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        details: p.details.join('\n'),
        material: p.material,
        care: p.care,
        price: p.price,
        compareAtPrice: p.compareAtPrice ?? null,
        categoryId: cats[p.category],
        isActive: true,
        isFeatured: !!p.featured,
        createdAt: daysAgo(p.ageDays),
      },
    })
    productIds[p.slug] = created.id

    const images = [{ url: `/images/products/${p.slug}.png`, alt: `${p.name} — ${p.subtitle}`, position: 0 }]
    if (p.detailImage) {
      images.push({ url: `/images/products/${p.slug}-detail.png`, alt: `${p.name} — detail`, position: 1 })
    }
    for (const img of images) {
      await db.productImage.create({ data: { productId: created.id, ...img } })
    }

    for (const color of p.colors) {
      for (const size of p.sizes) {
        let stock = between(4, 22)
        const low = p.lowStock?.find((l) => l.color === color.name && l.size === size)
        if (low) stock = low.stock
        const v = await db.productVariant.create({
          data: {
            productId: created.id,
            size,
            color: color.name,
            colorHex: color.hex,
            sku: `SS-${p.slug.slice(0, 6).toUpperCase()}-${color.name.slice(0, 2).toUpperCase()}-${size.replace(/\s/g, '')}-${between(10, 99)}`,
            stock,
          },
        })
        variantIds.push({ id: v.id, productId: created.id, slug: p.slug, price: p.price, color: color.name, size, image: images[0].url, name: p.name })
      }
    }
  }
  console.log(`✓ ${PRODUCTS.length} products, ${variantIds.length} variants`)

  // reviews
  for (const r of REVIEWS) {
    await db.review.create({
      data: {
        productId: productIds[r.slug],
        author: r.author,
        email: r.author.toLowerCase().replace(/[^a-z]/g, '') + '@example.com',
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: daysAgo(r.ageDays),
      },
    })
  }
  console.log(`✓ ${REVIEWS.length} reviews`)

  // journal
  for (let i = 0; i < JOURNAL.length; i++) {
    const j = JOURNAL[i]
    await db.journalPost.create({
      data: { slug: j.slug, title: j.title, excerpt: j.excerpt, body: j.body, category: j.category, coverImage: j.coverImage, readTime: j.readTime, isPublished: true, publishedAt: daysAgo(3 + i * 9) },
    })
  }
  console.log('✓ 3 journal posts')

  // newsletter subscribers
  for (const email of ['adaeze.o@example.com', 'funmi.a@example.com', 'ellac@example.com', 'sofia.l@example.com', 'kemi.j@example.com', 'dami.f@example.com']) {
    await db.newsletterSubscriber.create({ data: { email, source: 'footer' } })
  }
  console.log('✓ 6 subscribers')

  // orders — 48 across last 30 days
  let orderSeq = 1
  for (let i = 0; i < 48; i++) {
    const ageDays = Math.floor(rng() * 30)
    const [fullName, email] = pick(ORDER_NAMES)
    const [city, state] = pick(ORDER_CITIES)
    const address = `${between(2, 78)} ${pick(STREETS)}`
    const shippingMethod = rng() < 0.78 ? 'standard' : 'express'
    const shipping = shippingMethod === 'standard' ? 3500 : 7500

    let status: string
    if (ageDays > 8) status = rng() < 0.9 ? 'DELIVERED' : 'CANCELLED'
    else if (ageDays > 3) status = rng() < 0.5 ? 'SHIPPED' : 'PROCESSING'
    else status = rng() < 0.5 ? 'PAID' : 'PROCESSING'
    if (i === 0) status = 'PAID'
    if (i === 1) status = 'PROCESSING'
    if (i === 2) status = 'CANCELLED'

    const itemCount = rng() < 0.55 ? 1 : rng() < 0.8 ? 2 : 3
    const chosen = [...variantIds].sort(() => rng() - 0.5).slice(0, itemCount)
    const items = chosen.map((v) => ({ v, qty: rng() < 0.82 ? 1 : 2 }))
    const subtotal = items.reduce((s, it) => s + it.v.price * it.qty, 0)
    const total = status === 'CANCELLED' ? subtotal : subtotal + shipping

    const order = await db.order.create({
      data: {
        orderNumber: `SS-2026-${String(1000 + orderSeq++)}`,
        email,
        fullName,
        phone: `+234 8${between(0, 2)}${between(10000000, 99999999)}`,
        address,
        city,
        state,
        country: 'Nigeria',
        shippingMethod,
        shipping,
        subtotal,
        total,
        status,
        createdAt: daysAgo(ageDays),
      },
    })
    for (const it of items) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          variantId: it.v.id,
          productName: it.v.name,
          productSlug: it.v.slug,
          size: it.v.size,
          color: it.v.color,
          imageUrl: it.v.image,
          unitPrice: it.v.price,
          qty: it.qty,
        },
      })
    }
  }
  console.log('✓ 48 orders across 30 days')

  console.log('\nSeed complete ✔')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
