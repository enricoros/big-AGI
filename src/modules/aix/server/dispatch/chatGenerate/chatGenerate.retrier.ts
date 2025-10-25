import { TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';


const RETRY_PROFILES = {
  // network/DNS failures (never connected) -> fast retry
  network: {
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitterFactor: 0.25,
    maxAttempts: 4,      // 4 attempts total: immediate, then retry at ~0.5s, ~1s, ~2s
  },
  // server overload (connected, but server busy) -> slower retry
  server: {
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    jitterFactor: 0.5,    // 50% randomization
    maxAttempts: 4,      // 4 attempts total: immediate, then retry at ~1s, ~2s, ~4s
  },
} as const;

type RetryProfile = typeof RETRY_PROFILES[keyof typeof RETRY_PROFILES];


/**
 * Determines if a dispatch error is retryable and which profile to use.
 */
function selectRetryProfile(error: TRPCFetcherError | unknown): RetryProfile | null {
  if (!(error instanceof TRPCFetcherError))
    return null;

  if (error.category === 'connection')
    return RETRY_PROFILES.network; // DNS, TCP, timeouts, ... doesn't connect

  if (error.category === 'http' && error.httpStatus) {
    const retryCodes = [
      429, // Too Many Requests
      502, // Bad Gateway
      503, // Service Unavailable
    ];
    if (retryCodes.includes(error.httpStatus))
      return RETRY_PROFILES.server;
  }

  return null;
}


/**
 * Creates a retryable promise that attempts the operation with exponential backoff.
 *
 * This returns a single promise that internally handles all retry attempts,
 * allowing it to be used with the existing heartbeatsWhileAwaiting pattern.
 *
 * Features:
 * - Exponential backoff: delay * 2^(attempt-1), capped at maxDelay
 * - Jitter: ±25% for network errors, ±50% for server errors (prevents thundering herd)
 * - Heartbeat safe: All delays capped at 10s to prevent connection timeouts
 *
 * @param operationFn The operation to retry (must be repeatable/idempotent)
 * @param abortSignal Signal to cancel retries
 * @returns Promise that resolves with the successful result or rejects with the final error
 */
export function createRetryablePromise<T>(operationFn: () => Promise<T>, abortSignal: AbortSignal): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    let attemptNumber = 1;

    while (true) {
      try {

        // normal attempt, expecting success and setting the promise value
        const result = await operationFn();
        resolve(result);
        return;

      } catch (error: any) {

        // aborted: forward the error immediately
        if (abortSignal.aborted) {
          reject(error);
          return;
        }

        // check if error is retryable
        const rp = selectRetryProfile(error);
        if (!rp || attemptNumber >= rp.maxAttempts) {
          reject(error);
          return;
        }


        // calculate exponential backoff with jitter
        const exponentialDelay = rp.baseDelayMs * Math.pow(2, attemptNumber - 1);
        let delayMs = Math.min(exponentialDelay, rp.maxDelayMs);

        // add jitter to prevent thundering herd
        if (rp.jitterFactor > 0) {
          const jitterRange = delayMs * rp.jitterFactor;
          const randomJitter = (Math.random() * 2 - 1) * jitterRange; // ±jitterRange
          delayMs = Math.max(1, Math.round(delayMs + randomJitter));
        }

        attemptNumber++;

        // abortable wait
        await new Promise<void>((resolveDelay) => {
          if (abortSignal.aborted || delayMs <= 0) {
            resolveDelay();
            return;
          }

          const timer = setTimeout(resolveDelay, delayMs);

          const onAbort = () => {
            clearTimeout(timer);
            resolveDelay();
          };

          abortSignal.addEventListener('abort', onAbort, { once: true });
        });

        // check if the wait was aborted
        if (abortSignal.aborted) {
          reject(error);
          return;
        }

        // -> loop continues for next attempt
      }
    }
  });
}