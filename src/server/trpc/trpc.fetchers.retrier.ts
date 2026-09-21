import { TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';
import { delayOrAbort } from '~/common/util/abortUtils';


const AIX_DEBUG_SERVER_RETRY = true;

// An upstream Retry-After is honored while the waits of one connect loop add up to this much; past it we give up at once
const RETRY_AFTER_BUDGET_MS = 60_000;

/**
 * Retry schedules, keyed by the class of the failure. One table for both retriers: the HTTP connect
 * retrier below, and the in-band operation retrier (chatGenerate.operation-retry.ts) which classifies
 * mid-stream provider errors to an HTTP-equivalent status and looks the class up here (upstreamRetryProfile).
 *
 * Budgets follow what each failure needs to clear, each retrier on its own: a blip clears in seconds, load shedding
 * in tens of seconds, a rate limit when its per-minute window rolls. Fewer, longer waits on rate limits: failed
 * requests can count against the limit. Both retriers heartbeat through the wait. `label` is what the user reads.
 */
const RETRY_PROFILES = {
  // network/DNS failures (never connected) -> fast retry
  network: {
    label: 'Connection issue',
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitterFactor: 0.25,
    maxAttempts: 3,      // 3 attempts total: immediate, then retry at ~0.5s, ~1s
  },
  // transient server faults (502, 503, in-band 5xx) -> a blip clears in seconds, or it's not clearing
  transient: {
    label: 'Temporary provider error',
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    jitterFactor: 0.5,    // 50% randomization
    maxAttempts: 4,      // 4 attempts total: immediate, then retry at ~1s, ~2s, ~4s (~7s budget)
  },
  // overloaded (529, 503 "overloaded") -> the provider is shedding load, it clears in tens of seconds
  overloaded: {
    label: 'Provider is busy',
    baseDelayMs: 1000,
    maxDelayMs: 15000,
    jitterFactor: 0.25,
    maxAttempts: 6,      // 6 attempts total: immediate, then retry at ~1s, ~2s, ~4s, ~8s, ~15s (~30s budget)
  },
  // rate limited (429) -> per-minute windows: cover most of a minute, in few attempts (#1210, #1099)
  rateLimited: {
    label: 'Provider rate limit',
    baseDelayMs: 2000,
    maxDelayMs: 20000,
    jitterFactor: 0.25,   // N Beam rays hit the same limit at once: spread them
    maxAttempts: 6,      // 6 attempts total: immediate, then retry at ~2s, ~4s, ~8s, ~16s, ~20s (~50s budget)
  },
} as const;

type RetryProfile = typeof RETRY_PROFILES[keyof typeof RETRY_PROFILES];

/**
 * Class of a retryable failure from its HTTP(-equivalent) status. Used by the connect retrier (real
 * status) and by the in-band operation retrier (status the parser assigned to a mid-stream error).
 * The in-band callers already established the error is transient, hence the fallback.
 */
export function upstreamRetryProfile(httpStatus?: number): RetryProfile {
  return httpStatus === 429 ? RETRY_PROFILES.rateLimited
    : httpStatus === 529 ? RETRY_PROFILES.overloaded
      : RETRY_PROFILES.transient;
}

/**
 * Backoff for the wait before `attemptNumber + 1`: exponential from the profile base, capped, with symmetric jitter.
 */
export function upstreamRetryBackoffMs(profile: RetryProfile, attemptNumber: number): number {
  let delayMs = Math.min(profile.baseDelayMs * Math.pow(2, attemptNumber - 1), profile.maxDelayMs);
  if (profile.jitterFactor > 0) {
    const jitterRange = delayMs * profile.jitterFactor;
    delayMs = Math.round(delayMs + (Math.random() * 2 - 1) * jitterRange); // ±jitterRange
  }
  return Math.max(1, delayMs);
}

/**
 * 429 errors matching these patterns are NOT retried - they indicate permanent
 * conditions (billing, quota, access) that won't resolve on their own.
 * Tested against the full TRPCFetcherError.message (which includes the module prefix).
 */
const _429_RETRY_DENYLIST: { test: string | RegExp; label: string }[] = [
  // Quota/billing exhausted - user needs to add credits or upgrade plan
  { test: /quota|billing/i, label: 'quota/billing' },
  // [OpenAI] Request too large for model's TPM limit - e.g. "Request too large for o3 ... Limit 30000, Requested 56108"
  { test: /request too large|limit \d+, requested \d+/i, label: 'request-too-large' },
  // [Anthropic research preview] Zero rate limit - org doesn't have access to the model
  { test: 'rate limit of 0 input tokens per minute', label: 'zero-rate-limit (no model access)' },
  // [Z.ai] Insufficient balance - prepaid credits exhausted
  { test: 'Insufficient balance or no resource package', label: 'insufficient-balance (Z.ai)' },
  // [Sakana.ai / OpenAI-compat] Prepaid credit balance exhausted - user must add credits.
  // Upstream 429 body: {"error":{"message":"Prepaid credit balance is exhausted","type":"usage_limit_reached",...}}
  { test: 'credit balance is exhausted', label: 'credit-exhausted (Sakana.ai)' },
];


/**
 * 429 upstream error codes that are NOT retried: spend caps and exhausted credits share the 429 status (and for
 * Anthropic the error type too) with temporary rate limits, and their messages carry no common wording.
 * Tested against TRPCFetcherError.httpErrorCode.
 * - OpenAI: https://developers.openai.com/api/docs/guides/error-codes
 * - Anthropic: https://platform.claude.com/docs/en/api/rate-limits (sent without a retry-after header)
 */
const _429_RETRY_DENY_CODES: readonly string[] = [
  'credit_balance_exhausted',            // [OpenAI] no prepaid credits remaining
  'organization_spend_limit_exceeded',   // [OpenAI] org monthly spend limit
  'project_spend_limit_exceeded',        // [OpenAI] project monthly spend limit
  'organization_usage_limit_exceeded',   // [OpenAI] OpenAI-assigned monthly usage limit
  'enforced_spend_limit_reached',        // [Anthropic] usage tier monthly spend cap
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
      // Denylist by upstream code: permanent conditions the message wording does not reveal
      if (error.httpErrorCode && _429_RETRY_DENY_CODES.includes(error.httpErrorCode)) {
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] 429 not retryable: ${error.httpErrorCode}`);
        return null;
      }

      // Denylist: 429 errors that should NOT be retried (user action required, or request won't change)
      const denyMatch = _429_RETRY_DENYLIST.find(({ test }) =>
        typeof test === 'string' ? error.message.includes(test) : test.test(error.message),
      );
      if (denyMatch) {
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] 429 not retryable: ${denyMatch.label}`);
        return null;
      }
      return RETRY_PROFILES.rateLimited; // Retry temporary rate limits
    }

    // 529 Overloaded (Anthropic)
    if (error.httpStatus === 529)
      return RETRY_PROFILES.overloaded;

    // retriable server errors
    const retryCodes = [
      503, // Service Unavailable <- main one to retry
      502, // Bad Gateway
    ];
    if (retryCodes.includes(error.httpStatus)) {
      // [Gemini] 503 "The model is overloaded. Please try again later." is load shedding wearing a 503
      if (error.httpStatus === 503 && /overloaded/i.test(error.message))
        return RETRY_PROFILES.overloaded;
      return RETRY_PROFILES.transient;
    }
  }

  return null;
}


/**
 * Describes a retry attempt.
 */
export type RetryAttempt = {
  reason: string; // user-facing, from the retry profile
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
export async function fetchWithAbortableConnectionRetry<T>(operationFn: () => Promise<T>, abortSignal: AbortSignal, onRetry?: (retryInfo: RetryAttempt) => void): Promise<T> {
  let attemptNumber = 1;
  let waitedMs = 0;

  while (true) {
    try {

      // normal attempt, expecting success and setting the promise value
      const result = await operationFn();
      if (AIX_DEBUG_SERVER_RETRY && attemptNumber > 1) {
        // NOTE: console.warn to overwrite the lower level [POST/GET] warning logs
        console.warn(`[fetchers.retrier] ✅ Success after ${attemptNumber} attempts`);
      }
      return result;

    } catch (error: any) {

      // aborted: forward the error immediately
      if (abortSignal.aborted) {
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] ⛔ User aborted at attempt ${attemptNumber}`);
        throw error;
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
        throw error;
      }

      // exhausted attempts
      if (attemptNumber >= rp.maxAttempts) {
        if (AIX_DEBUG_SERVER_RETRY) {
          const errorInfo = !(error instanceof TRPCFetcherError) ? '' : `(${error.category}${error.httpStatus ? `, HTTP ${error.httpStatus}` : ''})`;
          console.warn(`[fetchers.retrier] ⚠️ All ${rp.maxAttempts - 1} retry attempts exhausted ${errorInfo}`);
        }
        // gave up after `attemptNumber` total attempts (incl. the original); the `-1` is a magic constant to signal end of retries
        onRetry?.({ reason: rp.label, attempt: attemptNumber, maxAttempts: attemptNumber, causeHttp: error instanceof TRPCFetcherError ? error.httpStatus : undefined, causeConn: 'ERR', delayMs: -1 });
        throw error;
      }

      // log retry decision with error details
      if (AIX_DEBUG_SERVER_RETRY) {
        const errorInfo = error instanceof TRPCFetcherError
          ? `(${error.category}${error.httpStatus ? `, HTTP ${error.httpStatus}` : ''})`
          : '';
        console.log(`[fetchers.retrier] 🔄 Retryable error ${errorInfo} - ${rp.label}`);
      }

      // The upstream's own wait (Retry-After) beats our schedule: a retry before it fails, and failed requests can count
      // against the limit. Past this loop's budget it is not worth holding the user: the upstream message says when to come back.
      const retryAfterMs = error instanceof TRPCFetcherError ? error.httpRetryAfterMs : undefined;
      if (retryAfterMs !== undefined && waitedMs + retryAfterMs > RETRY_AFTER_BUDGET_MS) {
        if (AIX_DEBUG_SERVER_RETRY)
          console.log(`[fetchers.retrier] ❌ Not retrying: upstream asks to wait ${Math.round(retryAfterMs / 1000)}s (waited ${Math.round(waitedMs / 1000)}s so far)`);
        throw error;
      }

      // exponential backoff with jitter; with a Retry-After: never earlier than asked (jitter upward only), never faster than our own schedule
      const backoffMs = upstreamRetryBackoffMs(rp, attemptNumber);
      const delayMs = retryAfterMs === undefined ? backoffMs
        : Math.max(backoffMs, Math.round(retryAfterMs * (1 + Math.random() * rp.jitterFactor)));
      waitedMs += delayMs;

      attemptNumber++;
      if (AIX_DEBUG_SERVER_RETRY)
        console.log(`[fetchers.retrier] 🔄 -> Retrying attempt ${attemptNumber - 1}/${rp.maxAttempts - 1} after ${delayMs}ms delay`);

      // let the caller know about the retry attempt
      onRetry?.({
        reason: rp.label,
        attempt: attemptNumber,
        maxAttempts: rp.maxAttempts,
        delayMs,
        causeHttp: error instanceof TRPCFetcherError ? error.httpStatus : undefined,
        causeConn: error instanceof TRPCFetcherError ? error.category : undefined,
      });

      // abortable wait
      if (await delayOrAbort(delayMs, abortSignal) === 'aborted')
        throw error;

      // -> loop continues for next attempt
    }
  }
}