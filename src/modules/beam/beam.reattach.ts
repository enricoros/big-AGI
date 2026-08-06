import { AixChatGenerateContent_DMessageGuts, AixChatGenerateTerminal_LL, AixReattachMode, aixCreateChatGenerateContext, aixDeleteUpstreamContent_orThrow, aixReattachContent_DMessage_orThrow } from '~/modules/aix/client/aix.client';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessage, DMessageGenerator } from '~/common/stores/chat/chat.message';


/**
 * Shared reattach plumbing for Beam rays and fusions (Gemini Interactions / Deep Research).
 *
 * A "reattach" re-streams (replay, SSE) or one-shot fetches (snapshot, JSON GET) an upstream-stored run
 * into an existing DMessage, reusing the same AIX facade the chat uses. The CALLER owns the
 * AbortController - so the card's existing Stop control aborts the reattach - and the store-write sink.
 * See kb/modules/LLM-gemini-interactions.md for the protocol and recovery model.
 */


/** Merge a streamed AIX update into a prior DMessage (content replaces on reattach; pending clears on completion). */
export function beamMergeStreamedGuts(prev: DMessage, guts: AixChatGenerateContent_DMessageGuts, completed: boolean): DMessage {
  const { fragments, ...rest } = guts;
  const hasFragments = !!fragments?.length;
  return {
    ...prev,
    ...(hasFragments ? { fragments, updated: Date.now() } : {}),
    ...rest,
    ...(completed ? { pendingIncomplete: undefined } : {}), // clear the pending flag once the message is complete
  };
}


/** Fire-and-forget reattach: streams updates via onMessageUpdate, then reports the terminal outcome. */
export function beamReattachStream(args: {
  llmId: DLLMId,
  generator: Readonly<DMessageGenerator>, // guaranteed by the caller to carry an upstreamHandle
  contextName: 'beam-scatter' | 'beam-gather',
  contextRef: string,
  mode: AixReattachMode,
  abortSignal: AbortSignal,
  onMessageUpdate: (guts: AixChatGenerateContent_DMessageGuts, completed: boolean) => void,
  onTerminal: (outcome: AixChatGenerateTerminal_LL) => void,
}): void {
  void aixReattachContent_DMessage_orThrow(
    args.llmId,
    args.generator,
    aixCreateChatGenerateContext(args.contextName, args.contextRef),
    args.mode,
    { abortSignal: args.abortSignal, throttleParallelThreads: 0 },
    (guts, isDone) => args.onMessageUpdate(guts, isDone),
  )
    .then((status) => args.onTerminal(status.outcome))
    .catch(() => args.onTerminal('failed'));
}


/** Cancel: delete the upstream-stored run by handle, throwing a user-facing message on failure (caller clears the handle on success). */
export async function beamDeleteUpstreamOrThrow(llmId: DLLMId, upstreamHandle: Readonly<DMessageGenerator['upstreamHandle']>): Promise<void> {
  const result = await aixDeleteUpstreamContent_orThrow(llmId, upstreamHandle);
  if (result.ok) return;
  throw new Error(result.message || `Cancel failed${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}`);
}
