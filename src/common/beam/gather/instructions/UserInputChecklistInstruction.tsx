import type { BaseInstruction, ExecutionInputState } from '../beam.gather.instructions';
import { GATHER_DEBUG_EXECUTION_CHAIN } from '../../beam.config';
import { parseTextToChecklist, UserInputChecklistComponent } from './UserInputChecklistComponent';


export interface UserInputChecklistInstruction extends BaseInstruction {
  type: 'user-input-checklist';
}

export interface UserChecklistOption {
  id: string,
  label: string,
  selected: boolean,
}


export interface UserChecklistValue {
  checklist: UserChecklistOption[];
}

export async function executeUserInputChecklist(
  _i: UserInputChecklistInstruction,
  inputs: ExecutionInputState,
): Promise<UserChecklistValue> {
  return new Promise((resolve, reject) => {

    // initial text to options
    const inputText = inputs.intermediateDMessage.text;
    const options = parseTextToChecklist(inputText);

    // if no options, there's an error
    if (options.length < 2) {
      if (GATHER_DEBUG_EXECUTION_CHAIN)
        console.log('No checklist options found:', inputText);
      reject(new Error('Oops! It looks like we had trouble understanding the Model. Could you please try again?'));
      return;
    }

    // react to aborts
    const abortHandler = () => reject(new Error('Checklist Selection Stopped.'));
    inputs.chainAbortController.signal.addEventListener('abort', abortHandler);

    const clearState = () => {
      inputs.updateInstructionComponent(undefined);
      inputs.chainAbortController.signal.removeEventListener('abort', abortHandler); // Cleanup
    };

    const onConfirm = (selectedOptions: UserChecklistOption[]) => {
      clearState();
      resolve({ checklist: selectedOptions }); // Proceed to the next step
    };

    const onCancel = () => {
      clearState();
      reject(new Error('User cancelled the input.'));
    };

    // Remove the placeholder message
    inputs.updateProgressComponent(null);

    // Update the instruction component to render the checklist
    inputs.updateInstructionComponent(<UserInputChecklistComponent options={options} onConfirm={onConfirm} onCancel={onCancel} />);

  });
}