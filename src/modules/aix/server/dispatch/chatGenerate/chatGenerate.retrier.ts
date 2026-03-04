import { abortableDelay } from '~/server/wire';

import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import { executeChatGenerate } from './chatGenerate.executor';


// configuration
const AIX_DISABLE_OPERATION_RETRY = false;
const AIX_DEBUG_OPERATION_RETRY = true; // prints the execution retries

/**
 * Maximum number of pause_turn continuation loops.
 * Prevents infinite loops when Anthropic server tools keep pausing.
 */
const AIX_MAX_PAUSE_CONTINUATIONS = 10;


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


// --- Pause-Turn Continuation, thrown by Anthropic parser when stop_reason is 'pause_turn' ---

/**
 * Thrown when Anthropic returns stop_reason: 'pause_turn' during server tool execution.
 * Carries the accumulated raw content blocks and container ID needed to build a continuation request.
 *
 * The continuation request must include:
 * - All accumulated content blocks from the response as an assistant message
 * - The container ID (string) for server-side state persistence
 */
export class PauseTurnContinuation extends Error {
  override readonly name = 'PauseTurnContinuation';

  /** Accumulated raw Anthropic content blocks from the response(s) */
  readonly accumulatedContent: unknown[];
  /** Container ID string from the response (response.container.id) */
  readonly containerId: string | undefined;

  constructor(accumulatedContent: unknown[], containerId: string | undefined) {
    super('Anthropic pause_turn - continuation required');
    this.accumulatedContent = accumulatedContent;
    this.containerId = containerId;
    Object.setPrototypeOf(this, PauseTurnContinuation.prototype);
  }
}


// --- Operation-level Retrier ---

/**
 * Wraps executeChatGenerate with operation-level retry for mid-stream errors
 * and pause_turn continuation for Anthropic server tools.
 *
 * When Anthropic returns stop_reason: 'pause_turn', the parser throws PauseTurnContinuation.
 * This function catches it and re-dispatches with accumulated content + container ID,
 * seamlessly continuing the streaming to the client.
 */
export async function* executeChatGenerateWithRetry(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  streaming: boolean,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  const maxAttempts = AIX_DISABLE_OPERATION_RETRY ? 1 : 4; // 1 = no retries (just immediate attempt), 4 = initial + 3 retries
  let attemptNumber = 1;

  // pause_turn continuation state - persists across retry attempts
  let pauseContinuationCount = 0;
  let currentDispatchCreatorFn = dispatchCreatorFn;

  while (true) {
    try {

      yield* executeChatGenerate(currentDispatchCreatorFn, streaming, abortSignal, _d, {
        retriesAvailable: attemptNumber < maxAttempts,
      });

      // success: log if we had retries before
      if (AIX_DEBUG_OPERATION_RETRY && attemptNumber > 1)
        console.log(`[operation.retrier] ✅ Success after ${attemptNumber} attempts`);
      if (pauseContinuationCount > 0)
        console.log(`[operation.retrier] ✅ Completed after ${pauseContinuationCount} pause_turn continuation(s)`);

      return;
    } catch (error: any) {

      // --- Handle pause_turn continuation (Anthropic server tools) ---
      if (error instanceof PauseTurnContinuation) {
        pauseContinuationCount++;

        if (pauseContinuationCount > AIX_MAX_PAUSE_CONTINUATIONS) {
          console.warn(`[operation.retrier] ⛔ pause_turn continuation limit reached (${AIX_MAX_PAUSE_CONTINUATIONS})`);
          // Don't throw - just end normally. The content accumulated so far has already been streamed.
          return;
        }

        console.log(`[operation.retrier] ⏸️ pause_turn continuation ${pauseContinuationCount}/${AIX_MAX_PAUSE_CONTINUATIONS} (content blocks: ${error.accumulatedContent.length}, container: ${error.containerId || 'none'})`);

        // Build a continuation dispatch creator that injects accumulated content + container
        const continuationContent = error.accumulatedContent;
        const continuationContainerId = error.containerId;
        currentDispatchCreatorFn = async () => {
          const baseDispatch = await dispatchCreatorFn();

          // Modify the request body for continuation
          if ('body' in baseDispatch.request) {
            const body = baseDispatch.request.body as Record<string, unknown>;
            const originalMessages = body.messages as unknown[];

            // Build continuation messages: [original_user_message, { role: 'assistant', content: accumulated_blocks }]
            body.messages = [
              originalMessages[0], // keep original user message
              { role: 'assistant', content: continuationContent },
            ];

            // Set container ID as a string for server-side state persistence
            if (continuationContainerId)
              body.container = continuationContainerId;
          }

          return baseDispatch;
        };

        // Reset retry counter for the new continuation turn
        attemptNumber = 1;

        // Continue the loop - no delay needed for pause_turn
        continue;
      }

      // CSF - pass through CSF AbortErrors (not needed, we do it client-side, aka outer-loop)
      // if (error instanceof DOMException && error.name === 'AbortError')
      //   throw error; // expected abort - pass through to be handled by parent loop and converted to terminating particle

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
