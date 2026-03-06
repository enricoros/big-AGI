import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import { executeChatGenerate } from './chatGenerate.executor';


// configuration
const MAX_DISPATCH_MUTATIONS = 10;


// --- Framework-level Dispatch Mutation ---

/**
 * Provider-agnostic body mutation interface.
 * Any provider can define mutations for retransmission scenarios
 * (e.g., Anthropic pause_turn, token refresh, context shift).
 *
 * Mutations are chainable: when multiple pause_turn events occur across turns,
 * each mutation's `mutateBody` receives the body as-mutated by prior turns,
 * allowing content to accumulate correctly.
 */
export interface DispatchBodyMutation {
  readonly reason: string;
  mutateBody(body: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Signal thrown by provider parsers to request body mutation + retransmission.
 * Distinct from RequestRetryError: retry resets particles (error recovery),
 * mutation appends particles (extending output).
 */
export class DispatchMutationSignal extends Error {
  override readonly name = 'DispatchMutationSignal';

  constructor(readonly mutation: DispatchBodyMutation) {
    super(`dispatch-mutation: ${mutation.reason}`);
    Object.setPrototypeOf(this, DispatchMutationSignal.prototype);
  }
}


// --- Async Generator Wrapper ---

/**
 * Wraps executeChatGenerate to handle dispatch mutations transparently.
 * Provider parsers throw DispatchMutationSignal; this wrapper catches it,
 * mutates the dispatch body, and re-enters - particles flow seamlessly.
 *
 * Separate from retry (retry resets particles; mutation appends particles).
 *
 * Multi-turn support: mutations are chained - each new mutation receives the
 * body as already mutated by prior turns. This allows content to accumulate
 * correctly across multiple pause_turn continuations (e.g., turn 1 adds
 * assistant content [A,B,C], turn 2 extends it to [A,B,C,D,E]).
 */
export async function* withDispatchMutation(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  streaming: boolean,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
  parseContext: { retriesAvailable: boolean },
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  // Chain of mutations accumulated across turns - applied sequentially to the original body
  const mutationChain: DispatchBodyMutation[] = [];

  for (let turn = 0; turn <= MAX_DISPATCH_MUTATIONS; turn++) {

    // Build creator that applies all accumulated mutations to a fresh dispatch
    const currentCreator = mutationChain.length === 0
      ? dispatchCreatorFn
      : async (): Promise<ChatGenerateDispatch> => {
        const dispatch = await dispatchCreatorFn();
        if ('body' in dispatch.request) {
          let body = dispatch.request.body as Record<string, unknown>;
          for (const mutation of mutationChain)
            body = mutation.mutateBody(body);
          dispatch.request = { ...dispatch.request, body };
        }
        return dispatch;
      };

    try {
      yield* executeChatGenerate(currentCreator, streaming, abortSignal, _d, parseContext);
      return; // normal completion
    } catch (error) {
      if (!(error instanceof DispatchMutationSignal)) throw error;
      if (turn >= MAX_DISPATCH_MUTATIONS) throw error;

      console.log(`[dispatch-mutation] ${error.mutation.reason}: continuing (turn ${turn + 1}/${MAX_DISPATCH_MUTATIONS})`);

      // Append to chain - next iteration will apply all mutations sequentially
      mutationChain.push(error.mutation);

      // Loop continues - particles already yielded are preserved
    }
  }
}
