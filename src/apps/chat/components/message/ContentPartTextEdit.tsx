import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Textarea } from '@mui/joy';

import { blocksRendererSx } from '~/modules/blocks/BlocksRenderer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragmentId, DMessageTextPart } from '~/common/stores/chat/chat.message';
import { useUIPreferencesStore } from '~/common/state/store-ui';


const textEditAreaSx: SxProps = {
  ...blocksRendererSx,
  // just shrink padding tiny bit
  py: 0.5,
  // make the editing stand out a bit more
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-warning-softColor)',
  outline: '1px solid',
  outlineColor: 'warning.solidBg',
};


/**
 * Very similar to <InlineTextArea /> but with externally controlled state rather than internal.
 * Made it for as the editing alternative for <ContentPartText />.
 */
export function ContentPartTextEdit(props: {
  // current value
  textPart: DMessageTextPart,
  fragmentId: DMessageFragmentId,

  // visual
  contentScaling: ContentScaling,

  // edited value
  editedText?: string,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,

  // events
  onApplyEdits: () => void,
  onCancelEdits: () => void,
}) {

  // external state
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

  // derived state
  const { fragmentId, setEditedText, onApplyEdits, onCancelEdits } = props;

  // handlers
  const handleEditTextChanged = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    (e.target.value !== undefined) && setEditedText(fragmentId, e.target.value);
  }, [fragmentId, setEditedText]);

  const handleEditKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      if (enterIsNewline ? shiftOrAlt : !shiftOrAlt) {
        e.preventDefault();
        onApplyEdits();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelEdits();
    }
  }, [enterIsNewline, onApplyEdits, onCancelEdits]);

  return (
    <Textarea
      variant={/*props.invertedColors ? 'plain' :*/ 'soft'}
      color={/*props.decolor ? undefined : props.invertedColors ? 'primary' :*/ 'warning'}
      autoFocus
      size={props.contentScaling !== 'md' ? 'sm' : undefined}
      value={(props.editedText !== undefined)
        ? props.editedText /* self-text */
        : props.textPart.text /* DMessageTextPart text */
      }
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      // onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      slotProps={{
        textarea: {
          enterKeyHint: enterIsNewline ? 'enter' : 'done',
        },
      }}
      sx={textEditAreaSx}
    />
  );
}
