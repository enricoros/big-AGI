import { isBrowser } from '~/common/util/pwaUtils';
import { logger } from '~/common/logger';


/**
 * Intercept & log global uncaught client errors
 */
export function setupClientUncaughtErrorsLogging(): () => void {
  if (!isBrowser) return () => { /* no-op */
  };

  // Handle uncaught exceptions
  const handleError = (event: ErrorEvent) => {
    logger.error('Uncaught error', {
      message: event.error?.message || event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }, 'unhandled', { skipReporting: true });
  };

  // Handle unhandled promise rejections
  const handleRejection = (event: PromiseRejectionEvent) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      message: event.reason?.message,
      stack: event.reason?.stack,
    }, 'unhandled', { skipReporting: true });
  };

  // install
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  // cleanup function
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
