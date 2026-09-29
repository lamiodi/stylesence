'use client';

import { useEffect, useRef, useState } from 'react';
import './stylesence-preloader.css';

export type StyleSencePreloaderProps = {
  /** Set true as soon as the content needed for the first screen is ready. */
  ready: boolean;
  /** Copy the included PNG into your public directory. */
  logoSrc?: string;
  /** Fail open so the entrance never blocks the site indefinitely. */
  maxWaitMs?: number;
  /** Called once, after the overlay is removed. */
  onExit?: () => void;
};

/** One entrance per mount. No artificial minimum wait or simulated percentage. */
export default function StyleSencePreloader({
  ready,
  logoSrc = '/stylesence-logo.png',
  maxWaitMs = 6000,
  onExit,
}: StyleSencePreloaderProps) {
  const [visible, setVisible] = useState(() => !ready);
  const [leaving, setLeaving] = useState(false);
  const [expired, setExpired] = useState(false);
  const exited = useRef(false);
  const onExitRef = useRef(onExit);

  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(
      () => setExpired(true),
      Number.isFinite(maxWaitMs) ? Math.max(0, maxWaitMs) : 6000,
    );
    return () => window.clearTimeout(timeout);
  }, [visible, maxWaitMs]);

  // Leaving derives from ready/expired — adjusted during render (guarded
  // setState in the component body) instead of a cascading effect.
  if ((ready || expired) && !leaving) setLeaving(true);

  useEffect(() => {
    if (!visible || !leaving) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, reducedMotion ? 180 : 540);
    return () => window.clearTimeout(timeout);
  }, [visible, leaving]);

  useEffect(() => {
    if (visible || exited.current) return;
    exited.current = true;
    onExitRef.current?.();
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`ss-loader${leaving ? ' ss-loader--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Style Sence"
    >
      <div className="ss-loader__content" aria-hidden="true">
        <div className="ss-loader__signature">
          <img
            className="ss-loader__logo"
            src={logoSrc}
            alt=""
            width={720}
            height={240}
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <span className="ss-loader__caption">MADE TO ORDER IN LAGOS</span>
        <div className="ss-loader__line"><span /></div>
      </div>
      <div className="ss-loader__foot" aria-hidden="true">
        <span>EST. 2026</span><span>LAGOS ATELIER</span>
      </div>
    </div>
  );
}
