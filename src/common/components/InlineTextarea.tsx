import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Textarea } from '@mui/joy';

import { useUIPreferencesStore } from '~/common/stores/store-ui';

/**
 * TODO: P3: use Buttons when possible instead of the Blur action. Should add them to the bottom? See `ContentPartTextEdit` for a newer impl.
 */
export function InlineTextarea(props: {
  initialText: string,
  disableAutoSaveOnBlur?: boolean // NOTE: this will disable the enter=newline as well
  placeholder?: string,
  decolor?: boolean,
  invertedColors?: boolean,
  centerText?: boolean,
  minRows?: number,
  syncWithInitialText?: boolean, // optional. if set, the text will be reset to initialText when the prop changes
  selectAllOnFocus?: boolean, // optional. if set to false, text won't be selected on focus (default: true)
  onEdit: (text: string) => void,
  onCancel?: () => void,
  sx?: SxProps,
}) {

  const [text, setText] = React.useState(props.initialText);
  const enterIsNewline = useUIPreferencesStore(state => (!props.disableAutoSaveOnBlur && state.enterIsNewline));


  // [effect] optional syncing of the text to the initial text. warning, will discard the current partial edit
  React.useEffect(() => {
    if (props.syncWithInitialText)
      setText(props.initialText);
  }, [props.syncWithInitialText, props.initialText]);


  // handlers

  const handleEditTextChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value);

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const shiftOrAlt = e.shiftKey || e.altKey;
      if (enterIsNewline ? shiftOrAlt : !shiftOrAlt) {
        e.preventDefault();
        props.onEdit(text);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      props.onCancel?.();
    }
  };

  const handleEditBlur = () => {
    if (!props.disableAutoSaveOnBlur)
      props.onEdit(text);
  };

  return (
    <Textarea
      variant={props.invertedColors ? 'plain' : 'soft'}
      color={props.decolor ? undefined : props.invertedColors ? 'primary' : 'warning'}
      autoFocus={!props.decolor}
      minRows={props.minRows !== undefined ? props.minRows : 1}
      placeholder={props.placeholder}
      value={text}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      onBlur={props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      slotProps={{
        textarea: {
          enterKeyHint: enterIsNewline ? 'enter' : 'done',
          ...(props.centerText && {
            sx: { textAlign: 'center' },
          }),
          onFocus: (props.selectAllOnFocus === false) ? undefined : (e) => {
            // Select all text when the textarea receives focus
            // This is a great default behavior for all the inline text edits
            e.target?.select();
          },
        },
      }}
      sx={props.sx}
    />
  );
}