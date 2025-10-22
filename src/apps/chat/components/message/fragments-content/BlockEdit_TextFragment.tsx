import * as React from 'react';

import { BlocksTextarea } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { Is } from '~/common/util/pwaUtils';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { useUIPreferencesStore } from '~/common/stores/store-ui';


// configuration

/**
 * Note: this will disable the global 'shift+enter' shortcut (and the status message) for this component as well.
 * - #760. Edit Mode not respecting Enter to Send
 * - #770. inconsistent return / shift + return
 * - #771. PR which was not merged (overly complex regex)
 * set to 'undefined' to follow the user preference
 * set to 'true' to force 'enter' to be a newline, which is best for mobile devices where 'shift+enter' is not possible
 */
const FORCE_ENTER_IS_NEWLINE = !Is.Desktop ? true : undefined;


const _textAreaSlotPropsEnter = {
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

const _textAreaSlotPropsDone = {
  ..._textAreaSlotPropsEnter,
  textarea: {
    enterKeyHint: 'done' as const,
  },
};

const _styles = {
  squareTop: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  } as const,
} as const;


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
  squareTopBorder?: boolean,

  // edited value
  controlled?: boolean, // if true, the editor will assume enter is new line, and not emit onSubmit
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
  //
  // NOTE2: as per #https://github.com/enricoros/big-AGI/issues/760, this is a UX break of behavior.
  //        adding a configuration option to quickly
  const isControlled = !!props.controlled;
  const enterIsNewline = useUIPreferencesStore(state => isControlled ? true : FORCE_ENTER_IS_NEWLINE !== undefined ? FORCE_ENTER_IS_NEWLINE : state.enterIsNewline);

  // derived state
  const { fragmentId, setEditedText, onSubmit, onEscapePressed } = props;

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    (e.target.value !== undefined) && setEditedText(fragmentId, e.target.value, false);
  }, [fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const withControl = e.ctrlKey;
      if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
        e.preventDefault();
        if (!isControlled && (!withControl || props.enableRestart))
          onSubmit(withControl);
      } // [Beam] eat up pure Ctrl+Enter, to not restart beams
      else if (e.ctrlKey) {
        e.stopPropagation(); // prevents the global shortcut
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // prevents the global shortcut, e.g. closing beam after this
      onEscapePressed();
    }
  }, [enterIsNewline, isControlled, onEscapePressed, onSubmit, props.enableRestart]);

  // shortcuts
  const isEdited = props.editedText !== undefined;
  useGlobalShortcuts('TextFragmentEditor', React.useMemo(() => (isControlled || !isFocused) ? [] : [
    ...(!FORCE_ENTER_IS_NEWLINE ? [] : [{ key: ShortcutKey.Enter, shift: true, description: 'Save', disabled: !isEdited && props.enableRestart !== true, level: 3, action: () => null }]),
    ...props.enableRestart ? [{ key: ShortcutKey.Enter, ctrl: true, shift: true, description: 'Save & Retry', disabled: !isEdited, level: 3, action: () => onSubmit(true) }] : [],
    { key: ShortcutKey.Esc, description: 'Cancel', level: 3, action: onEscapePressed },
  ], [isControlled, isEdited, isFocused, onEscapePressed, onSubmit, props.enableRestart]));

  return (
    <BlocksTextarea
      variant={/*props.invertedColors ? 'plain' :*/ 'soft'}
      color={/*props.uncolor ? undefined : props.invertedColors ? 'primary' :*/ 'warning'}
      autoFocus
      size={props.contentScaling !== 'md' ? 'sm' : undefined}
      value={(!isControlled && props.editedText !== undefined) /* if Controlled, ignore any edited text overlay */
        ? props.editedText /* self-text */
        : props.initialText /* DMessageTextPart text */
      }
      startDecorator={props.inputLabel ? <small>{props.inputLabel}</small> : undefined}
      placeholder={'Edit the message...'}
      minRows={1.5} // unintuitive
      onFocus={isControlled ? undefined : () => setIsFocused(true)}
      onBlur={isControlled ? undefined : () => setIsFocused(false)}
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      slotProps={enterIsNewline ? _textAreaSlotPropsEnter : _textAreaSlotPropsDone}
      // endDecorator={props.endDecorator}
      sx={!props.squareTopBorder ? undefined : _styles.squareTop}
    />
  );
}
