import * as React from 'react';

import { themeBreakpoints } from '../app.theme';


const isBrowser = typeof window !== 'undefined';

export const useIsMobile = (): boolean => useMatchMedia(`(max-width: ${themeBreakpoints.md - 1}px)`, false);

export function useMatchMedia(query: string, ssrValue: boolean): boolean {
  const [matches, setMatches] = React.useState(isBrowser ? window.matchMedia(query).matches : ssrValue);

  React.useEffect(() => {
    if (!isBrowser) return undefined;

    // creates a query that will emit events
    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    // watch for changes in the media query, and cleanup when component unmounts
    const documentChangeHandler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener('change', documentChangeHandler);
    return () => mediaQueryList.removeEventListener('change', documentChangeHandler);
  }, [query]);

  return matches;
}
