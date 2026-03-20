import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';

import { BlocksTextarea } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { Is } from '~/common/util/pwaUtils';
import { ShortcutKey, useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import type { ActileItem } from '../../composer/actile/ActileProvider';
import { providerMentions } from '../../composer/actile/providerMentions';
import { matchOpenMentionAtEnd } from '../../composer/actile/providerMentions.utils';
import { useActileManager } from '../../composer/actile/useActileManager';


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
  participants?: DConversationParticipant[],

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
  const editorTextAreaRef = React.useRef<HTMLTextAreaElement>(null);

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

  const handleMentionSelect = React.useCallback(({ label }: ActileItem, _searchPrefix: string) => {
    const textArea = editorTextAreaRef.current;
    if (!textArea)
      return;

    const currentText = textArea.value;
    const cursorPos = textArea.selectionStart ?? currentText.length;
    const textUntilCursor = currentText.slice(0, cursorPos);
    const mentionMatch = matchOpenMentionAtEnd(textUntilCursor);
    if (!mentionMatch)
      return;

    const mentionStart = cursorPos - mentionMatch[0].length + (mentionMatch[0].startsWith(' ') ? 1 : 0);
    const nextText = currentText.substring(0, mentionStart) + label + ' ' + currentText.substring(cursorPos);
    setEditedText(fragmentId, nextText, false);

    const newCursorPos = mentionStart + label.length + 1;
    setTimeout(() => editorTextAreaRef.current?.setSelectionRange(newCursorPos, newCursorPos), 0);
  }, [fragmentId, setEditedText]);

  const actileProviders = React.useMemo(() => props.participants?.length
    ? [providerMentions(props.participants, handleMentionSelect)]
    : [], [handleMentionSelect, props.participants]);

  const { actileComponent, actileInterceptKeydown, actileInterceptTextChange } = useActileManager(actileProviders, editorTextAreaRef);

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value !== undefined) {
      setEditedText(fragmentId, e.target.value, false);
      actileInterceptTextChange(e.target.value);
    }
  }, [actileInterceptTextChange, fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (actileInterceptKeydown(e))
      return;

    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing)
        return;
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
  }, [actileInterceptKeydown, enterIsNewline, isControlled, onEscapePressed, onSubmit, props.enableRestart]);

  // shortcuts
  const isEdited = props.editedText !== undefined;
  useGlobalShortcuts('TextFragmentEditor', React.useMemo(() => (isControlled || !isFocused) ? [] : [
    ...(!FORCE_ENTER_IS_NEWLINE ? [] : [{ key: ShortcutKey.Enter, shift: true, description: 'Save', disabled: !isEdited && props.enableRestart !== true, level: 3, action: () => null }]),
    ...props.enableRestart ? [{ key: ShortcutKey.Enter, ctrl: true, shift: true, description: 'Save & Retry', disabled: !isEdited, level: 3, action: () => onSubmit(true) }] : [],
    { key: ShortcutKey.Esc, description: 'Cancel', level: 3, action: onEscapePressed },
  ], [isControlled, isEdited, isFocused, onEscapePressed, onSubmit, props.enableRestart]));


  // memo style
  const sx = React.useMemo((): SxProps | undefined => {
    // check sources of custom, and early outs
    const isXS = props.contentScaling === 'xs';
    const isSquareTop = !!props.squareTopBorder;
    if (!isXS && !isSquareTop) return undefined;
    if (isSquareTop && !isXS) return _styles.squareTop;

    return {
      // scaling note: in Chat, this can go xs/sm/md, while in Beam, this is xs/xs/sm
      ...(isXS && {
        fontSize: 'xs',
        lineHeight: 'md', // was 1.75 on all
        // '--Textarea-paddingBlock': 'calc(0.25rem - 0.5px - var(--variant-borderWidth, 0px))', // not used, overridden in BlocksTextarea
        '--Textarea-paddingInline': '6px',
        '--Textarea-minHeight': '1.75rem', // was 2rem on 'sm'
        '--Icon-fontSize': 'lg', // was 'xl' on 'sm'
        '--Textarea-focusedThickness': '1px',
        boxShadow: 'none', // too small to show this
      }),
      ...(isSquareTop && _styles.squareTop),
    };
  }, [props.contentScaling, props.squareTopBorder]);


  return (
    <>
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
      slotProps={{
        ...(enterIsNewline ? _textAreaSlotPropsEnter : _textAreaSlotPropsDone),
        textarea: {
          ...((enterIsNewline ? _textAreaSlotPropsEnter : _textAreaSlotPropsDone).textarea),
          ref: editorTextAreaRef,
        },
      }}
      onFocus={isControlled ? undefined : () => setIsFocused(true)}
      onBlur={isControlled ? undefined : () => setIsFocused(false)}
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      // endDecorator={props.endDecorator}
      sx={sx}
    />
    {actileComponent}
  </>
  );
}
