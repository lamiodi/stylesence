'use client'

/**
 * #/help — Client Care (shipping, returns, sizing, care, contact, FAQ).
 *
 * Sections deep-link via ?topic=shipping|returns|sizing|care|contact|faq.
 * The SPA shell remounts this page whenever the topic query changes (key
 * `help:${topic}`), so the topic is stable for the lifetime of one mount:
 * it is read once, the target section is scrolled to on mount, and the
 * highlight is a one-shot CSS exit animation — no state, no effects races.
 */

import { useEffect, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, navigate, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { Reveal } from '@/components/site/reveal'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/* ————————————————— topic model ————————————————— */

const TOPICS = [
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns' },
  { id: 'sizing', label: 'Sizing' },
  { id: 'care', label: 'Care' },
  { id: 'contact', label: 'Contact' },
  { id: 'faq', label: 'FAQ' },
] as const

type Topic = (typeof TOPICS)[number]['id']

const TOPIC_IDS: ReadonlySet<string> = new Set(TOPICS.map((t) => t.id))

function asTopic(value: string | null): Topic | null {
  return value && TOPIC_IDS.has(value) ? (value as Topic) : null
}

/* ————————————————— content ————————————————— */

const SHIPPING_ROWS = [
  {
    method: 'Standard Delivery',
    fee: 3_500,
    eta: '3–5 business days',
    note: 'Nationwide courier with tracking.',
  },
  {
    method: 'Express Delivery',
    fee: 7_500,
    eta: '1–2 business days',
    note: 'Lagos same-day dispatch before 11am.',
  },
] as const

const SHIPPING_FACTS: { label: string; body: ReactNode }[] = [
  {
    label: 'Complimentary shipping',
    body: (
      <>
        Standard delivery is on us on orders over {formatNaira(150_000)} — applied
        automatically at the bag.
      </>
    ),
  },
  { label: 'Dispatch days', body: 'Tuesday – Saturday, from the Ikoyi atelier.' },
  { label: 'Same-day Lagos', body: 'Express orders placed before 11am leave the atelier the same day.' },
]

const RETURN_TERMS = [
  { term: 'The window', detail: 'Fourteen days from delivery to begin a return or an exchange.' },
  { term: 'The condition', detail: 'Unworn and unwashed, with tags still attached, in the state it reached you.' },
  { term: 'The refund', detail: 'Issued to your original payment method, five to seven business days after inspection.' },
  { term: 'Size exchanges', detail: 'Subject to stock — batches are small, so we confirm availability before anything travels.' },
  { term: 'Archive pieces', detail: 'Archive-priced pieces are final sale; the cloth is ended and cannot be replaced.' },
] as const

const MEASUREMENTS = [
  { size: 'XS', bust: 82, waist: 64, hips: 90 },
  { size: 'S', bust: 87, waist: 69, hips: 95 },
  { size: 'M', bust: 92, waist: 74, hips: 100 },
  { size: 'L', bust: 97, waist: 79, hips: 105 },
  { size: 'XL', bust: 102, waist: 84, hips: 110 },
] as const

const MEASURE_STEPS = [
  { part: 'Bust', how: 'Around the fullest part, tape level under the arms.' },
  { part: 'Waist', how: 'At the natural crease that appears when you lean sideways.' },
  { part: 'Hips', how: 'Around the widest part, feet together.' },
] as const

const CARE_GUIDES = [
  {
    n: '01',
    title: 'Silk charmeuse',
    body: 'Dry clean, or a delicate hand wash in cold water with silk soap — never wrung. Hang to dry away from direct sun and steam gently on the reverse. Store on a padded hanger and creases fall out overnight on their own.',
  },
  {
    n: '02',
    title: 'Crepe-silk blends',
    body: 'The Camille sets take a gentle hand wash cold or dry cleaning. Hang to dry in the shade, warm-steam as needed, and the drape returns every time. Avoid the hot iron directly on the print.',
  },
  {
    n: '03',
    title: 'Aso Oke',
    body: 'Specialist dry clean only — the hand-woven cloth is never machine washed. Store flat or on a structured hanger, and let the weave rest between wears. Treated well, it outlives every trend it meets.',
  },
  {
    n: '04',
    title: 'Everything made to measure',
    body: 'Your piece is cut for one body — yours. Wash less, steam more, and bring it back to the studio for repairs; a garment made to order deserves a lifetime, not a season.',
  },
] as const

const FAQ_ITEMS: { q: string; a: ReactNode }[] = [
  {
    q: 'Which size should I order?',
    a: (
      <>
        <p>
          Match your measurements to the{' '}
          <Link to="/help?topic=sizing" className="link-underline text-foreground">
            sizing chart
          </Link>{' '}
          — or skip the chart entirely and order with your own measurements; every piece
          is cut to order, so exact numbers always win.
        </p>
        <p className="mt-3">
          Still unsure? Send your bust, waist and hip measurements to the studio on
          WhatsApp —{' '}
          <a href="https://wa.me/2348163022233" className="link-underline text-foreground">
            +234 816 302 2233
          </a>{' '}
          and we will advise honestly rather than upsell.
        </p>
      </>
    ),
  },
  {
    q: 'Will you restock a sold-out piece?',
    a: (
      <p>
        Rarely. Pieces are cut in small batches — never more than the atelier can finish
        well in a week — and when a cloth is genuinely ended, the colour is retired rather
        than compromised. Join The Sence Letter for first word of new cloth; subscribers
        hear before the shop does.
      </p>
    ),
  },
  {
    q: 'Do you offer promo codes?',
    a: (
      <p>
        Yes. <span className="font-mono text-espresso">SS-FRIEND</span> takes ten per cent
        off your first order and is live now — enter it at the bag before checkout. Further
        codes travel with The Sence Letter, never anywhere louder.
      </p>
    ),
  },
  {
    q: 'How do I track my order?',
    a: (
      <p>
        Your confirmation carries an order number in the SS-2026 series — keep it. Dispatch
        and delivery status live on the tracking page:{' '}
        <Link to="/track" className="link-underline text-foreground">
          track your order
        </Link>
        .
      </p>
    ),
  },
  {
    q: 'Can I include a gift note?',
    a: (
      <p>
        Yes. Write your message in the order notes at checkout and we will copy it out by
        hand on a house card before the parcel is sealed.
      </p>
    ),
  },
  {
    q: 'What payment methods do you accept?',
    a: (
      <div className="space-y-3">
        <p>
          Payment is confirmed with the studio after you place your order — bank transfer
          or a card link arrives with your confirmation, and production begins the moment
          payment lands.
        </p>
        <p className="text-sm text-muted-foreground">
          Prefer to pay before ordering, or need a quote first? WhatsApp the studio on
          +234 816 302 2233 and we will sort it in one conversation.
        </p>
      </div>
    ),
  },
  {
    q: 'Do you ship internationally?',
    a: (
      <div className="space-y-3">
        <p>Today we ship nationwide within Nigeria only — Standard and Express, as above.</p>
        <p className="text-sm text-muted-foreground">
          International delivery is in the works. If you are outside Nigeria, WhatsApp the
          studio on +234 816 302 2233 and we will arrange shipping and a quote manually.
        </p>
      </div>
    ),
  },
]

/* ————————————————— pieces ————————————————— */

/**
 * One-shot highlight for a deep-linked section: a faint espresso wash plus a
 * hairline espresso bar that fade away (tw-animate-css exit animation, held at
 * the end state). The global prefers-reduced-motion override collapses the
 * animation to its end state instantly, so nothing flashes there.
 */
function Flash() {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-espresso/5 animate-out fade-out fill-mode-forwards duration-[2000ms] ease-in"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-espresso animate-out fade-out fill-mode-forwards duration-[2000ms] ease-in"
      />
    </>
  )
}

function Section({
  id,
  label,
  eyebrow,
  title,
  lede,
  banded = false,
  flash = false,
  children,
}: {
  id: Topic
  label: string
  eyebrow: string
  title: string
  lede?: ReactNode
  banded?: boolean
  flash?: boolean
  children: ReactNode
}) {
  return (
    <section
      id={`help-${id}`}
      aria-label={label}
      className={cn('relative scroll-mt-32', banded && 'border-y border-line bg-secondary/50')}
    >
      {flash ? <Flash /> : null}
      <div className="relative container-site py-14 sm:py-20">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl font-light tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          {lede ? (
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">{lede}</p>
          ) : null}
        </Reveal>
        {children}
      </div>
    </section>
  )
}

/* ————————————————— page ————————————————— */

export function HelpPage() {
  const route = useRoute()
  const topic = asTopic(route.query.get('topic'))

  useEffect(() => {
    document.title = 'Client Care — Style Sence'
    if (!topic) return
    // Sections carry scroll-mt so the sticky header + topic nav clear them.
    // One rAF keeps this scroll past the shell's scroll-to-top on path change;
    // scrollIntoView() defers to the CSS scroll-behavior (smooth, auto under
    // the global reduced-motion override).
    const raf = requestAnimationFrame(() => {
      document.getElementById(`help-${topic}`)?.scrollIntoView()
    })
    return () => cancelAnimationFrame(raf)
  }, [topic])

  return (
    <div>
      {/* ————— hero ————— */}
      <section aria-label="Client care" className="container-site pb-12 pt-14 sm:pb-16 sm:pt-20">
        <Reveal>
          <p className="eyebrow">Client care</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-light leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
            How can we help?
          </h1>
          <p className="mt-6 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
            Shipping, returns, measurements and the keeping of good cloth — set down
            plainly, the way we would say it across the atelier table. For anything not
            covered here, one email reaches the same small team that cuts, packs and posts
            every parcel.
          </p>
        </Reveal>
      </section>

      {/* ————— topic nav (sticky in-page index) ————— */}
      <nav
        aria-label="Client care topics"
        className="sticky top-16 z-40 border-y border-line bg-background/95 backdrop-blur-md sm:top-18"
      >
        <div className="container-site">
          <ul className="flex overflow-x-auto no-scrollbar">
            {TOPICS.map((t) => {
              const active = topic === t.id
              return (
                <li key={t.id} className="shrink-0">
                  <Link
                    to={`/help?topic=${t.id}`}
                    className={cn(
                      'flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-[0.66rem] font-medium uppercase tracking-[0.2em] transition-colors sm:px-5',
                      active
                        ? 'border-espresso text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* ————— shipping ————— */}
      <Section
        id="shipping"
        label="Shipping and delivery"
        eyebrow="Shipping"
        title="Dispatch & delivery"
        lede="Every parcel leaves the Ikoyi atelier tracked, and travels to your door anywhere in Nigeria."
        flash={topic === 'shipping'}
      >
        <Reveal delay={0.08} className="mt-10">
          <div className="border border-line">
            <Table className="w-full min-w-[600px]">
              <TableHeader>
                <TableRow className="border-line hover:bg-transparent">
                  <TableHead scope="col" className="eyebrow h-auto px-5 py-4">
                    Method
                  </TableHead>
                  <TableHead scope="col" className="eyebrow h-auto px-5 py-4">
                    Fee
                  </TableHead>
                  <TableHead scope="col" className="eyebrow h-auto px-5 py-4">
                    Arrives
                  </TableHead>
                  <TableHead scope="col" className="eyebrow h-auto px-5 py-4">
                    Notes
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SHIPPING_ROWS.map((r) => (
                  <TableRow key={r.method} className="border-line hover:bg-transparent">
                    <TableCell className="px-5 py-4 font-medium">{r.method}</TableCell>
                    <TableCell className="px-5 py-4 font-mono text-[0.85rem] tabular-nums text-espresso">
                      {formatNaira(r.fee)}
                    </TableCell>
                    <TableCell className="px-5 py-4">{r.eta}</TableCell>
                    <TableCell className="px-5 py-4 text-muted-foreground">{r.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            {SHIPPING_FACTS.map((f) => (
              <div key={f.label} className="bg-background p-5">
                <p className="eyebrow">{f.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <p className="border border-line bg-secondary/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
              Every order is dispatched via insured nationwide courier. Tracking is added
              to your order page and sent by email the moment your piece leaves the studio.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* ————— returns ————— */}
      <Section
        id="returns"
        label="Returns and exchanges"
        eyebrow="Returns"
        title="Returns & exchanges"
        lede="If a piece is not right, it can come home — quietly and without ceremony, within fourteen days."
        banded
        flash={topic === 'returns'}
      >
        <Reveal delay={0.08} className="mt-10">
          <dl className="divide-y divide-line border-y border-line">
            {RETURN_TERMS.map((t) => (
              <div key={t.term} className="grid gap-2 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
                <dt className="eyebrow pt-1">{t.term}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{t.detail}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <p className="border border-line bg-secondary/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
              To begin a return, WhatsApp the studio on +234 816 302 2233 with your order
              number — we will arrange collection and take it from there.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* ————— sizing ————— */}
      <Section
        id="sizing"
        label="Sizing and measurements"
        eyebrow="Sizing"
        title="Measurements"
        lede="Our patterns are drafted on real bodies and graded XS through XL. Measure yourself calmly, in underwear, with the tape level — then match the chart."
        flash={topic === 'sizing'}
      >
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <div className="border border-line">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-line hover:bg-transparent">
                    <TableHead scope="col" className="eyebrow h-auto px-4 py-3.5">
                      Size
                    </TableHead>
                    <TableHead scope="col" className="eyebrow h-auto px-4 py-3.5">
                      Bust
                    </TableHead>
                    <TableHead scope="col" className="eyebrow h-auto px-4 py-3.5">
                      Waist
                    </TableHead>
                    <TableHead scope="col" className="eyebrow h-auto px-4 py-3.5">
                      Hips
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MEASUREMENTS.map((m) => (
                    <TableRow key={m.size} className="border-line hover:bg-transparent">
                      <TableCell className="px-4 py-3.5 font-medium">{m.size}</TableCell>
                      <TableCell className="px-4 py-3.5 font-mono text-[0.85rem] tabular-nums">
                        {m.bust}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 font-mono text-[0.85rem] tabular-nums">
                        {m.waist}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 font-mono text-[0.85rem] tabular-nums">
                        {m.hips}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground/80">
              Body measurements in centimetres — the tape skims, it never squeezes.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="space-y-8">
              <div>
                <p className="eyebrow">How to measure</p>
                <ul className="mt-3 space-y-2.5">
                  {MEASURE_STEPS.map((s) => (
                    <li key={s.part} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-[0.55rem] h-[3px] w-[3px] shrink-0 rounded-full bg-espresso" aria-hidden />
                      <span>
                        <span className="text-foreground">{s.part}</span> — {s.how}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-line pt-6">
                <p className="eyebrow">Fit notes</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Knitwear is cut relaxed — between sizes, stay true or take the smaller.
                  Tailoring runs true to the chart; size down only if you like a close line.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ————— care ————— */}
      <Section
        id="care"
        label="Care instructions"
        eyebrow="Care"
        title="Care of the cloth"
        lede="Kept well, these pieces are meant to outlast the season they arrived in — each cloth asks for slightly different patience."
        banded
        flash={topic === 'care'}
      >
        <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2">
          {CARE_GUIDES.map((g, i) => (
            <Reveal key={g.n} delay={i * 0.08} className="bg-background">
              <div className="h-full p-7 sm:p-9">
                <p className="font-mono text-[0.72rem] text-espresso">{g.n}</p>
                <h3 className="mt-3 font-display text-xl font-light tracking-tight">{g.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ————— contact ————— */}
      <Section
        id="contact"
        label="Contact"
        eyebrow="Contact"
        title="Write to the house"
        lede="One inbox, one studio door, one small team behind both."
        flash={topic === 'contact'}
      >
        <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
          <Reveal className="bg-background">
            <div className="h-full p-7">
              <p className="eyebrow">Write</p>
              <a
                href="https://wa.me/2348163022233"
                className="link-underline mt-3 inline-flex min-h-[44px] items-center font-display text-lg font-light tracking-tight"
              >
                +234 816 302 2233
              </a>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                WhatsApp the studio — answered within one business day by the same people
                who cut the pieces.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="bg-background">
            <div className="h-full p-7">
              <p className="eyebrow">The studio</p>
              <address className="mt-3 text-sm not-italic leading-relaxed text-muted-foreground">
                14A Awolowo Road
                <br />
                Ikoyi, Lagos, Nigeria
              </address>
              <p className="mt-3 text-sm text-muted-foreground">Walk-ins welcome during studio hours.</p>
            </div>
          </Reveal>
          <Reveal delay={0.16} className="bg-background">
            <div className="h-full p-7">
              <p className="eyebrow">Hours</p>
              <p className="mt-3 font-mono text-sm tabular-nums">Tue – Sat · 10:00 – 18:00</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                West Africa Time. Sundays and Mondays the atelier rests; email still lands.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2">
            <Link
              to="/track"
              className="group flex min-h-[44px] items-center justify-between gap-4 border border-line px-5 py-4 transition-colors hover:border-foreground"
            >
              <span>
                <span className="eyebrow block">Already ordered?</span>
                <span className="mt-1 block font-display text-lg font-light tracking-tight">
                  Track your order
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-espresso transition-transform group-hover:translate-x-1"
                strokeWidth={1.5}
                aria-hidden
              />
            </Link>
            <p className="border border-line bg-secondary/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
              WhatsApp the studio on <span className="font-medium text-foreground">+234 816 302 2233</span> —
              we reply within a working day, and faster during collection drops.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* ————— faq ————— */}
      <Section
        id="faq"
        label="Frequently asked questions"
        eyebrow="FAQ"
        title="Frequently asked"
        lede="The questions that reach us most, answered plainly. Yours not among them — write to us."
        banded
        flash={topic === 'faq'}
      >
        <Reveal delay={0.08} className="mt-10">
          <Accordion type="single" collapsible className="border border-line bg-background px-5 sm:px-8">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.q} value={item.q} className="border-line">
                <AccordionTrigger className="py-5 text-left font-display text-base font-light tracking-tight hover:no-underline sm:text-lg">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Section>

      {/* ————— closing CTA band ————— */}
      <section aria-label="Begin" className="bg-primary py-16 sm:py-24">
        <div className="container-site text-center">
          <Reveal>
            <p className="eyebrow !text-primary-foreground/70">Begin</p>
            <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-light leading-tight tracking-tight text-balance text-primary-foreground sm:text-4xl">
              One piece, kept well, is the whole point.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/75">
              And if a question still holds you back, write first — we would rather answer
              than hurry you.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="h-12 bg-primary-foreground px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-primary transition-colors hover:bg-primary-foreground/85"
              >
                Shop the collection
              </button>
              <Link
                to="/journal"
                className="flex h-12 items-center gap-1.5 border border-primary-foreground/50 px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-primary-foreground transition-colors hover:border-primary-foreground hover:bg-primary-foreground/10"
              >
                Read the journal
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
