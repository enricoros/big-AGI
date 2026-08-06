import { isBrowser } from '~/common/util/pwaUtils';
import { logger } from '~/common/logger';


/**
 * Wraps fetch to log network errors
 */
export function setupClientFetchErrorsLogging(): () => void {
  if (!isBrowser) return () => { /* no-op */
  };

  const originalFetch = window.fetch;

  window.fetch = async function wrappedFetch(input, init) {
    try {
      const response = await originalFetch.apply(this, [input, init]);

      // log unsuccessful responses
      if (!response.ok)
        logger.error(`Network request failed: ${response.status} ${response.statusText}`, {
          url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
          method: init?.method || 'GET',
          status: response.status,
          statusText: response.statusText,
        }, 'network');

      return response;

    } catch (error: any) {

      // log connection errors (offline, etc.)
      logger.error(`Network request error`, {
        url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
        method: init?.method || 'GET',
        error: error?.message || error.toString(),
      }, 'network', {
        action: {
          // example action - shall open connection troubleshooting panel or check connection
          label: 'Check Connection',
          handler: async () => {
            if (navigator.onLine)
              logger.info('Device appears to be online. Issue might be server-related.');
            else
              logger.warn('Device is offline. Please check your internet connection.');
          },
        },
      });

      throw error;
    }
  };

  // cleanup function
  const justWrappedFetch = window.fetch;
  return () => {
    if (window.fetch === justWrappedFetch)
      window.fetch = originalFetch;
  };
}
