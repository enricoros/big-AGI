import * as React from 'react';

import { styled, Textarea } from '@mui/joy';

import { blocksTextStyleSx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';


export const BlocksTextarea = styled(Textarea)({
  // very important: back to a 100% width - the parent is a Grid - see why we need this in BlocksContainer
  width: '100%',

  // just shrink padding tiny bit
  py: 0.5,

  // make the editing stand out a bit more
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-warning-softColor)',
  outline: '1px solid',
  outlineColor: 'var(--joy-palette-warning-solidBg)',

  // text style
  ...blocksTextStyleSx,
});


/**
 * Very similar to <InlineTextArea /> but with externally controlled state rather than internal.
 * Made it for as the editing alternative for <ContentPartText />.
 */
export function PartTextEdit(props: {
  // current value
  textPartText: string,
  fragmentId: DMessageFragmentId,

  // visual
  contentScaling: ContentScaling,

  // edited value
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,

  // events
  onEnterPressed: () => void,
  onEscapePressed: () => void,
}) {

  // external
  // NOTE: we disabled `useUIPreferencesStore(state => state.enterIsNewline)` on 2024-06-19, as it's
  //       not a good pattern for this kind of editing and we have buttons to take care of Save/Cancel
  const enterIsNewline = true;

  // derived state
  const { fragmentId, setEditedText, onEnterPressed, onEscapePressed } = props;

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    (e.target.value !== undefined) && setEditedText(fragmentId, e.target.value);
  }, [fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      if (enterIsNewline ? shiftOrAlt : !shiftOrAlt) {
        e.preventDefault();
        onEnterPressed();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEscapePressed();
    }
  }, [enterIsNewline, onEnterPressed, onEscapePressed]);

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
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      slotProps={{
        textarea: {
          enterKeyHint: enterIsNewline ? 'enter' : 'done',
        },
      }}
    />
  );
}
