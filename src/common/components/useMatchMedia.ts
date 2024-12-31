import * as React from 'react';

import { isBrowser } from '~/common/util/pwaUtils';


export function getIsMobile() {
  return isBrowser ? window.matchMedia(_isMobileQuery).matches : false;
}

export function useIsMobile(): boolean {
  return useMatchMedia(_isMobileQuery, false);
}

export function useIsTallScreen(): boolean {
  // Adjust the aspect ratio value as needed (e.g., 1 or 10/9 for a slightly taller than square ratio)
  return useMatchMedia('(max-aspect-ratio: 1)', false);
}


// the query was was ${appTheme.breakpoints.values.md: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } - 1}px
const _isMobileQuery: string = `(max-width: 899px)`;

function useMatchMedia(query: string, ssrValue: boolean): boolean {
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
