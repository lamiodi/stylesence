# Style Sence preloader

A warm ivory entrance using the approved signature logo. The signature sweeps into view, a quiet line indicates loading, and the overlay fades away when the first screen is ready.

## Files

- `StyleSencePreloader.tsx` — React / Next.js client component.
- `stylesence-preloader.css` — scoped styles and reduced-motion alternative.
- `stylesence-logo.png` — transparent logo; copy to your app's `public` directory.
- `preview.html` — self-contained animated preview; open in a browser and select Replay.

## React or Next.js

Copy the component and CSS into your components directory. Copy `stylesence-logo.png` into `public/`. Import the component and pass your actual first-screen readiness state:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import StyleSencePreloader from './components/StyleSencePreloader';

export default function AppShell({ firstScreenReady, children }: {
  firstScreenReady: boolean;
  children: ReactNode;
}) {
  const [entranceDone, setEntranceDone] = useState(firstScreenReady);

  return (
    <>
      <StyleSencePreloader
        ready={firstScreenReady}
        onExit={() => setEntranceDone(true)}
      />
      <div inert={!entranceDone} aria-busy={!firstScreenReady}>
        {children}
      </div>
    </>
  );
}
```

`firstScreenReady` should become true when the critical content for the first screen is available. Do not wait for every product image, analytics script or below-the-fold request. If the first screen is already ready, the component skips the preloader entirely. There is no imposed minimum loading duration.

The component is one-shot per mount. Keep it in the top-level application shell so route changes do not restart it. The default safety timeout is 6 seconds; after that, it reveals the underlying app even if `ready` is still false. Any real data-loading or error state should remain visible in the page. The optional `onExit` callback runs once, after the overlay is removed (or immediately when it was skipped).

The `inert` example uses React 19. If your project uses an older version, adapt the attribute handling to your setup. For a Next.js App Router project, import global CSS from the app layout if your configuration requires it, and keep the stateful shell in a client component.

## Design and accessibility

- Colours: ivory `#F8F4EC`, warm charcoal `#221E1A`.
- Uses the supplied brand logo with a reveal animation; this is a sweep reveal, not a redrawn or traced logo.
- The loading line is indeterminate and does not claim a percentage.
- Reduced-motion preference removes the sweep, line motion and vertical drift.
- A polite screen-reader loading status is included.
- Uses your existing Geist Mono font when available, with a system monospace fallback. No external font request or animation dependency is required.
- The preview simulates readiness after 2.3 seconds only so the animation can be reviewed. The React component is controlled by real readiness.
- The preview's collection heading is a demonstration backdrop; it is not part of the production component.

This package does not install or deploy anything to the live website.
