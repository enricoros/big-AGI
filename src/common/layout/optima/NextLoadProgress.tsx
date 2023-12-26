import * as React from 'react';
import { useRouter } from 'next/router';
import { default as NProgress } from 'nprogress';


import 'nprogress/nprogress.css';


/**
 * Not show the bar for very fast loads (with a delay), and for the same route
 */
export function NextRouterProgress(props: { color: string, delay?: number }) {

  // external state
  const router = useRouter();

  // this fires both when the page is refreshed, and when the route changes
  React.useEffect(() => {

    NProgress.configure({
      showSpinner: false,
    });

    // timeout to not show the progress bar for very fast loads
    let timeout: number;
    const handleStop = () => {
      clearTimeout(timeout);
      NProgress.done();
    };
    const handleStart = (newRoute: string) => {
      handleStop();
      if (newRoute == router.route)
        return;
      timeout = window.setTimeout(
        () => NProgress.start(),
        props.delay === undefined ? 250 : props.delay,
      );
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
  }, [props.delay, router]);

  return (
    <style>
      {`
        #nprogress .bar {
          height: 4px;
          background: ${props.color};
        }
        #nprogress .peg {
          box-shadow: 0 0 10px ${props.color}, 0 0 5px ${props.color};
        }
     `}
    </style>
  );
}