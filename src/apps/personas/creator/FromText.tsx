import * as React from 'react';

import { Box, Button, Textarea, Typography } from '@mui/joy';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import { lineHeightTextarea } from '~/common/app.theme';


// minimum number of characters required to create from text
const MIN_CHARS = 100;


export function FromText(props: {
  isCreating: boolean;
  onCreate: (text: string, title: string | null) => void;
}) {

  // state
  const [text, setText] = React.useState('');

  const handleCreateFromText = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // stop the form submit
    props.onCreate(text, null);
  };

  return <>

    <Typography level='title-md' startDecorator={<TextFieldsIcon />} sx={{ mb: 3 }}>
      <b>Text</b> -&gt; Persona
    </Typography>

    <form onSubmit={handleCreateFromText}>
      <Textarea
        required
        variant='outlined'
        minRows={4} maxRows={8}
        placeholder='Paste your text here...'
        value={text}
        onChange={event => setText(event.target.value)}
        sx={{
          backgroundColor: 'background.level1',
          '&:focus-within': {
            backgroundColor: 'background.popup',
          },
          lineHeight: lineHeightTextarea,
          mb: 1.5,
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type='submit' variant='solid'
          disabled={props.isCreating || text?.length < MIN_CHARS}
          sx={{ minWidth: 140 }}
        >
          Create
        </Button>

        <Typography level='body-sm'>
          {text.length < MIN_CHARS ? `(${MIN_CHARS - text.length})` : text.length.toLocaleString()}
        </Typography>
      </Box>
    </form>

  </>;
}