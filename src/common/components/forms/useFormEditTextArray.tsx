import * as React from 'react';

import { Box, FormControl, IconButton, Textarea, Tooltip } from '@mui/joy';
import ReplayIcon from '@mui/icons-material/Replay';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


/**
 * A simple UI component, string array (ant titles array) in -> edited string array out
 */
export function useFormEditTextArray(initialStrings: string[], titles: string[]) {

  // state
  const [strings, setStrings] = React.useState<string[]>(initialStrings);

  const editString = React.useCallback((i: number, text: string) => {
    setStrings(s => s.map((s, j) => j === i ? text : s));
  }, []);

  const stringEditors = React.useMemo(() => strings.map((text, i) =>
    <FormControl key={i} orientation='vertical'>
      <FormLabelStart title={i > 0 ? `${i}. ${titles[i]}` : titles[i]} />
      <Box sx={{ display: 'flex', alignItems: 'start', gap: 1 }}>
        <Textarea
          value={text}
          size='sm'
          variant='outlined'
          onChange={event => editString(i, event.target.value)}
          sx={{ flex: 1, backgroundColor: 'background.level1', boxShadow: 'none' }}
        />
        <Tooltip title='Reset'>
          <IconButton size='sm' onClick={() => editString(i, initialStrings[i])}>
            <ReplayIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </FormControl>,
  ), [editString, initialStrings, strings, titles]);

  return { strings, stringEditors };
}