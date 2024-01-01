import * as React from 'react';
import { useRouter } from 'next/router';
import { default as NProgress } from 'nprogress';


/**
 * Not show the bar for very fast loads (with a delay), and for the same route
 * NOTE: make sure that the applicatio is importing nprogress.css!
 */
export function useNextLoadProgress(delay: number = 250) {

  // external state
  const router = useRouter();

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
      if (newRoute === router.route) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        NProgress.start();
      }, delay);
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleStop);
    router.events.on('routeChangeError', handleStop);

    return () => {
      handleStop();
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleStop);
      router.events.off('routeChangeError', handleStop);
    };
  }, [delay, router]);
}