import * as React from 'react';

import { themeBreakpoints } from '../app.theme';

import { isBrowser } from '~/common/util/pwaUtils';

const isMobileQuery = () => `(max-width: ${themeBreakpoints.md - 1}px)`;

export const getIsMobile = () => isBrowser ? window.matchMedia(isMobileQuery()).matches : false;

export const useIsMobile = (): boolean => useMatchMedia(isMobileQuery(), false);

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
