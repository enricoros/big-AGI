import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Textarea } from '@mui/joy';

import { useUIPreferencesStore } from '~/common/state/store-ui';


export function InlineTextarea(props: {
  initialText: string,
  placeholder?: string,
  decolor?: boolean
  invertedColors?: boolean,
  minRows?: number,
  onEdit: (text: string) => void,
  onCancel?: () => void,
  sx?: SxProps,
}) {

  const [text, setText] = React.useState(props.initialText);
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

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
      props.onCancel?.();
    }
  };

  const handleEditBlur = () => props.onEdit(text);

  return (
    <Textarea
      variant={props.invertedColors ? 'plain' : 'soft'}
      color={props.decolor ? undefined : props.invertedColors ? 'primary' : 'warning'}
      autoFocus={!props.decolor}
      minRows={props.minRows !== undefined ? props.minRows : 1}
      placeholder={props.placeholder}
      value={text} onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown} onBlur={handleEditBlur}
      slotProps={{
        textarea: {
          enterKeyHint: enterIsNewline ? 'enter' : 'done',
        },
      }}
      sx={props.sx}
    />
  );
}