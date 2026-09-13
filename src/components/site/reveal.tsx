'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Scroll-reveal wrapper that honours prefers-reduced-motion:
 * with reduced motion the content renders immediately with no transform.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] },
    },
  }

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-60px' }}
    >
      {children}
    </motion.div>
  )
}

/** Fade-through for page transitions; instant when reduced motion is set. */
export function PageFade({ children, keyName }: { children: ReactNode; keyName: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div key={keyName}>{children}</div>
  return (
    <motion.div
      key={keyName}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
