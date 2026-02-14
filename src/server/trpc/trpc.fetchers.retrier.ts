import { TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';
import { abortableDelay } from '~/server/wire';


const AIX_DEBUG_SERVER_RETRY = true;

const RETRY_PROFILES = {
  // network/DNS failures (never connected) -> fast retry
  network: {
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitterFactor: 0.25,
    maxAttempts: 3,      // 3 attempts total: immediate, then retry at ~0.5s, ~1s
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
 * 429 errors matching these patterns are NOT retried — they indicate permanent
 * conditions (billing, quota, access) that won't resolve on their own.
 * Tested against the full TRPCFetcherError.message (which includes the module prefix).
 */
const _429_RETRY_DENYLIST: { test: string | RegExp; label: string }[] = [
  // Quota/billing exhausted — user needs to add credits or upgrade plan
  { test: /quota|billing/i, label: 'quota/billing' },
  // [OpenAI] Request too large for model's TPM limit — e.g. "Request too large for o3 ... Limit 30000, Requested 56108"
  { test: /request too large|limit \d+, requested \d+/i, label: 'request-too-large' },
  // [Anthropic research preview] Zero rate limit — org doesn't have access to the model
  { test: 'rate limit of 0 input tokens per minute', label: 'zero-rate-limit (no model access)' },
  // [Z.ai] Insufficient balance — prepaid credits exhausted
  { test: 'Insufficient balance or no resource package', label: 'insufficient-balance (Z.ai)' },
];


/**
 * Determines if a dispatch error is retryable and which profile to use.
 */
function selectRetryProfile(error: TRPCFetcherError | unknown): RetryProfile | null {
  if (!(error instanceof TRPCFetcherError))
    return null;

  if (error.category === 'connection')
    return RETRY_PROFILES.network; // DNS, TCP, timeouts, ... doesn't connect

  if (error.category === 'http' && error.httpStatus) {
    // 429 Too Many Requests: distinguish quota errors (don't retry) from rate limits (retry)
    if (error.httpStatus === 429) {
      // Denylist: 429 errors that should NOT be retried (user action required, or request won't change)
      const denyMatch = _429_RETRY_DENYLIST.find(({ test }) =>
        typeof test === 'string' ? error.message.includes(test) : test.test(error.message),
      );
      if (denyMatch) {
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] 429 not retryable: ${denyMatch.label}`);
        return null;
      }
      return RETRY_PROFILES.server; // Retry temporary rate limits
    }

    // retriable server errors
    const retryCodes = [
      503, // Service Unavailable <- main one to retry
      502, // Bad Gateway
    ];
    if (retryCodes.includes(error.httpStatus))
      return RETRY_PROFILES.server;
  }

  return null;
}


/**
 * Describes a retry attempt.
 */
export type RetryAttempt = {
  attempt: number; // 2, 3, ...maxAttempts
  maxAttempts: number;
  delayMs: number;
  causeHttp?: number;
  causeConn?: string;
};


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
 * @param onRetry Optional callback invoked before each retry attempt
 * @returns Promise that resolves with the successful result or rejects with the final error
 */
export function createRetryablePromise<T>(operationFn: () => Promise<T>, abortSignal: AbortSignal, onRetry?: (retryInfo: RetryAttempt) => void): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    let attemptNumber = 1;

    while (true) {
      try {

        // normal attempt, expecting success and setting the promise value
        const result = await operationFn();
        if (AIX_DEBUG_SERVER_RETRY && attemptNumber > 1) {
          // NOTE: console.warn to overwrite the lower level [POST/GET] warning logs
          console.warn(`[fetchers.retrier] ✅ Success after ${attemptNumber} attempts`);
        }
        resolve(result);
        return;

      } catch (error: any) {

        // aborted: forward the error immediately
        if (abortSignal.aborted) {
          if (AIX_DEBUG_SERVER_RETRY)
            console.log(`[fetchers.retrier] ⛔ User aborted at attempt ${attemptNumber}`);
          reject(error);
          return;
        }

        // check if error is retryable
        const rp = selectRetryProfile(error);

        // not retryable
        if (!rp) {
          if (AIX_DEBUG_SERVER_RETRY) {
            const errorInfo = !(error instanceof TRPCFetcherError) ? '' : `(${error.category}${error.httpStatus ? `, HTTP ${error.httpStatus}` : ''})`;
            console.log(`[fetchers.retrier] ❌ Not retryable ${errorInfo}}`); // removing the duplicate error message
            // console.log(`[fetchers.retrier] ❌ Not retryable ${errorInfo}: ${error?.message || error}`);
          }
          reject(error);
          return;
        }

        // exhausted attempts
        if (attemptNumber >= rp.maxAttempts) {
          if (AIX_DEBUG_SERVER_RETRY) {
            const errorInfo = !(error instanceof TRPCFetcherError) ? '' : `(${error.category}${error.httpStatus ? `, HTTP ${error.httpStatus}` : ''})`;
            console.warn(`[fetchers.retrier] ⚠️ All ${rp.maxAttempts - 1} retry attempts exhausted ${errorInfo}`);
          }
          reject(error);
          return;
        }

        // log retry decision with error details
        if (AIX_DEBUG_SERVER_RETRY) {
          const errorInfo = error instanceof TRPCFetcherError
            ? `(${error.category}${error.httpStatus ? `, HTTP ${error.httpStatus}` : ''})`
            : '';
          const profileType = rp === RETRY_PROFILES.network ? 'network' : 'server';
          console.log(`[fetchers.retrier] 🔄 Retryable error ${errorInfo} - using '${profileType}' profile`);
          // console.log(`[fetchers.retrier] 🔄 Retryable error ${errorInfo} - using ${profileType} profile: ${error?.message || error}`);
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
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] 🔄 -> Retrying attempt ${attemptNumber - 1}/${rp.maxAttempts - 1} after ${delayMs}ms delay`);

        // let the caller know about the retry attempt
        onRetry?.({
          attempt: attemptNumber,
          maxAttempts: rp.maxAttempts,
          delayMs,
          causeHttp: error instanceof TRPCFetcherError ? error.httpStatus : undefined,
          causeConn: error instanceof TRPCFetcherError ? error.category : undefined,
        });

        // abortable wait
        if (await abortableDelay(delayMs, abortSignal)) {
          reject(error);
          return;
        }

        // -> loop continues for next attempt
      }
    }
  });
}