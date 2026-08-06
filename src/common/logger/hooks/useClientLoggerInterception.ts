import * as React from 'react';

import { setupClientFetchErrorsLogging, setupClientUncaughtErrorsLogging } from '~/common/logger';


/**
 * Custom React hook that sets up client-side logging interceptors exactly once,
 * even under Strict Mode, without double initialization.
 */
export function useClientLoggerInterception(captureUnhandledErrors: boolean, captureFetchErrors: boolean) {
  React.useEffect(() => {
    // mount
    const cleanupFetch = !captureFetchErrors ? undefined : setupClientFetchErrorsLogging();
    const cleanupUncaught = !captureUnhandledErrors ? undefined : setupClientUncaughtErrorsLogging();

    // unmount
    return () => {
      cleanupFetch?.();
      cleanupUncaught?.();
    };
  }, [captureFetchErrors, captureUnhandledErrors]);
}
