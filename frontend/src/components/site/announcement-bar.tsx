const ITEMS = [
  'Complimentary shipping over ₦150,000',
  'Made to order in Lagos — delivered nationwide',
  'Polka-dot silk sets · fluid gowns · hand-woven Aso Oke',
  'Cut to your measurements — XS to XXL or bespoke',
]

export function AnnouncementBar() {
  // Duplicated list enables a seamless CSS marquee; static under reduced motion.
  const strip = (key: string, hidden: boolean) => (
    <div key={key} className={hidden ? 'sr-only' : 'flex shrink-0 items-center'} aria-hidden={hidden}>
      {ITEMS.map((item, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-6 text-[0.62rem] font-medium uppercase tracking-[0.28em] text-primary-foreground/90">
            {item}
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-primary-foreground/50" aria-hidden />
        </span>
      ))}
    </div>
  )

  return (
    <div className="marquee-hover no-print overflow-hidden border-b border-primary-foreground/10 bg-primary py-2">
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {strip('a', false)}
        {strip('b', true)}
      </div>
      <p className="sr-only">{ITEMS.join(' · ')}</p>
    </div>
  )
}
