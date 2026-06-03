import * as React from 'react';

import type { AixReattachMode } from '~/modules/aix/client/aix.client';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageGenerator } from '~/common/stores/chat/chat.message';

import { BlockOpUpstreamResume } from '../../apps/chat/components/message/BlockOpUpstreamResume';

import { beamDeleteUpstreamOrThrow } from './beam.reattach';


/**
 * Beam wrapper around the chat's BlockOpUpstreamResume, for Gemini Interactions (Deep Research) runs
 * that live inside a ray or a fusion/merge.
 *
 * State-gated UX: the card HEADER owns the live connection (Stop = detach, since the background run
 * survives; Replay = brand-new run); THIS block owns the idle upstream run (Resume = reconnect/SSE,
 * Recover = one-shot JSON GET, Cancel = delete the resource). It renders only when the card is idle
 * and the generator still carries an upstreamHandle, so there is never a duplicate Stop. Resume/Recover
 * route through the card's scatter/gather lifecycle (so the header Stop aborts them); Cancel deletes
 * the upstream resource then strips the handle. See kb/modules/LLM-gemini-interactions.md.
 */
export function BeamUpstreamResume(props: {
  llmId: DLLMId | null,
  generator: DMessageGenerator | undefined,
  isPending: boolean, // the card is currently streaming/reattaching (header owns the Stop)
  onReattach: (mode: AixReattachMode) => void,
  onClearHandle: () => void,
}) {

  const { llmId, generator, isPending, onReattach, onClearHandle } = props;

  const upstreamHandle = generator?.upstreamHandle;
  const effectiveLlmId = llmId || (generator?.mgt === 'aix' ? generator.aix.mId : null);

  const handleDelete = React.useCallback(async () => {
    if (!effectiveLlmId || !upstreamHandle) return;
    await beamDeleteUpstreamOrThrow(effectiveLlmId, upstreamHandle); // throws on failure -> button's inline error UI
    onClearHandle();
  }, [effectiveLlmId, upstreamHandle, onClearHandle]);

  // State-gated: nothing while the card is live (the header Stop is the only stop), or without a resumable handle
  if (isPending || !upstreamHandle || !effectiveLlmId)
    return null;

  return (
    <BlockOpUpstreamResume
      upstreamHandle={upstreamHandle}
      pending={false}
      // inFlightMode={undefined} // because only shown when stopped
      onResume={onReattach}
      // onDetach={undefined}
      onDelete={handleDelete}
    />
  );
}
