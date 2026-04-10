import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import { executeChatGenerateWithOperationRetry } from './chatGenerate.operation-retry';


// configuration
const MAX_CONTINUATION_TURNS = 10; // this is the outer loop count, on top of the default inner loop count of each operation (i.e. 10 for Anthropic, for a total of 100 steps)
const DEBUG_CONTINUATION = true;


// --- Dispatch Continuation Signal ---

/**
 * Signal thrown by provider parsers to request dispatch continuation.
 * Distinct from OperationRetrySignal: retry resets the current dispatch; continuation preserves and appends.
 *
 * Stage 1 (current): body mutation - Anthropic pause_turn.
 * Future stages: replaceDispatch (OpenAI background/resumable), waitStrategy, etc.
 */
export class DispatchContinuationSignal extends Error {
  override readonly name = 'DispatchContinuationSignal';

  constructor(readonly continuation: {
    readonly reason: string;
    mutateBody(body: Record<string, unknown>): Record<string, unknown>;
  }) {
    super(`dispatch-continuation: ${continuation.reason}`);
    Object.setPrototypeOf(this, DispatchContinuationSignal.prototype);
  }
}


// --- Continuation + Operation Retry + Dispatch ---

/**
 * Top-level chat generation entry point: [Anthropic]continuation (outer) -> operation retry (inner) -> dispatch.
 *
 * Handles dispatch continuations transparently. Provider parsers throw DispatchContinuationSignal;
 * this catches it, applies the body mutation to a fresh dispatch, and re-enters the operation retry
 * loop. Already-yielded particles are preserved - the client sees seamless continuation.
 *
 * Structurally similar to a client-side tool loop: when the model doesn't finish
 * (pause_turn instead of end_turn), accumulated content is sent back and the
 * model continues. Each individual dispatch can independently fail and be retried
 * by the inner operation retry loop without losing accumulated state.
 *
 * Composition:
 *  executeChatGenerateWithContinuation (catches DispatchContinuationSignal, mutates body, re-dispatches)
 *    -> executeChatGenerateWithOperationRetry (catches OperationRetrySignal, retries same dispatch)
 *      -> executeChatGenerateDispatch (single dispatch: connect, consume, yield particles)
 *         | particle pipeline: each yielded particle is piped through dispatch.particleTransform (e.g. Anthropic file inline)
 *        -> fetchWithAbortableConnectionRetry (retries HTTP connection)
 */
export async function* executeChatGenerateWithContinuation(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  streaming: boolean,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  let currentCreator = dispatchCreatorFn;

  for (let turn = 0; turn <= MAX_CONTINUATION_TURNS; turn++) {
    try {

      yield* executeChatGenerateWithOperationRetry(currentCreator, streaming, abortSignal, _d);
      return; // normal completion

    } catch (error) {
      // pass-through non-continuation errors (shall be rare, probably CSF errors or errors from exceeding retries, etc.)
      if (!(error instanceof DispatchContinuationSignal)) throw error;

      if (turn >= MAX_CONTINUATION_TURNS) {
        if (DEBUG_CONTINUATION) console.warn('[continuation] ❌ Max continuation turns reached', MAX_CONTINUATION_TURNS);
        throw error;
      }

      if (DEBUG_CONTINUATION) console.log(`[continuation] Turn ${turn + 1}/${MAX_CONTINUATION_TURNS}: ${error.continuation.reason}`);

      // Chain: each turn's creator calls the previous and applies its mutation.
      // The chained creator pattern composes mutations without an explicit list -
      // each mutateBody receives the body as-mutated by prior turns.
      const previousCreator = currentCreator;
      const { continuation } = error;

      currentCreator = async () => {
        const dispatch = await previousCreator();
        if ('body' in dispatch.request)
          dispatch.request.body = continuation.mutateBody(dispatch.request.body as Record<string, unknown>);
        return dispatch;
      };

      // Continuation checkpoint - client snapshots accumulator state and shows info placeholder
      yield { cg: 'aix-info', ait: 'flow-cont', text: `Continuing (${turn + 1}/${MAX_CONTINUATION_TURNS})...` };

      // -> Loop continues - already-yielded particles are preserved
    }
  }
}
