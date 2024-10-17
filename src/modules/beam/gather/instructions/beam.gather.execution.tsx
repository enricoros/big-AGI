import * as React from 'react';
import { Typography } from '@mui/joy';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { createDMessageEmpty, DMessage } from '~/common/stores/chat/chat.message';
import { createPlaceholderVoidFragment } from '~/common/stores/chat/chat.fragments';

import type { BFusion, FusionUpdateOrFn } from '../beam.gather';
import { executeGatherInstruction, GatherInstruction } from './GatherInstruction';
import { GATHER_PLACEHOLDER } from '../../beam.config';
import { executeUserInputChecklistInstruction, UserInputChecklistInstruction } from './UserInputChecklistInstruction';


/// [Asynchronous Instruction Framework] ///

export interface BaseInstruction {
  type: string;
  label: string;
}

export interface ExecutionInputState {
  // inputs
  readonly chatMessages: DMessage[];
  readonly rayMessages: DMessage[];
  readonly llmId: DLLMId;
  readonly contextRef: string; // not useful
  // interaction
  readonly chainAbortController: AbortController;
  readonly updateProgressComponent: (component: React.ReactNode) => void;
  readonly updateInstructionComponent: (component: React.ReactNode) => void;
  // output1 -> input2
  readonly intermediateDMessage: DMessage;
}

export type Instruction = GatherInstruction | UserInputChecklistInstruction;


export function gatherStartFusion(
  initialFusion: Readonly<BFusion>,
  chatMessages: DMessage[],
  rayMessages: DMessage[],
  onUpdateBFusion: (update: FusionUpdateOrFn) => void,
) {

  // abort any current fusion
  const { instructions } = initialFusion;
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
  if (!initialFusion.llmId)
    return onError('No Merge model selected');


  // full execution state
  const inputState: ExecutionInputState = {
    // inputs
    chatMessages: chatMessages,
    rayMessages: rayMessages,
    llmId: initialFusion.llmId,
    contextRef: initialFusion.fusionId,
    // interaction
    chainAbortController: new AbortController(),
    updateProgressComponent: (component: React.ReactNode) => onUpdateBFusion({ fusingProgressComponent: component }),
    updateInstructionComponent: (component: React.ReactNode) => onUpdateBFusion({ fusingInstructionComponent: component }),
    // output1 -> input2
    intermediateDMessage: createDMessageEmpty('assistant'), // [state] assistant:Fusion_pending
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
  type PipedValueType = string;
  const chainedInitialValue: PipedValueType = '';
  let promiseChain: Promise<PipedValueType> = Promise.resolve(chainedInitialValue);
  for (const instruction of instructions) {
    promiseChain = promiseChain.then((precedingValue: PipedValueType) => {
      // You can use chainedValue here, if needed
      inputState.updateProgressComponent(
        <Typography
          level='body-sm'
          sx={{ color: 'text.secondary' }}
        >
          {instructions.length > 1 && <>{1 + instructions.indexOf(instruction)}/{instructions.length} · </>}
          {instruction.label} ...
        </Typography>,
      );

      // reset the intermediate message
      inputState.intermediateDMessage.fragments = [createPlaceholderVoidFragment(GATHER_PLACEHOLDER)];
      inputState.intermediateDMessage.pendingIncomplete = true;
      inputState.intermediateDMessage.updated = null;

      // return the promise from the instruction
      switch (instruction.type) {
        case 'gather':
          return executeGatherInstruction(instruction, inputState, precedingValue);
        case 'user-input-checklist':
          return executeUserInputChecklistInstruction(instruction, inputState, precedingValue);
        default:
          return Promise.reject(new Error('Unsupported Merge instruction'));
      }
    });
  }

  // Chain completion handlers
  promiseChain
    .then(() => {
      onUpdateBFusion({
        stage: 'success',
        errorText: undefined,
        fusingProgressComponent: undefined,
      });
    })
    .catch((error) => {
      // User abort: no need to show an error
      if (inputState.chainAbortController.signal.aborted) {
        return onUpdateBFusion({
          stage: 'stopped',
          // errorText: 'Merge Canceled.',
          fusingProgressComponent: undefined,
        });
      }

      // Error handling
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
