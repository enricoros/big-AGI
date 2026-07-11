import * as React from 'react';


/**
 * Invokes `callback` when the page is restored from the back-forward cache (bfcache) - a Back/Forward
 * that reinstates a frozen document. State set right before a whole-document navigation (a `loading`
 * spinner) survives with no re-mount to clear it; `pageshow` with `persisted === true` is where such
 * transient state gets reset (a normal reload has `persisted === false` and re-mounts fresh). The
 * latest `callback` is used via a ref, so an inline function won't re-bind the listener.
 */
export function useHistoryBFCallback(callback: (event: PageTransitionEvent) => void): void {
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  React.useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted)
        callbackRef.current(event);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);
}
