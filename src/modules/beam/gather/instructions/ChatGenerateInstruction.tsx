import * as React from 'react';

import { Typography } from '@mui/joy';

import { ChatMessage } from '../../../../apps/chat/components/message/ChatMessage';
import { streamAssistantMessage } from '../../../../apps/chat/editors/chat-stream';

import type { VChatMessageIn } from '~/modules/llms/llm.client';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { BaseInstruction, ExecutionInputState } from './beam.gather.execution';
import { GATHER_PLACEHOLDER } from '../../beam.config';
import { beamCardMessageScrollingSx, beamCardMessageSx } from '../../BeamCard';
import { getBeamCardScrolling } from '../../store-module-beam';


type ChatGenerateMethods =
  | 's-s0-h0-u0-aN-u'; // sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction

export interface ChatGenerateInstruction extends BaseInstruction {
  type: 'chat-generate';
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
export async function executeChatGenerate(_i: ChatGenerateInstruction, inputs: ExecutionInputState, prevStepOutput: string): Promise<string> {

  // build the input messages
  if (_i.method !== 's-s0-h0-u0-aN-u')
    throw new Error(`Unsupported Chat Generate method: ${_i.method}`);

  const history: VChatMessageIn[] = [
    // s
    { role: 'system', content: _mixChatGeneratePrompt(_i.systemPrompt, inputs.rayMessages.length, prevStepOutput) },
    // s0-h0-u0
    ...inputs.chatMessages
      .filter((m) => (m.role === 'user' || m.role === 'assistant'))
      .map((m): VChatMessageIn => ({ role: (m.role !== 'assistant') ? 'user' : m.role, content: m.text })),
    // aN
    ...inputs.rayMessages
      .map((m): VChatMessageIn => ({ role: 'assistant', content: m.text })),
    // u
    { role: 'user', content: _mixChatGeneratePrompt(_i.userPrompt, inputs.rayMessages.length, prevStepOutput) },
  ];

  // reset the intermediate message
  Object.assign(inputs.intermediateDMessage, {
    text: GATHER_PLACEHOLDER,
    updated: undefined,
  } satisfies Partial<DMessage>);

  // update the UI
  const onMessageUpdate = (update: Partial<DMessage>) => {
    // in-place update of the intermediate message
    Object.assign(inputs.intermediateDMessage, update);
    if (update.text)
      inputs.intermediateDMessage.updated = Date.now();

    switch (_i.display) {
      case 'mute':
        return;

      case 'character-count':
        inputs.updateInstructionComponent(
          <Typography level='body-xs' sx={{ opacity: 0.5 }}>{update.text?.length || 0} characters</Typography>,
        );
        return;

      case 'chat-message':
      default:
        // recreate the UI for this
        inputs.updateInstructionComponent(
          <ChatMessage
            message={inputs.intermediateDMessage}
            fitScreen={true}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={!getBeamCardScrolling() ? beamCardMessageSx : beamCardMessageScrollingSx}
          />,
        );
        return;
    }
  };

  // LLM Streaming generation
  return streamAssistantMessage(inputs.llmId, history, 'beam-gather', inputs.contextRef, getUXLabsHighPerformance() ? 0 : 1, 'off', onMessageUpdate, inputs.chainAbortController.signal)
    .then((status) => {
      // re-throw errors, as streamAssistantMessage catches internally
      if (status.outcome === 'aborted') {
        // this message will be discarded as the abort status is checked in the next `catch`
        throw new Error('Instruction Stopped.');
      }
      if (status.outcome === 'errored')
        throw new Error(`Model execution error: ${status.errorMessage || 'Unknown error'}`);

      // Proceed to the next step
      return inputs.intermediateDMessage.text;
    });
}


function _mixChatGeneratePrompt(prompt: string, raysReady: number, prevStepOutput: string): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
    '{{PrevStepOutput}}': prevStepOutput,
  });
}