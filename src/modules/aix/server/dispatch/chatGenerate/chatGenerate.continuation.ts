import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import type { executeChatGenerate } from './chatGenerate.executor';


// configuration
const CONTINUATION_MAX_TURNS = 10;
const CONTINUATION_DEBUG = true;


// --- Framework-level Dispatch Continuation ---

/**
 * Provider-agnostic body continuation - the framework abstraction for re-dispatching.
 *
 * Stage 1: `mutateBody` - same endpoint, modified body (Anthropic pause_turn)
 * Future stages could add:
 * - `replaceDispatch` - different endpoint entirely (OpenAI background resume)
 * - `waitStrategy` - polling/waiting before re-dispatch
 */
export interface DispatchContinuation {
  readonly reason: string;

  /** Apply continuation to the existing dispatch body (same endpoint, modified body) */
  mutateBody(body: Record<string, unknown>): Record<string, unknown>;
}


/**
 * Signal thrown by provider parsers to request dispatch continuation.
 * Distinct from `RequestRetryError`:
 * - Retry: resets particles, retries from scratch (error recovery)
 * - Continuation: preserves particles, appends new content (extending output)
 */
export class DispatchContinuationSignal extends Error {
  override readonly name = 'DispatchContinuationSignal';

  constructor(readonly continuation: DispatchContinuation) {
    super(`dispatch-continuation: ${continuation.reason}`);
    Object.setPrototypeOf(this, DispatchContinuationSignal.prototype);
  }
}


// --- Async Generator Wrapper ---

/**
 * Wraps `executeChatGenerate` to handle dispatch continuations transparently.
 *
 * Provider parsers throw `DispatchContinuationSignal`; this wrapper catches it,
 * applies the continuation's body mutation, and re-enters the executor.
 * Already-yielded particles are preserved - the client sees seamless continuation.
 *
 * Separate from retry (retry resets particles; continuation appends particles).
 */
export async function* withDispatchContinuation(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  executeFn: typeof executeChatGenerate,
  streaming: boolean,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
  parseContext: { retriesAvailable: boolean },
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  let currentCreator = dispatchCreatorFn;

  for (let turn = 0; turn <= CONTINUATION_MAX_TURNS; turn++) {
    try {

      yield* executeFn(currentCreator, streaming, abortSignal, _d, parseContext);
      return; // normal completion

    } catch (error) {
      if (!(error instanceof DispatchContinuationSignal))
        throw error; // not ours - let retrier or caller handle it

      if (turn >= CONTINUATION_MAX_TURNS) {
        console.warn(`[continuation] Max turns (${CONTINUATION_MAX_TURNS}) exceeded for reason: ${error.continuation.reason}`);
        throw error;
      }

      if (CONTINUATION_DEBUG)
        console.log(`[continuation] Turn ${turn + 1}/${CONTINUATION_MAX_TURNS}: ${error.continuation.reason}`);

      // Build a new dispatch creator that applies the continuation's body mutation
      const { continuation } = error;
      const previousCreator = currentCreator;

      currentCreator = async () => {
        // Start from the previous creator's state (chained mutations for multi-turn)
        const dispatch = await previousCreator();
        const request = dispatch.request as { body: Record<string, unknown> };
        request.body = continuation.mutateBody(request.body);
        return dispatch;
      };

      // Loop continues - already-yielded particles are preserved
    }
  }
}
