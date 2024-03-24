import { Box } from '@mui/joy';

import { streamAssistantMessage } from '../../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { VChatMessageIn } from '~/modules/llms/llm.client';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { createDMessage, type DMessage } from '~/common/state/store-chats';
import { getUXLabsHighPerformance } from '~/common/state/store-ux-labs';

import type { BFusion, FusionUpdateOrFn } from './beam.gather';
import { GATHER_PLACEHOLDER } from '../beam.config';


// Temp: Move
export function mixInstructionPrompt(prompt: string, raysReady: number): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
  });
}


/// [Asynchronous Instruction Framework] ///

interface BaseInstruction {
  type: string;
  label: string;
}

export interface ChatGenerateInstruction extends BaseInstruction {
  type: 'chat-generate';
  // s-s0-h0-u0-aN-u: sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction
  method: 's-s0-h0-u0-aN-u';
  systemPrompt: string;
  userPrompt: string;
  // evalPrompt?: string;
  outputType: 'display-message' | 'user-checklist';
}

interface UserInputChecklistInstruction extends BaseInstruction {
  type: 'user-input-checklist';
}

export type Instruction = ChatGenerateInstruction | UserInputChecklistInstruction;


export async function executeChatGenerateInstruction(
  instruction: ChatGenerateInstruction,
  inputs: StateImmutable,
): Promise<void> {

  // build the input messages
  if (instruction.method !== 's-s0-h0-u0-aN-u')
    throw new Error(`Unsupported Chat Generate method: ${instruction.method}`);

  const _promptVars = (prompt: string) => mixInstructionPrompt(prompt, inputs.rayMessages.length);

  const history: VChatMessageIn[] = [
    // s
    { role: 'system', content: _promptVars(instruction.systemPrompt) },
    // s0-h0-u0
    ...inputs.chatMessages
      .filter((m) => (m.role === 'user' || m.role === 'assistant'))
      .map((m): VChatMessageIn => ({ role: (m.role !== 'assistant') ? 'user' : m.role, content: m.text })),
    // aN
    ...inputs.rayMessages
      .map((m): VChatMessageIn => ({ role: 'assistant', content: m.text })),
    // u
    { role: 'user', content: _promptVars(instruction.userPrompt) },
  ];

  const updateMessage = (update: Partial<DMessage>) => {
    console.log('updateMessage', update);
    // updateBFusion((fusion) => ({
    //   // ...fusion,
    //   outputDMessage: {
    //     ...fusion.outputDMessage!,
    //     ...update,
    //     // only update the timestamp when the text changes
    //     ...(update.text ? { updated: Date.now() } : {}),
    //   },
    // }));
  };

  return streamAssistantMessage(
    inputs.llmId,
    history,
    getUXLabsHighPerformance() ? 0 : 1,
    'off',
    updateMessage,
    inputs.chainAbortController.signal,
  )
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


export async function executeUserInputChecklistInstruction(
  instruction: UserInputChecklistInstruction,
  { chainAbortController }: StateImmutable,
): Promise<void> {
  const signal = chainAbortController.signal;


  return new Promise((resolve, reject) => {
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


interface StateImmutable {
  readonly chainAbortController: AbortController;
  readonly chatMessages: DMessage[];
  readonly rayMessages: DMessage[];
  readonly llmId: DLLMId;
  readonly intermediateDMessage: DMessage;
  readonly updateBFusion: (update: FusionUpdateOrFn) => void;
}

// interface StateMutable {
//   instructionIndex: number;
//   instructionLabel: string;
// }


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


  // Immutable state - not UI (BFusion) synced
  const stateImmutable: StateImmutable = {
    chainAbortController: new AbortController(),
    chatMessages: chatMessages,
    rayMessages: rayMessages,
    llmId: llmId,
    intermediateDMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
    updateBFusion: onUpdateBFusion,
  };


  // start: big reset
  onUpdateBFusion({
    // status
    stage: 'fusing',
    errorText: undefined,
    outputDMessage: undefined,  // createDMessage('assistant', GATHER_PLACEHOLDER)

    // execution progress
    fusingAbortController: stateImmutable.chainAbortController,
    fusingProgressComponent: undefined,
    // fusingDisplayType: undefined,
    // fusingIntermediateDMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  });

  // Start executing the instructions
  let promiseChain = Promise.resolve();
  console.log('executing instructions', instructions);

  for (const instruction of instructions) {
    promiseChain = promiseChain.then(() => {
      // progress update
      onUpdateBFusion({
        fusingProgressComponent: <Box onClick={() => console.log('me')}>({1 + instructions.indexOf(instruction)}/{instructions.length}) {instruction.label}</Box>,
      });

      // execute the instruction, purely on the state
      switch (instruction.type) {
        case 'chat-generate':
          return executeChatGenerateInstruction(instruction, stateImmutable);
        case 'user-input-checklist':
          return executeUserInputChecklistInstruction(instruction, stateImmutable);
        default:
          return Promise.reject(new Error('Unsupported Merge instruction'));
      }
    });
  }

  promiseChain
    .then(() => {
      console.log('All instructions executed for fusion:', fusionId);
      onUpdateBFusion({
        stage: 'success',
        errorText: undefined,
        fusingProgressComponent: undefined,
      });
    })
    .catch((error) => {
      // User abort: no need to show an error
      if (stateImmutable.chainAbortController.signal.aborted) {
        console.log('Fusion aborted:', fusionId);
        return onUpdateBFusion({
          stage: 'stopped',
          errorText: 'Stopped.',
          fusingProgressComponent: undefined,
        });
      }

      // Error handling
      console.error('Error executing instructions:', error, fusionId);
      onUpdateBFusion({
        stage: 'error',
        errorText: 'Issue: ' + (error?.message || error?.toString() || 'Unknown error'),
      });
    })
    .finally(() => {
      onUpdateBFusion({
        outputDMessage: stateImmutable.intermediateDMessage,
        fusingAbortController: undefined,
      });
    });
}


export function gatherStopFusion(fusion: BFusion): BFusion {
  fusion.fusingAbortController?.abort();
  return {
    ...fusion,
    ...(fusion.stage === 'fusing' ? { status: 'stopped' /* speculative as the abort shall do the same */ } : {}),
    fusingAbortController: undefined,
  };
}