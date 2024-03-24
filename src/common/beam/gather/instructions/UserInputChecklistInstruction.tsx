import type { BaseInstruction, ExecutionInputState } from '../beam.gather.instructions';
import { GATHER_DEBUG_EXECUTION_CHAIN } from '../../beam.config';


export interface UserInputChecklistInstruction extends BaseInstruction {
  type: 'user-input-checklist';
}


export async function executeUserInputChecklist(
  instruction: UserInputChecklistInstruction,
  { chainAbortController }: ExecutionInputState,
): Promise<void> {

  // const signal = chainAbortController.signal;
  //
  //
  // return new Promise((resolve, reject) => {
  //   if (GATHER_DEBUG_EXECUTION_CHAIN)
  //     console.log('Waiting for user input for:', instruction.label);
  //
  //   const abortHandler = () => {
  //     console.log('Operation aborted during user input for:', instruction.label);
  //     reject(new Error('Operation aborted.'));
  //   };
  //
  //   signal.addEventListener('abort', abortHandler);
  //
  //   setTimeout(() => {
  //     // Early return if aborted, the reject is already called by abortHandler
  //     if (signal.aborted)
  //       return;
  //
  //     console.log('User input received for:', instruction.label);
  //     signal.removeEventListener('abort', abortHandler); // Clean up listener
  //     resolve();
  //   }, 5000); // Simulate a wait for user input
  // });

  // return a promise that never resolves, so we can stop here
  return new Promise(() => {});
}