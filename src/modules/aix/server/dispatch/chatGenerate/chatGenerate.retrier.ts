import { abortableDelay } from '~/server/wire';

import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import { executeChatGenerate } from './chatGenerate.executor';


// configuration
const AIX_DISABLE_OPERATION_RETRY = false;
const AIX_DEBUG_OPERATION_RETRY = true; // prints the execution retries


// --- Retriable Error, throw this from any Parser to get the whole operation retried ---

/**
 * Thrown when a retryable error occurs during streaming (e.g., Anthropic overloaded_error).
 * Signals the operation should be retried at a higher level.
 */
export class RequestRetryError extends Error {
  override readonly name = 'RequestRetryError';

  readonly reason: string;
  readonly causeHttp?: number;
  readonly causeConn?: string;

  constructor(reason: string, options?: { causeHttp?: number; causeConn?: string }) {
    super(reason); // keep message as reason for Error compatibility
    this.reason = reason;
    this.causeHttp = options?.causeHttp;
    this.causeConn = options?.causeConn;
    Object.setPrototypeOf(this, RequestRetryError.prototype);
  }
}


// --- Operation-level Retrier ---

/**
 * Wraps executeChatGenerate with operation-level retry for mid-stream errors.
 * Retries entire operation when RequestRetryError is thrown (e.g., Anthropic overloaded_error).
 */
export async function* executeChatGenerateWithRetry(
  dispatchCreatorFn: () => ChatGenerateDispatch,
  streaming: boolean,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  const maxAttempts = AIX_DISABLE_OPERATION_RETRY ? 1 : 4; // 1 = no retries (just immediate attempt), 4 = initial + 3 retries
  let attemptNumber = 1;

  while (true) {
    try {

      yield* executeChatGenerate(dispatchCreatorFn, streaming, abortSignal, _d, {
        retriesAvailable: attemptNumber < maxAttempts,
      });

      // success: log if we had retries before
      if (AIX_DEBUG_OPERATION_RETRY && attemptNumber > 1)
        console.log(`[operation.retrier] ✅ Success after ${attemptNumber} attempts`);

      return;
    } catch (error: any) {

      // NOTE: executeChatGenerate only throws RequestRetryError. All other errors (abort, network, parsing)
      // are handled internally with terminating particles. However we do a defensive check here just in case.
      if (!(error instanceof RequestRetryError)) {
        if (AIX_DEBUG_OPERATION_RETRY)
          console.warn(`[operation.retrier] ⚠️ Unexpected error type (expected RequestRetryError): ${error?.name || 'unknown'}`);
        throw error; // unexpected
      }

      // sanity: exhausted attempts - must be a Parser error - as it shall have not thrown in this case
      if (attemptNumber >= maxAttempts) {
        if (AIX_DEBUG_OPERATION_RETRY)
          console.warn(`[operation.retrier] ⚠️ Retry error on final attempt (parser bug?) - ${error?.message || error}`);
        throw error; // unexpected
      }

      // retry: backoff: 1s, 2s, 4s (capped at 10s)
      const delayMs = Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000);
      if (AIX_DEBUG_OPERATION_RETRY)
        console.log(`[operation.retrier] 🔄 Retrying after ${delayMs}ms (attempt ${attemptNumber}/${maxAttempts - 1}): ${error?.message || error}`);

      attemptNumber++;

      // -> retry-server-operation - parent loop of retry-server-dispatch
      yield {
        cg: 'retry-reset', rScope: 'srv-op',
        rShallClear: true, // requesting a reassembler reset, however there are likely low/no particles yet
        reason: error.reason || error.message || 'retrying operation',
        attempt: attemptNumber, maxAttempts: maxAttempts, delayMs: delayMs,
        ...(error.causeHttp ? { causeHttp: error.causeHttp } : undefined),
        ...(error.causeConn ? { causeConn: error.causeConn } : undefined),
      };

      // If aborted during delay, let next attempt detect it and create proper terminating particle
      // (throwing here would bypass executor's particle-based messaging contract)
      await abortableDelay(delayMs, abortSignal);

      // -> loop continues for next attempt
    }
  }
}
