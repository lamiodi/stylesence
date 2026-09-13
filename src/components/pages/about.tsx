'use client'

import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { navigate, Link } from '@/lib/router'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import { DevPlaceholder } from '@/components/site/dev-placeholder'

const VALUES = [
  {
    n: '01',
    title: 'Cloth we can name',
    body: 'Grade-A cashmere from named herds, extrafine merino, GOTS poplin, double-face wool from mills we visit. If the mill changes the specification, the colour is retired rather than compromised.',
  },
  {
    n: '02',
    title: 'Cut in small batches',
    body: 'Never more than the atelier can finish well in a week. Hand-padded lapels, French seams, hand-linked necks — the slow half of tailoring that nobody sees and everybody feels.',
  },
  {
    n: '03',
    title: 'Honest pricing',
    body: 'Two seasons, no mid-season markdowns on new cloth, archive pricing only when cloth is genuinely ended. The price is the price because it is what the piece costs to make well.',
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
            Style Sence is a study in ivory and charcoal.
          </h1>
          <p className="mt-6 text-[0.98rem] leading-relaxed text-muted-foreground">
            Founded by SKR in Lagos, the house makes considered womenswear in a palette of
            ivory, oat, taupe, espresso and charcoal — fifteen pieces a season, cut in small
            batches, meant to speak to every other piece already in your wardrobe.
          </p>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-muted-foreground">
            We call it sence — the Nigerian word for taste, for judgement, for knowing
            exactly when enough is enough. Every collection asks one question: would we
            mend this in five years? If not, it does not ship.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <ProductImage
            src="/images/editorial/look-2.png"
            alt="The Atelier Blazer layered over the Ivory Silk Slip Dress"
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
              “I never wanted a label. I wanted a wardrobe — mine, then yours. Ivory and
              charcoal, nothing orphaned, nothing loud.”
            </blockquote>
            {/* pull-quote attribution — hairline rule, display name, mono role */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="h-px w-8 bg-primary-foreground/40" aria-hidden />
              <p className="font-display text-base italic text-primary-foreground">SKR</p>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-primary-foreground/60">
                Founder & Creative Director
              </p>
            </div>
            <DevPlaceholder
              className="mt-8 !border-primary-foreground/30 bg-transparent"
              title="Press & collaborations"
            >
              Press kit and lookbook downloads are placeholders in this preview.
            </DevPlaceholder>
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-3">
            <ProductImage
              src="/images/editorial/look-3.png"
              alt="The Longline Wool Coat over an ivory knit column"
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
