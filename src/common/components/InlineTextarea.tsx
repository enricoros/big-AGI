import * as React from 'react';
import { Textarea } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


export function InlineTextarea(props: { initialText: string, onEdit: (text: string) => void, sx?: SxProps }) {

  const [text, setText] = React.useState(props.initialText);

  const handleEditTextChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value);

  const handleEditKeyPressed = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      props.onEdit(text);
    }
  };

  const handleEditBlur = () => props.onEdit(text);

  return (
    <Textarea
      variant='soft' color='warning' autoFocus minRows={1}
      value={text} onChange={handleEditTextChanged} onKeyDown={handleEditKeyPressed} onBlur={handleEditBlur}
      sx={props.sx} />
  );
}