import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import type { BaseInstruction, ExecutionInputState } from './beam.gather.execution';
import { parseTextToChecklist, UserInputChecklistComponent } from './UserInputChecklistComponent';


export interface UserInputChecklistInstruction extends BaseInstruction {
  type: 'user-input-checklist';
  outputPrompt: string;
}

export interface UserChecklistOption {
  id: string,
  label: string,
  selected: boolean,
}


export async function executeUserInputChecklistInstruction(
  _i: UserInputChecklistInstruction,
  inputs: ExecutionInputState,
  prevStepOutput: string,
): Promise<string> {
  return new Promise((resolve, reject) => {

    // initial text to options
    let options = parseTextToChecklist(prevStepOutput, false);
    const relaxMatch = options.length < 2;
    if (relaxMatch)
      options = parseTextToChecklist(prevStepOutput, true);

    // if no options, there's an error
    if (options.length < 2) {
      reject(new Error('Oops! It looks like we had trouble understanding the Model. Could you please try again?'));
      return;
    }

    // react to aborts
    const abortHandler = () => {
      reject(new Error('Checklist Selection Stopped.'));
    };
    inputs.chainAbortController.signal.addEventListener('abort', abortHandler);

    const clearState = () => {
      inputs.updateInstructionComponent(undefined);
      inputs.chainAbortController.signal.removeEventListener('abort', abortHandler); // Cleanup
    };

    const onConfirm = (selectedOptions: UserChecklistOption[]) => {
      clearState();

      // output prompt mixer
      const outputPrompt = bareBonesPromptMixer(_i.outputPrompt, undefined, {
        '{{YesAnswers}}': selectedOptions.filter(o => o.selected).map(o => `- ${o.label.trim()}`).join('\n') || 'None',
        '{{NoAnswers}}': selectedOptions.filter(o => !o.selected).map(o => `- ${o.label.trim()}`).join('\n') || 'None',
      });

      // Proceed to the next step
      resolve(outputPrompt);
    };

    const onCancel = () => {
      clearState();
      inputs.chainAbortController.abort('User cancelled the input.');
      reject();
    };

    // Remove the placeholder message
    inputs.updateProgressComponent(null);

    // Update the instruction component to render the checklist
    inputs.updateInstructionComponent(
      <UserInputChecklistComponent
        options={options}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

  });
}