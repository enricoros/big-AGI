import { upstreamRetryBackoffMs, upstreamRetryProfile } from '~/server/trpc/trpc.fetchers.retrier';
import { delayOrAbort } from '~/common/util/abortUtils';

import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch, ChatGenerateParseContext } from './chatGenerate.dispatch';
import { DispatchContinuationSignal } from './chatGenerate.continuation';
import { executeChatGenerateDispatch } from './chatGenerate.executor';
import { heartbeatsWhileAwaiting } from '../heartbeatsWhileAwaiting';


// configuration
const AIX_DISABLE_OPERATION_RETRY = false;
const AIX_DEBUG_OPERATION_RETRY = true; // prints the execution retries


// --- Operation Retry Signal, throw this from any Parser to get the whole operation retried ---

/**
 * Signal thrown by parsers when a retryable error occurs mid-stream (e.g., Anthropic overloaded_error).
 * Caught by the operation-level retrier, which resets particles and retries the entire dispatch.
 */
export class OperationRetrySignal extends Error {
  override readonly name = 'OperationRetrySignal';

  readonly reason: string;
  readonly causeHttp?: number;
  readonly causeConn?: string;

  constructor(reason: string, options?: { causeHttp?: number; causeConn?: string }) {
    super(reason); // keep message as reason for Error compatibility
    this.reason = reason;
    this.causeHttp = options?.causeHttp;
    this.causeConn = options?.causeConn;
    Object.setPrototypeOf(this, OperationRetrySignal.prototype);
  }
}


// --- Operation-level Retrier ---

/**
 * Wraps executeChatGenerateDispatch with operation-level retry for mid-stream errors.
 * Retries entire operation when OperationRetrySignal is thrown (e.g., Anthropic overloaded_error).
 *
 * The attempt budget depends on the class of the error (see RETRY_PROFILES), which is only
 * known when the parser classifies it: hence parsers ask `hasRetriesForHttpStatus(causeHttp)` before throwing, and otherwise
 * surface the error themselves, with their own wording and log level.
 */
export async function* executeChatGenerateWithOperationRetry(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  let attemptNumber = 1;
  const maxAttemptsFor = (causeHttp?: number) => AIX_DISABLE_OPERATION_RETRY ? 1 : upstreamRetryProfile(causeHttp).maxAttempts;
  const parseContext: ChatGenerateParseContext = {
    hasRetriesForHttpStatus: (causeHttp) => attemptNumber < maxAttemptsFor(causeHttp),
  };

  while (true) {
    try {

      yield* executeChatGenerateDispatch(dispatchCreatorFn, abortSignal, _d, parseContext);

      // success: log if we had retries before
      if (AIX_DEBUG_OPERATION_RETRY && attemptNumber > 1)
        console.log(`[operation.retrier] ✅ Success after ${attemptNumber} attempts`);

      return;
    } catch (error: any) {

      // CSF - pass through CSF AbortErrors (not needed, we do it client-side, aka outer-loop)
      // if (error instanceof DOMException && error.name === 'AbortError')
      //   throw error; // expected abort - pass through to be handled by parent loop and converted to terminating particle

      // Pass through continuation signals silently to the outer wrapper
      if (error instanceof DispatchContinuationSignal) throw error; // expected: outer loop will continue generation

      // Only OperationRetrySignal is handled here. All other errors are unexpected.
      if (!(error instanceof OperationRetrySignal)) {
        if (AIX_DEBUG_OPERATION_RETRY)
          console.warn(`[operation.retrier] ⚠️ Unexpected error type (expected OperationRetrySignal): ${error?.name || 'unknown'}`);
        throw error; // unexpected: executeChatGenerate shall convert exceptions to yielded particles
      }

      // sanity: exhausted attempts - must be a Parser error - as it shall have not thrown in this case (hasRetriesForHttpStatus was false)
      const profile = upstreamRetryProfile(error.causeHttp);
      const maxAttempts = maxAttemptsFor(error.causeHttp);
      if (attemptNumber >= maxAttempts) {
        if (AIX_DEBUG_OPERATION_RETRY)
          console.warn(`[operation.retrier] ⚠️ Retry error on final attempt (parser bug?) - ${error?.message || error}`);
        throw error; // out of attempts
      }

      // retry: backoff per profile, jittered (see RETRY_PROFILES)
      const delayMs = upstreamRetryBackoffMs(profile, attemptNumber);
      if (AIX_DEBUG_OPERATION_RETRY)
        console.log(`[operation.retrier] 🔄 Retrying after ${delayMs}ms (attempt ${attemptNumber}/${maxAttempts - 1}, http ${error.causeHttp ?? '-'}): ${error?.message || error}`);

      attemptNumber++;

      // -> retry-server-operation - parent loop of retry-server-dispatch
      yield {
        cg: 'aix-retry-reset', rScope: 'srv-op',
        rClearStrategy: 'since-checkpoint', // clear current-attempt content while preserving prior continuation turns
        reason: profile.label, // calm and short for the user; the vendor text is in the server log above, and in the final error if retries run out
        attempt: attemptNumber, maxAttempts: maxAttempts, delayMs: delayMs,
        ...(error.causeHttp ? { causeHttp: error.causeHttp } : undefined),
        ...(error.causeConn ? { causeConn: error.causeConn } : undefined),
      };

      // If aborted during delay, let next attempt detect it and create proper terminating particle
      // (throwing here would bypass executor's particle-based messaging contract)
      // Heartbeats keep the intake stream alive through the longer waits.
      yield* heartbeatsWhileAwaiting(delayOrAbort(delayMs, abortSignal));

      // -> loop continues for next attempt
    }
  }
}
