import { delayOrAbort } from '~/common/util/abortUtils';

import type { DAixIssue } from '../shared/aix.issues';
import { aixIssuePolicy } from '../shared/aix.issues.policy';


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


/**
 * Retry/resume logic for AIX _aixChatGenerateContent_LL.
 * - supports 'reconnect' for server busy/overload scenarios with intelligent backoff
 * - supports 'resume' for network interruptions with upstream handle management
 */
export class AixStreamRetry {

  private mAttempts = 0;

  constructor(
    private readonly maxReconnectAttempts = 0,
    private readonly maxResumeAttempts = 0,
  ) {
  }

  /**
   * Determines if the issue is retryable (its policy's recovery, aix.issues.policy.ts) and returns strategy + delay.
   * The resume handle (if any) determines the strategy: resume if available, reconnect otherwise.
   */
  shallRetry(issue: DAixIssue, hasResumeHandle?: boolean): RetryDecision {

    // determine strategy - based on availability of resume handle
    const strategy: RetryStrategy = hasResumeHandle ? 'resume' : 'reconnect';
    const maxAttempts = strategy === 'resume' ? this.maxResumeAttempts : this.maxReconnectAttempts;

    // check if we've exceeded max attempts
    if (this.mAttempts >= maxAttempts)
      return false;


    // retry profile selection
    let profile;
    switch (aixIssuePolicy(issue).recovery) {

      case 'retry':
      case 'resume':
        profile = RETRY_PROFILES.network;
        break;

      case 'backoff':
        if (issue.httpStatus === 429 || issue.httpStatus === 503 || issue.httpStatus === 502)
          profile = RETRY_PROFILES.server;  // Server overload/unavailable - use longer backoff
        else
          profile = RETRY_PROFILES.transient; // Other 5xx errors - quick retry with transient profile
        break;

      // never retry these: the user, a report, a rephrase or nothing is the way out; a reroute is the other path
      // (Direct Connection on or off), and the same path runs into the same limit
      case 'reroute':
      case 'user':
      case 'rephrase':
      case 'report':
      case 'none':
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
    if (await delayOrAbort(delayMs, abortSignal) === 'aborted')
      return 'aborted';
    // record the attempt only after successful delay completion
    this.mAttempts++;
    return 'completed';
  }

}