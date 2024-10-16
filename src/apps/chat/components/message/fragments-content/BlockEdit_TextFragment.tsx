import * as React from 'react';

import { BlocksTextarea } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';


const textAreaSlotPropsEnter = {
  textarea: {
    enterKeyHint: 'enter' as const,
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
    enterKeyHint: 'done' as const,
  },
};


/**
 * Very similar to <InlineTextArea /> but with externally controlled state rather than internal.
 * Made it for as the editing alternative for <ContentPartText />.
 */
export function BlockEdit_TextFragment(props: {
  // current value
  initialText: string,
  inputLabel?: string,
  fragmentId: DMessageFragmentId,
  enableRestart?: boolean,

  // visual
  contentScaling: ContentScaling,
  // endDecorator?: React.ReactNode

  // edited value
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onSubmit: (withControl: boolean) => void,
  onEscapePressed: () => void,
}) {

  // state
  const [isFocused, setIsFocused] = React.useState(false);

  // external
  // NOTE: we disabled `useUIPreferencesStore(state => state.enterIsNewline)` on 2024-06-19, as it's
  //       not a good pattern for this kind of editing and we have buttons to take care of Save/Cancel
  const enterIsNewline = true;

  // derived state
  const { fragmentId, setEditedText, onSubmit, onEscapePressed } = props;

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    (e.target.value !== undefined) && setEditedText(fragmentId, e.target.value, false);
  }, [fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      const withControl = e.ctrlKey;
      if (enterIsNewline ? shiftOrAlt : !shiftOrAlt) {
        e.preventDefault();
        if (!withControl || props.enableRestart)
          onSubmit(withControl);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscapePressed();
    }
  }, [enterIsNewline, props.enableRestart, onSubmit, onEscapePressed]);

  // shortcuts
  const isEdited = props.editedText !== undefined;
  useGlobalShortcuts('TextFragmentEditor', React.useMemo(() => !isFocused ? [] : [
    { key: ShortcutKey.Enter, shift: true, description: 'Save', disabled: !isEdited && props.enableRestart !== true, level: 3, action: () => onSubmit(false) },
    ...props.enableRestart ? [{ key: ShortcutKey.Enter, ctrl: true, shift: true, description: 'Save & Retry', disabled: !isEdited, level: 3, action: () => onSubmit(true) }] : [],
    { key: ShortcutKey.Esc, description: 'Cancel', level: 3, action: onEscapePressed },
  ], [isEdited, isFocused, props.enableRestart, onEscapePressed, onSubmit]));

  return (
    <BlocksTextarea
      variant={/*props.invertedColors ? 'plain' :*/ 'soft'}
      color={/*props.decolor ? undefined : props.invertedColors ? 'primary' :*/ 'warning'}
      autoFocus
      size={props.contentScaling !== 'md' ? 'sm' : undefined}
      value={(props.editedText !== undefined)
        ? props.editedText /* self-text */
        : props.initialText /* DMessageTextPart text */
      }
      startDecorator={props.inputLabel ? <small>{props.inputLabel}</small> : undefined}
      placeholder={'Edit the message...'}
      minRows={1.5} // unintuitive
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      slotProps={enterIsNewline ? textAreaSlotPropsEnter : textAreaSlotPropsDone}
      // endDecorator={props.endDecorator}
    />
  );
}
