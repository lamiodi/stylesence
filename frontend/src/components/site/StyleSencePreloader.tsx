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
  /** The entrance is a brand beat, not a loader: even a warm cache keeps it
   * on screen long enough to register (kills the mobile cache-flash). */
  minMs?: number;
  /** Called once, after the overlay is removed. */
  onExit?: () => void;
};

/** One entrance per mount. No simulated percentage — but a minimum display
 * window so a cached hero can't turn the brand moment into a flash. */
export default function StyleSencePreloader({
  ready,
  logoSrc = '/stylesence-logo.png',
  maxWaitMs = 6000,
  minMs = 1400,
  onExit,
}: StyleSencePreloaderProps) {
  const [visible, setVisible] = useState(() => !ready);
  const [expired, setExpired] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const leaving = (ready || expired) && minElapsed;
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

  useEffect(() => {
    if (!visible) return;
    const timeout = window.setTimeout(
      () => setMinElapsed(true),
      Number.isFinite(minMs) ? Math.max(0, minMs) : 1400,
    );
    return () => window.clearTimeout(timeout);
  }, [visible, minMs]);

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
