/**
 * Abort primitives shared by client and server code: plain AbortSignal, AbortController and
 * DOMException, nothing browser-only. These consume a signal (a promise that stops waiting when it
 * aborts); code that produces derived signals lives with its single caller until a second one shows up.
 */

/** The signal's abort reason, or a proper AbortError when it was aborted without one. */
export function abortSignalReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}


/**
 * Waits `ms`, or returns as soon as `signal` aborts. Never rejects: 'aborted' when the signal did
 * (at once if already aborted, which wins over an elapsed delay), 'elapsed' when the delay ran out
 * (at once for ms <= 0).
 */
export function delayOrAbort(ms: number, signal: AbortSignal | undefined): Promise<'elapsed' | 'aborted'> {

  // already aborted: wins over a zero delay
  if (signal?.aborted) return Promise.resolve('aborted');
  // nothing to wait for: no timer, no listener
  if (ms <= 0) return Promise.resolve('elapsed');

  return new Promise((resolve) => {
    const onSignalAbort = () => {
      clearTimeout(delayTimer);
      resolve('aborted');
    };
    const delayTimer = setTimeout(() => {
      signal?.removeEventListener('abort', onSignalAbort);
      resolve('elapsed');
    }, ms);
    signal?.addEventListener('abort', onSignalAbort, { once: true });
  });
}


/**
 * Settles with `promise`, or rejects with the signal's reason as soon as `signal` aborts (at once if
 * already aborted). The work behind `promise` is not cancelled: pass `signal` to it as well when it
 * can stop itself. The abort listener is released when `promise` settles, so a long-lived signal can
 * be raced any number of times without accumulating listeners.
 */
export function resultOrAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {

  // nothing to race against
  if (!signal) return promise;
  // already aborted: reject at once, without waiting on the promise
  if (signal.aborted) return Promise.reject(abortSignalReason(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortSignalReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}


/**
 * Abort an AbortController with a proper DOMException('AbortError') instead of a raw string,
 * so all downstream `error.name === 'AbortError'` checks work correctly.
 */
export function abortWithReason(controller: AbortController | undefined | null, message: string): void {
  controller?.abort(new DOMException(message, 'AbortError'));
}

/**
 * Detect cancellation errors that are expected when users stop generation,
 * navigate away, or an operation is intentionally torn down.
 */
export function isAbortErrorLike(error: unknown): boolean {
  if (!error) return false;

  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
    return true;

  if (error instanceof Error) {
    if (error.name === 'AbortError')
      return true;
    if (error.cause)
      return isAbortErrorLike(error.cause);
  }

  if (typeof error === 'object') {
    const maybeError = error as { name?: unknown; message?: unknown; cause?: unknown; error?: unknown };
    if (maybeError.name === 'AbortError')
      return true;
    if (maybeError.error)
      return isAbortErrorLike(maybeError.error);
    if (maybeError.cause)
      return isAbortErrorLike(maybeError.cause);
  }

  return false;
}
