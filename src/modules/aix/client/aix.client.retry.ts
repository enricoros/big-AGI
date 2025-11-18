import type { DMessageGenerator } from '~/common/stores/chat/chat.message';


// configuration
const RETRY_PROFILES = {
  network: { baseDelay: 500, maxDelay: 8000, jitter: 0.25 },    // Network interruptions
  server: { baseDelay: 1000, maxDelay: 30000, jitter: 0.5 },    // Server overload: 429, 503, 502
  transient: { baseDelay: 200, maxDelay: 2000, jitter: 0.1 },   // Quick transient errors: other 5xx
} as const;


// internal types
type RetryDecision = false | { strategy: RetryStrategy; delayMs: number; attemptNumber: number };
type RetryStrategy = 'resume' | 'reconnect';
type StepResult = 'completed' | 'aborted';

type _ResumeHandle = DMessageGenerator['upstreamHandle'];


/**
 * Retry/resume logic for AIX _aixChatGenerateContent_LL.
 * - supports 'reconnect' for server busy/overload scenarios with intelligent backoff
 * - supports 'resume' for network interruptions with upstream handle management
 */
export class AixStreamRetry {

  private mAttempts = 0;
  private mResumeHandle: _ResumeHandle;

  constructor(
    private readonly maxReconnectAttempts = 0,
    private readonly maxResumeAttempts = 0,
  ) {
  }

  // resume handle management

  get resumeHandle() {
    return this.mResumeHandle;
  }

  set resumeHandle(handle: _ResumeHandle | undefined) {
    if (!handle) return;
    this.mResumeHandle = handle;
  }

  /**
   * Determines if error is retryable and returns strategy + delay
   */
  shallRetry(errorType: 'client-aborted' | 'net-disconnected' | 'request-exceeded' | 'response-captive' | 'net-unknown', maybeStatusCode?: number): RetryDecision {

    // determine strategy - based on availability of resume handle
    const strategy: RetryStrategy = this.mResumeHandle ? 'resume' : 'reconnect';
    const maxAttempts = strategy === 'resume' ? this.maxResumeAttempts : this.maxReconnectAttempts;

    // check if we've exceeded max attempts
    if (this.mAttempts >= maxAttempts)
      return false;


    // retry profile selection
    let profile;
    switch (errorType) {

      // never retry these
      case 'client-aborted':
      case 'request-exceeded':
      case 'response-captive':
        return false;

      case 'net-disconnected':
        profile = RETRY_PROFILES.network; // Network disconnections are always retryable
        break;

      case 'net-unknown':
        if (typeof maybeStatusCode !== 'number')
          return false;

        // unknown errors: check status code (if any) to determine if retryable
        if (maybeStatusCode === 429 || maybeStatusCode === 503 || maybeStatusCode === 502)
          profile = RETRY_PROFILES.server;  // Server overload/unavailable - use longer backoff
        else if (maybeStatusCode >= 500)
          profile = RETRY_PROFILES.transient; // Other 5xx errors - quick retry with transient profile
        else
          return false;
        break;

      default:
        const _exhaustiveCheck: never = errorType;
        console.warn(`[DEV] AixStreamRetry.shallRetry: unhandled errorType '${errorType}'`);
        return false;
    }

    // calculate delay with exponential backoff and jitter
    let delayMs = Math.min(profile.baseDelay * Math.pow(2, this.mAttempts), profile.maxDelay);

    // add jitter to prevent thundering herd
    if (profile.jitter > 0) {
      const jitterAmount = delayMs * profile.jitter * (Math.random() * 2 - 1);
      delayMs = Math.max(Math.round(delayMs + jitterAmount), 1);
    }

    // returns the strategy if below max attempts
    return {
      strategy,
      delayMs,
      attemptNumber: this.mAttempts + 1, // 1-based for external use
    };
  }

  /**
   * Performs a delayed step with abort support.
   */
  async delayedStep(delayMs: number, abortSignal: AbortSignal): Promise<StepResult> {
    if (abortSignal.aborted || delayMs <= 0) return delayMs === 0 ? 'completed' : 'aborted';
    return await new Promise<StepResult>((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve('aborted');
      };
      const timer = setTimeout(() => {
        abortSignal.removeEventListener('abort', onAbort);
        // record the attempt only after successful delay completion
        this.mAttempts++;
        resolve('completed');
      }, delayMs);
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

}