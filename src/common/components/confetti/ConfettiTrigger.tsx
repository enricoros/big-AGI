import * as React from 'react';

// dynamically imported: keep the canvas + confetti bundle out of the main chunk,
// and make sure the underlying <canvas> is fully unmounted (not just hidden)
// whenever no celebration is in flight
const ReactCanvasConfettiLazy = React.lazy(() => import('react-canvas-confetti'));

// the `confetti` instance handed to `onInit` - inferred rather than imported,
// since react-canvas-confetti's compiled .d.ts doesn't re-export the type name
type TCanvasConfettiInstance = Parameters<NonNullable<React.ComponentProps<typeof ReactCanvasConfettiLazy>['onInit']>>[0]['confetti'];


/**
 * Fires a short, theme-colored confetti burst, then unmounts its <canvas>.
 *
 * Meant as a lightweight reward for milestones (e.g.: first voice call > 1min,
 * a new release, the first diagram generated, adding a local model provider,
 * accepting a flattened conversation, ...) - see #209.
 *
 * Usage: bump `fireKey` (e.g. a counter, or Date.now()) every time you want
 * a new burst; the component only exists in the tree (and only loads its
 * chunk) while a burst is pending.
 */
export function ConfettiTrigger(props: { fireKey: number | string | null }) {

  // no key (yet) -> render nothing, don't even load the chunk
  if (props.fireKey === null || props.fireKey === undefined)
    return null;

  return (
    <React.Suspense fallback={null}>
      <ConfettiBurst fireKey={props.fireKey} />
    </React.Suspense>
  );
}


function ConfettiBurst(props: { fireKey: number | string }) {

  // state
  const [done, setDone] = React.useState(false);
  const confettiRef = React.useRef<TCanvasConfettiInstance | null>(null);

  // reset when a new burst is requested
  React.useEffect(() => {
    setDone(false);
  }, [props.fireKey]);

  // fire once mounted (or when the key changes) - then self-unmount
  React.useEffect(() => {
    if (done) return;
    const confetti = confettiRef.current;
    if (!confetti) return;

    void confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      // theme-colored, so it doesn't clash with the app's palette (Joy UI CSS vars)
      colors: [
        getCssVar('--joy-palette-primary-500') || '#0B6BCB',
        getCssVar('--joy-palette-neutral-500') || '#5A6B7B',
      ],
    })?.then(() => setDone(true));
  }, [done, props.fireKey]);

  // fully gone once the animation has run - no lingering canvas element
  if (done)
    return null;

  return (
    <ReactCanvasConfettiLazy
      onInit={({ confetti }) => {
        confettiRef.current = confetti;
      }}
    />
  );
}


function getCssVar(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value?.trim() || undefined;
}
