import * as React from 'react';
import { Typography } from '@mui/joy';

import { ChatMessage } from '../../../apps/chat/components/message/ChatMessage';
import { streamAssistantMessage } from '../../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { VChatMessageIn } from '~/modules/llms/llm.client';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { createDMessage, type DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { BFusion, FusionUpdateOrFn } from './beam.gather';
import { GATHER_DEBUG_EXECUTION_CHAIN, GATHER_PLACEHOLDER } from '../beam.config';
import { fusionChatMessageSx } from './BeamGatherOutput';


/// [Asynchronous Instruction Framework] ///

interface BaseInstruction {
  type: string;
  label: string;
}

type ChatGenerateMethods =
  | 's-s0-h0-u0-aN-u'; // sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction

export interface ChatGenerateInstruction extends BaseInstruction {
  type: 'chat-generate';
  mute?: boolean;
  method: ChatGenerateMethods;
  systemPrompt: string;
  userPrompt: string;
  // evalPrompt?: string;
}

interface UserInputChecklistInstruction extends BaseInstruction {
  type: 'user-input-checklist';
}

export type Instruction = ChatGenerateInstruction | UserInputChecklistInstruction;


/**
 * Merge Execution: uses a chain of Promises to queue up (cancellable) seuqential instructions.
 */
async function executeChatGenerateInstruction(_i: ChatGenerateInstruction, inputs: ExecutionInputState): Promise<void> {

  // build the input messages
  if (_i.method !== 's-s0-h0-u0-aN-u')
    throw new Error(`Unsupported Chat Generate method: ${_i.method}`);

  const history: VChatMessageIn[] = [
    // s
    { role: 'system', content: _mixInstructionPrompt(_i.systemPrompt, inputs.rayMessages.length) },
    // s0-h0-u0
    ...inputs.chatMessages
      .filter((m) => (m.role === 'user' || m.role === 'assistant'))
      .map((m): VChatMessageIn => ({ role: (m.role !== 'assistant') ? 'user' : m.role, content: m.text })),
    // aN
    ...inputs.rayMessages
      .map((m): VChatMessageIn => ({ role: 'assistant', content: m.text })),
    // u
    { role: 'user', content: _mixInstructionPrompt(_i.userPrompt, inputs.rayMessages.length) },
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

    // recreate the UI for this
    if (!_i.mute)
      inputs.updateInstructionComponent(
        <ChatMessage
          message={inputs.intermediateDMessage}
          fitScreen={true}
          showAvatar={false}
          adjustContentScaling={-1}
          sx={fusionChatMessageSx}
        />,
      );
  };

  // LLM Streaming generation
  return streamAssistantMessage(inputs.llmId, history, getUXLabsHighPerformance() ? 0 : 1, 'off', onMessageUpdate, inputs.chainAbortController.signal)
    .then((status) => {
      // re-throw errors, as streamAssistantMessage catches internally
      if (status.outcome === 'aborted') {
        // this message will be discarded as the abort status is checked in the next `catch`
        throw new Error('Instruction Stopped.');
      }
      if (status.outcome === 'errored')
        throw new Error(`Model execution error: ${status.errorMessage || 'Unknown error'}`);
    });
}

async function executeUserInputChecklistInstruction(
  instruction: UserInputChecklistInstruction,
  { chainAbortController }: ExecutionInputState,
): Promise<void> {
  const signal = chainAbortController.signal;


  return new Promise((resolve, reject) => {
    if (GATHER_DEBUG_EXECUTION_CHAIN)
      console.log('Waiting for user input for:', instruction.label);

    const abortHandler = () => {
      console.log('Operation aborted during user input for:', instruction.label);
      reject(new Error('Operation aborted.'));
    };

    signal.addEventListener('abort', abortHandler);

    setTimeout(() => {
      // Early return if aborted, the reject is already called by abortHandler
      if (signal.aborted)
        return;

      console.log('User input received for:', instruction.label);
      signal.removeEventListener('abort', abortHandler); // Clean up listener
      resolve();
    }, 5000); // Simulate a wait for user input
  });
}


interface ExecutionInputState {
  // inputs
  readonly chatMessages: DMessage[];
  readonly rayMessages: DMessage[];
  readonly llmId: DLLMId;
  // interaction
  readonly chainAbortController: AbortController;
  readonly updateProgressComponent: (component: React.ReactNode) => void;
  readonly updateInstructionComponent: (component: React.ReactNode) => void;
  // output1 -> input2
  readonly intermediateDMessage: DMessage;
}


export function gatherStartFusion(
  initialFusion: Readonly<BFusion>,
  chatMessages: DMessage[],
  rayMessages: DMessage[],
  llmId: DLLMId | null,
  onUpdateBFusion: (update: FusionUpdateOrFn) => void,
) {

  // abort any current fusion
  const { fusionId, instructions } = initialFusion;
  initialFusion.fusingAbortController?.abort();

  // validate preconditions
  const onError = (errorText: string) => onUpdateBFusion({
    stage: 'error',
    errorText: errorText,
    fusingAbortController: undefined,
  });
  if (instructions.length < 1)
    return onError('No fusion instructions available');
  if (chatMessages.length < 1)
    return onError('No conversation history available');
  if (rayMessages.length <= 1)
    return onError('No responses available');
  if (!llmId)
    return onError('No Merge model selected');

  if (GATHER_DEBUG_EXECUTION_CHAIN)
    console.log('beam.gather: executing instructions', instructions);


  // full execution state
  const inputState: ExecutionInputState = {
    // inputs
    chatMessages: chatMessages,
    rayMessages: rayMessages,
    llmId,
    // interaction
    chainAbortController: new AbortController(),
    updateProgressComponent: (component: React.ReactNode) => onUpdateBFusion({ fusingProgressComponent: component }),
    updateInstructionComponent: (component: React.ReactNode) => onUpdateBFusion({ fusingInstructionComponent: component }),
    // output1 -> input2
    intermediateDMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  };


  // BFusion: startup full status reset
  onUpdateBFusion({
    // status
    stage: 'fusing',
    errorText: undefined,
    outputDMessage: undefined,

    // execution progress
    fusingAbortController: inputState.chainAbortController,
    fusingProgressComponent: undefined,
    fusingInstructionComponent: undefined,
  });


  // Execute the instructions in sequence
  let promiseChain = Promise.resolve();
  for (const instruction of instructions) {
    promiseChain = promiseChain.then(() => {
      inputState.updateProgressComponent(
        <Typography
          level='body-xs'
          // endDecorator={<CircularProgress color='neutral' size='sm' sx={{ '--CircularProgress-size': '16px' }} />}
          sx={{ color: 'text.secondary' }}
        >
          {1 + instructions.indexOf(instruction)}/{instructions.length} · {instruction.label}
        </Typography>,
      );
      switch (instruction.type) {
        case 'chat-generate':
          return executeChatGenerateInstruction(instruction, inputState);
        case 'user-input-checklist':
          return executeUserInputChecklistInstruction(instruction, inputState);
        default:
          return Promise.reject(new Error('Unsupported Merge instruction'));
      }
    });
  }

  // Chain completion handlers
  promiseChain
    .then(() => {
      if (GATHER_DEBUG_EXECUTION_CHAIN)
        console.log('All instructions executed for fusion:', fusionId);
      onUpdateBFusion({
        stage: 'success',
        errorText: undefined,
        fusingProgressComponent: undefined,
      });
    })
    .catch((error) => {
      // User abort: no need to show an error
      if (inputState.chainAbortController.signal.aborted) {
        if (GATHER_DEBUG_EXECUTION_CHAIN)
          console.log('Fusion aborted:', fusionId);
        return onUpdateBFusion({
          stage: 'stopped',
          errorText: 'Stopped.',
          fusingProgressComponent: undefined,
        });
      }

      // Error handling
      if (GATHER_DEBUG_EXECUTION_CHAIN)
        console.error('Error executing instructions:', error, fusionId);
      onUpdateBFusion({
        stage: 'error',
        errorText: 'Issue: ' + (error?.message || error?.toString() || 'Unknown error'),
      });
    })
    .finally(() => onUpdateBFusion({
      // let the intermediate be the final output
      outputDMessage: inputState.intermediateDMessage,
      fusingAbortController: undefined,
      fusingInstructionComponent: undefined,
    }));
}


export function gatherStopFusion(fusion: BFusion): BFusion {
  fusion.fusingAbortController?.abort();
  return {
    ...fusion,
    ...(fusion.stage === 'fusing' ? { status: 'stopped' /* speculative as the abort shall do the same */ } : {}),
    fusingAbortController: undefined,
  };
}


function _mixInstructionPrompt(prompt: string, raysReady: number): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
  });
}
