// internal types
type AixRetryDecision = false | { strategy: AixRetryStrategy; delayMs: number; attemptNumber: number };
type AixRetryStrategy = 'resume' | 'reconnect';
type AixAbortableDelayResult = 'completed' | 'aborted';


/**
 * Minimal retry logic for AIX _aixChatGenerateContent_LL.
 * - supports 'reconnect', for instance to loop while servers are busy
 * - supports 'resume', for instance to recover a network breakage while a responses is still being generated
 */
export class AixStreamRetry {
  private attempts = 0;

  constructor(
    private readonly maxResumeAttempts = 4,
    private readonly maxReconnectAttempts = 0, // disabled by default
  ) {}

  /** Determines if error is retryable and returns strategy + delay. */
  shallRetry(errorType: 'client-aborted' | 'net-disconnected' | 'request-exceeded' | 'response-captive' | 'net-unknown', hasUpstreamHandle: boolean): AixRetryDecision {

    // only retry supported errors
    const supportedErrors = [
      'net-disconnected',
      // 'net-unknown', // NOTE: we only support a hard disconnect for now, for safety
      // 'client-aborted', 'request-exceeded', 'response-captive' // absolutely not retryable
    ];
    if (!supportedErrors.includes(errorType))
      return false;

    // determine strategy
    const strategy: AixRetryStrategy = hasUpstreamHandle ? 'resume' : 'reconnect';
    const maxAttempts = strategy === 'resume' ? this.maxResumeAttempts : this.maxReconnectAttempts;

    // returns the strategy if below max attempts
    return this.attempts >= maxAttempts ? false : {
      strategy,
      delayMs: 500 * Math.pow(2, this.attempts), // exponential backoff: 500ms, 1s, 2s, 4s
      attemptNumber: this.attempts + 1, // 1-based for external use
    };
  }

  recordAttempt(): void {
    this.attempts++;
  }

  // isRetrying(): boolean {
  //   return this.attempts > 0;
  // }

  // getCurrentAttempt(): number {
  //   return this.attempts;
  // }

  /**
   * Abort-aware delay helper: waits for the specified delay or until abort signal fires.
   * @returns 'completed' if delay finished, 'aborted' if cancelled
   */
  static async abortableDelay(delayMs: number, abortSignal: AbortSignal): Promise<AixAbortableDelayResult> {
    if (abortSignal.aborted || delayMs <= 0) return delayMs === 0 ? 'completed' : 'aborted';
    return await new Promise<AixAbortableDelayResult>((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        resolve('aborted');
      };
      const timer = setTimeout(() => {
        abortSignal.removeEventListener('abort', onAbort);
        resolve('completed');
      }, delayMs);
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

}