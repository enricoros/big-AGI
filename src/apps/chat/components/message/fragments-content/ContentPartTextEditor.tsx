import * as React from 'react';

import { BlocksTextarea } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';


const textAreaSlotPropsEnter = {
  textarea: {
    enterKeyHint: 'enter',
  },
  endDecorator: {
    sx: {
      fontSize: 'xs',
      pl: 0.5,
      mt: 1.5,
    },
  },
};

const textAreaSlotPropsDone = {
  ...textAreaSlotPropsEnter,
  textarea: {
    enterKeyHint: 'done',
  },
};


/**
 * Very similar to <InlineTextArea /> but with externally controlled state rather than internal.
 * Made it for as the editing alternative for <ContentPartText />.
 */
export function ContentPartTextEditor(props: {
  // current value
  textPartText: string,
  fragmentId: DMessageFragmentId,

  // visual
  contentScaling: ContentScaling,
  endDecorator?: React.ReactNode

  // edited value
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  onSubmit: (withControl: boolean) => void,
  onEscapePressed: () => void,
}) {

  // external
  // NOTE: we disabled `useUIPreferencesStore(state => state.enterIsNewline)` on 2024-06-19, as it's
  //       not a good pattern for this kind of editing and we have buttons to take care of Save/Cancel
  const enterIsNewline = true;

  // derived state
  const { fragmentId, setEditedText, onSubmit, onEscapePressed } = props;

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    (e.target.value !== undefined) && setEditedText(fragmentId, e.target.value);
  }, [fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      const withControl = e.ctrlKey;
      if (enterIsNewline ? shiftOrAlt : !shiftOrAlt) {
        e.preventDefault();
        onSubmit(withControl);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscapePressed();
    }
  }, [enterIsNewline, onSubmit, onEscapePressed]);

  return (
    <BlocksTextarea
      variant={/*props.invertedColors ? 'plain' :*/ 'soft'}
      color={/*props.decolor ? undefined : props.invertedColors ? 'primary' :*/ 'warning'}
      autoFocus
      size={props.contentScaling !== 'md' ? 'sm' : undefined}
      value={(props.editedText !== undefined)
        ? props.editedText /* self-text */
        : props.textPartText /* DMessageTextPart text */
      }
      placeholder={'Edit the message...'}
      // minRows={2} // unintuitive
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      slotProps={enterIsNewline ? textAreaSlotPropsEnter : textAreaSlotPropsDone}
      endDecorator={props.endDecorator}
    />
  );
}
