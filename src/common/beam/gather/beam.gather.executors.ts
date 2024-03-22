import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { BFusion } from './beam.gather';
import type { BRay } from '../scatter/beam.scatter';


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


interface ExecutionStateConst {
  inputLLMId: DLLMId;
  inputRays: Readonly<BRay[]>;
}

interface ExecutionStateVar {
  instructionIndex: number;
  instructionLabel: string;
}


export function executeChatGenerateInstruction(instruction: ChatGenerateInstruction): Promise<void> {
  // Example implementation - adapt based on actual logic for executing a chat-generate instruction
  return new Promise((resolve, reject) => {
    // Simulate asynchronous operation (e.g., API call)
    setTimeout(() => {
      console.log('Chat Generate Instruction executed:', instruction.label);
      // Update fusion status or perform any other required state updates here
      resolve();
    }, 2000);
  });
}


export function executeUserInputChecklistInstruction(instruction: UserInputChecklistInstruction): Promise<void> {
  // Example implementation - adapt based on your application's UI/input logic
  return new Promise((resolve, reject) => {
    // Logic to display user input prompt and wait for submission
    // This is highly dependent on your UI framework and setup
    console.log('Waiting for user input for:', instruction.label);
    // Simulate receiving user input after some time
    setTimeout(() => {
      console.log('User input received for:', instruction.label);
      resolve();
    }, 5000); // Simulate a 5-second wait for user input
  });
}


export function executeFusionInstructions(
  fusionId: string,
  instructions: Readonly<Instruction[]>,
  llmId: DLLMId,
  raysSnapshot: Readonly<BRay[]>,
  updateBFusion: (update: Partial<BFusion>) => void,
) {

  // Initialize the VM state
  // const runningFusion: BFusion = {
  //   ...fusion,
  //   vmState: {
  //     inputLLMId: llmId,
  //     inputRays: raysSnapshot,
  //     currentInstructionIndex: 0,
  //     abortController: new AbortController(),
  //   },
  //   status: 'fusing',
  //   fusionIssue: undefined,
  //   outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  // };
  // updateBFusion(runningFusion);

  // Start executing the instructions
  let promiseChain = Promise.resolve();
  console.log('executing instructions', instructions);

  for (const instruction of instructions) {
    promiseChain = promiseChain.then(() => {
      switch (instruction.type) {
        case 'chat-generate':
          return executeChatGenerateInstruction(instruction);
        case 'user-input-checklist':
          return executeUserInputChecklistInstruction(instruction);
        default:
          return Promise.reject(new Error('Unsupported Merge instruction'));
      }
    });
  }

  promiseChain.then(() => {
    console.log('All instructions executed for fusion:', fusionId);
    updateBFusion({
      status: 'success',
      fusionIssue: undefined,
    });
  }).catch((error) => {
    console.error('Error executing instructions:', error, fusionId);
    updateBFusion({
      status: 'error',
      fusionIssue: error?.message || error?.toString() || 'Unknown error',
    });
  }).finally(() => {
    updateBFusion({
      abortController: undefined,
    });
  });
}


export function fusionGatherStop(fusion: BFusion): BFusion {
  fusion.abortController?.abort();
  return {
    ...fusion,
    ...(fusion.status === 'fusing' ? { status: 'stopped' } : {}),
    abortController: undefined,
  };
}