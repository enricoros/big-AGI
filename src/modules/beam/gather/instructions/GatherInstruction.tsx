import * as React from 'react';

import { Typography } from '@mui/joy';

import { ChatMessage } from '../../../../apps/chat/components/message/ChatMessage';

import { AixChatGenerateContent_DMessage, aixChatGenerateContent_DMessage_FromConversation } from '~/modules/aix/client/aix.client';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { createDMessageTextContent, DMessage, messageFragmentsReduceText, messageWasInterruptedAtStart } from '~/common/stores/chat/chat.message';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { BaseInstruction, ExecutionInputState } from './beam.gather.execution';
import { beamCardMessageScrollingSx, beamCardMessageSx } from '../../BeamCard';
import { getBeamCardScrolling } from '../../store-module-beam';


type ChatGenerateMethods =
  | 's-s0-h0-u0-aN-u'; // sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction

export interface GatherInstruction extends BaseInstruction {
  type: 'gather';
  display?:
    | 'chat-message' /* default */
    | 'character-count'
    | 'mute';
  method: ChatGenerateMethods;
  systemPrompt: string;
  userPrompt: string;
  // evalPrompt?: string;
}


/**
 * Merge Execution: uses a chain of Promises to queue up (cancellable) seuqential instructions.
 */
export async function executeGatherInstruction(_i: GatherInstruction, inputs: ExecutionInputState, prevStepOutput: string): Promise<string> {

  // build the input messages
  if (_i.method !== 's-s0-h0-u0-aN-u')
    throw new Error(`Unsupported Chat Generate method: ${_i.method}`);

  // validate preconditions, to be sure
  if (!inputs.chatMessages.length)
    throw new Error('No conversation history available');
  if (!inputs.rayMessages.length)
    throw new Error('No responses available');
  for (let rayMessage of inputs.rayMessages)
    if (rayMessage.role !== 'assistant')
      throw new Error('Invalid response role');

  const gatherSystemInstruction = createDMessageTextContent('system', _mixChatGeneratePrompt(_i.systemPrompt, inputs.rayMessages.length, prevStepOutput));
  const chatMessagesWithoutSystem = inputs.chatMessages.filter(_m => (_m.role === 'user' || _m.role === 'assistant'));
  const gatherHistory: DMessage[] = [
    // s0-h0-u0
    ...chatMessagesWithoutSystem,
    // aN: every proposal is an assistant message
    // FIXME: there could be an issue with aix.dispatch fusion of assistant messages, and in the future, this should require a
    //        re-encoding or structuring of sorts, e.g.: .map(_m => ({ ..._m, metadata: { ..._m.metadata, asAttachment: true } }))
    ...inputs.rayMessages,
    // u
    createDMessageTextContent('user', _mixChatGeneratePrompt(_i.userPrompt, inputs.rayMessages.length, prevStepOutput)),
  ];

  // update the UI
  const onMessageUpdated = (update: AixChatGenerateContent_DMessage, completed: boolean) => {
    // in-place update of the intermediate message
    const { fragments: incrementalFragments, ...incrementalRest } = update;
    Object.assign(inputs.intermediateDMessage, incrementalRest);
    if (incrementalFragments?.length) {
      inputs.intermediateDMessage.fragments = incrementalFragments;
      inputs.intermediateDMessage.updated = Date.now();
    }
    if (completed)
      delete inputs.intermediateDMessage.pendingIncomplete;

    switch (_i.display) {
      case 'mute':
        return;

      case 'character-count':
        inputs.updateInstructionComponent(
          <Typography level='body-xs' sx={{ opacity: 0.5 }}>{messageFragmentsReduceText(incrementalFragments || []).length} characters</Typography>,
        );
        return;

      case 'chat-message':
      default:
        const isMobile = getIsMobile(); // no need to react to this
        // recreate the UI for this
        inputs.updateInstructionComponent(
          <ChatMessage /* Not Memo as this changes frequently */
            message={inputs.intermediateDMessage}
            fitScreen={isMobile}
            isMobile={isMobile}
            hideAvatar
            adjustContentScaling={-1}
            sx={!getBeamCardScrolling() ? beamCardMessageSx : beamCardMessageScrollingSx}
          />,
        );
        return;
    }
  };

  // stream the gathered message
  return aixChatGenerateContent_DMessage_FromConversation(
    inputs.llmId,
    gatherSystemInstruction,
    gatherHistory,
    'beam-gather', inputs.contextRef,
    { abortSignal: inputs.chainAbortController.signal, throttleParallelThreads: getUXLabsHighPerformance() ? 0 : 1 },
    onMessageUpdated,
  ).then((status) => {

    const clearFragments = messageWasInterruptedAtStart(status.lastDMessage);
    if (clearFragments)
      inputs.intermediateDMessage.fragments = [];

    // re-throw errors, as streamAssistantMessage catches internally
    if (status.outcome === 'aborted') {
      // this message will be discarded as the abort status is checked in the next `catch`
      throw new Error('Instruction Stopped.');
    }
    if (status.outcome === 'errored')
      throw new Error(`Model execution error: ${status.errorMessage || 'Unknown error'}`);

    // Proceed to the next step
    return messageFragmentsReduceText(inputs.intermediateDMessage.fragments); // returns the PipedValueType
  });
}


function _mixChatGeneratePrompt(prompt: string, raysReady: number, prevStepOutput: string): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
    '{{PrevStepOutput}}': prevStepOutput,
  });
}