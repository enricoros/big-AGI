import * as React from 'react';

import { Textarea } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { useUIPreferencesStore } from '~/common/state/store-ui';


export function InlineTextarea(props: { initialText: string, onEdit: (text: string) => void, sx?: SxProps }) {

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
    }
  };

  const handleEditBlur = () => props.onEdit(text);

  return (
    <Textarea
      variant='soft' color='warning' autoFocus minRows={1}
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