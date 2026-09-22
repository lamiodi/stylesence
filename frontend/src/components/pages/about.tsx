'use client'

import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { navigate, Link } from '@/lib/router'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'

const VALUES = [
  {
    n: '01',
    title: 'Cloth we can name',
    body: 'Silk charmeuse that drinks the light, fluid crepe-silk blends, and Aso Oke hand-woven by master weavers. If the cloth is not right, the piece is not made.',
  },
  {
    n: '02',
    title: 'Cut to your measure',
    body: 'Standard sizes XS to XXL, or bespoke measurements taken at order — bust, waist, hip, shoulder, length. Production runs 7–10 working days; express in 2–3.',
  },
  {
    n: '03',
    title: 'Honest pricing',
    body: 'Made to order, never over-produced. The price is what the piece costs to make well — cloth, loom time and hands accounted for, nothing inflated for a markdown.',
  },
] as const

export function AboutPage() {
  useEffect(() => {
    document.title = 'About — Style Sence'
  }, [])

  return (
    <div>
      {/* hero split */}
      <section className="container-site grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow">The house</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
            Style Sence is made to your measure.
          </h1>
          <p className="mt-6 text-[0.98rem] leading-relaxed text-muted-foreground">
            Founded by SKR in Lagos, the house makes made-to-order womenswear —
            polka-dot silk coordinates, fluid draping gowns and hand-woven Aso Oke —
            cut to your measurements in small batches and delivered nationwide.
          </p>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-muted-foreground">
            We call it sence — the Nigerian word for taste, for judgement, for knowing
            exactly when enough is enough. Every collection asks one question: would we
            mend this in five years? If not, it does not ship.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <ProductImage
            src="https://res.cloudinary.com/qaruxkhf/image/upload/w_1400,q_auto,f_auto/v1790056417/stylesence/editorial/camille-crop-set-blue.jpg"
            alt="Polka-dot co-ord set in dusty blue from the collection"
            label="The house uniform"
            ratio="aspect-[4/5]"
            eager
          />
        </Reveal>
      </section>

      {/* values */}
      <section className="border-y border-line bg-secondary/50 py-16 sm:py-20">
        <div className="container-site">
          <Reveal>
            <p className="eyebrow">What we hold to</p>
            <h2 className="mt-2 font-display text-3xl font-light tracking-tight sm:text-4xl">
              Three commitments
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.n} delay={i * 0.08} className="bg-background">
                <div className="h-full p-7 sm:p-9">
                  <p className="font-mono text-[0.72rem] text-espresso">{v.n}</p>
                  <h3 className="mt-3 font-display text-xl font-light tracking-tight">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* atelier quote band */}
      <section className="bg-primary py-16 sm:py-24">
        <div className="container-site grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
          <Reveal className="lg:col-span-2">
            <p className="eyebrow !text-primary-foreground/70">From the founder</p>
            <blockquote className="mt-4 font-display text-2xl font-light italic leading-snug tracking-tight text-primary-foreground sm:text-3xl">
              “I never wanted a label. I wanted a wardrobe — mine, then yours. Cloth that
              moves, pieces that answer each other, nothing loud.”
            </blockquote>
            {/* pull-quote attribution — hairline rule, display name, mono role */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="h-px w-8 bg-primary-foreground/40" aria-hidden />
              <p className="font-display text-base italic text-primary-foreground">SKR</p>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-primary-foreground/60">
                Founder & Creative Director
              </p>
            </div>
            <div className="mt-8 border border-primary-foreground/25 px-6 py-5">
              <p className="eyebrow !text-[0.6rem] !text-primary-foreground/70">
                Press, collaborations & fittings
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-primary-foreground/80">
                Write to the studio on WhatsApp —{' '}
                <span className="font-medium text-primary-foreground">+234 816 302 2233</span>{' '}
                — for press kits, collaborations and private fitting appointments. We reply
                within a working day.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-3">
            <ProductImage
              src="https://res.cloudinary.com/qaruxkhf/image/upload/w_1400,q_auto,f_auto/v1790056415/stylesence/products/ariella-gown-blue.jpg"
              alt="The Ariella gown in powder blue on the staircase"
              label="The long line"
              ratio="aspect-[7/5]"
              className="w-full"
            />
          </Reveal>
        </div>
      </section>

      {/* studio colophon — hairline meta band */}
      <section aria-label="Studio facts" className="border-y border-line">
        <div className="container-site">
          <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {([
              ['Est.', '2026'],
              ['Studio', 'Ikoyi, Lagos'],
              ['Cadence', 'Two collections a year'],
              ['Batch', 'One week of finish'],
            ] as [string, string][]).map(([dt, dd]) => (
              <div key={dt} className="bg-background p-5 sm:p-6">
                <dt className="eyebrow !text-[0.58rem]">{dt}</dt>
                <dd className="mt-2 font-display text-xl font-light tracking-tight sm:text-[1.35rem]">
                  {dd}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="container-site py-16 text-center sm:py-24">
        <Reveal>
          <p className="eyebrow">Begin</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-light leading-tight tracking-tight text-balance sm:text-4xl">
            Start with one ivory piece and build outward.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="h-12 bg-primary px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Shop the collection
            </button>
            <Link
              to="/journal"
              className="flex h-12 items-center gap-1.5 border border-line-strong px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] transition-colors hover:border-foreground"
            >
              Read the journal
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
