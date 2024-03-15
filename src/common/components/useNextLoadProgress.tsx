import * as React from 'react';
import type { Router } from 'next/router';
import { default as NProgress } from 'nprogress';


/**
 * Not show the bar for very fast loads (with a delay), and for the same route
 * NOTE: make sure that the applicatio is importing nprogress.css!
 */
export function useNextLoadProgress(route: string, events: typeof Router.events, delay = 250) {

  // this fires both when the page is refreshed, and when the route changes
  React.useEffect(() => {

    NProgress.configure({
      showSpinner: false,
    });

    // timeout to not show the progress bar for very fast loads
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleStop = () => {
      clearTimeout(timeoutId);
      NProgress.done();
    };

    const handleStart = (newRoute: string) => {
      if (newRoute === route) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        NProgress.start();
      }, delay);
    };

    events.on('routeChangeStart', handleStart);
    events.on('routeChangeComplete', handleStop);
    events.on('routeChangeError', handleStop);

    return () => {
      handleStop();
      events.off('routeChangeStart', handleStart);
      events.off('routeChangeComplete', handleStop);
      events.off('routeChangeError', handleStop);
    };
  }, [delay, events, route]);
}