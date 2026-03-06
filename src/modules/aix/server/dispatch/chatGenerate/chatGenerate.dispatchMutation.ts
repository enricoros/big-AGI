import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import type { executeChatGenerate } from './chatGenerate.executor';


// configuration
const MAX_DISPATCH_MUTATIONS = 10;
const DISPATCH_MUTATION_DEBUG = true;


// --- Framework-level Dispatch Body Mutation ---

/**
 * Provider-agnostic body mutation interface.
 * Any provider parser can define mutations to request body modification + retransmission.
 * Examples: Anthropic pause_turn, future token refresh, context window shift, etc.
 */
export interface DispatchBodyMutation {
  readonly reason: string;
  mutateBody(body: Record<string, unknown>): Record<string, unknown>;
}


/**
 * Signal thrown by provider parsers to request body mutation + retransmission.
 * The dispatch mutation wrapper catches this and re-dispatches with a mutated body.
 *
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


/**
 * Wraps executeChatGenerate to handle dispatch mutations transparently.
 *
 * Provider parsers throw DispatchMutationSignal; this wrapper catches it,
 * mutates the dispatch body, and re-enters - particles flow seamlessly.
 *
 * Separate from retry (retry resets particles; mutation appends particles).
 * Works identically on server (tRPC) and client (CSF) - the wrapper runs
 * wherever the retrier runs.
 */
export async function* withDispatchMutation(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  executeFn: typeof executeChatGenerate,
  streaming: boolean,
  intakeAbortSignal: AbortSignal,
  _d: AixDebugObject,
  parseContext?: { retriesAvailable: boolean },
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  let currentCreator = dispatchCreatorFn;

  for (let turn = 0; turn <= MAX_DISPATCH_MUTATIONS; turn++) {
    try {
      yield* executeFn(currentCreator, streaming, intakeAbortSignal, _d, parseContext);
      return; // normal completion
    } catch (error) {
      if (!(error instanceof DispatchMutationSignal)) throw error;
      if (turn >= MAX_DISPATCH_MUTATIONS) throw error;

      const { mutation } = error;
      if (DISPATCH_MUTATION_DEBUG)
        console.log(`[dispatch-mutation] ${mutation.reason}: continuing (turn ${turn + 1}/${MAX_DISPATCH_MUTATIONS})`);

      // Build a new creator that applies the mutation to the original dispatch
      const originalCreator = dispatchCreatorFn;
      currentCreator = async () => {
        const dispatch = await originalCreator();
        if ('body' in dispatch.request) {
          dispatch.request.body = mutation.mutateBody(dispatch.request.body as Record<string, unknown>);
        }
        return dispatch;
      };
      // loop continues - already-yielded particles are preserved
    }
  }
}
