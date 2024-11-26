import * as React from 'react';
import { diffWords } from 'diff';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';


// configuration
const COALESCE_TIMEOUT = 200;


export type WordsDiff = {
  value: string;                    // the string value of this chunk of words
  count?: number | undefined;       // total number of words
  added?: boolean | undefined;      // is this an insertion
  removed?: boolean | undefined;    // is this a deletion
}[];


export function useWordsDifference(_text: string, _diffText: string | undefined, enabled: boolean) {
  // state
  const [diffs, setDiffs] = React.useState<WordsDiff | null>(null);

  const inputText = enabled ? _text : null;
  const inputPrevText = enabled ? _diffText : null;

  // async processing of diffs
  React.useEffect(() => {
    if (!inputText || !inputPrevText)
      return setDiffs(null);

    const callback = () => setDiffs(diffWords(inputPrevText, inputText));

    // slight delay to cancel the previous operation if too close to this
    const timeout = setTimeout(callback, COALESCE_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [inputPrevText, inputText]);

  return diffs;
}


export function RenderWordsDiff(props: { wordsDiff: WordsDiff; sx?: SxProps; }) {
  return (
    <Typography
      sx={{
        mx: 1.5,
        // display: 'flex', alignItems: 'baseline',
        overflowWrap: 'anywhere',
        whiteSpace: 'break-spaces',
        display: 'block',
        ...props.sx,
        '.added': {
          backgroundColor: 'success.softHoverBg',
          color: 'success.softColor',
          paddingY: '0.125rem',
          borderRadius: '0.125rem',
        },
        '.removed': {
          backgroundColor: 'danger.softBg',
          color: 'danger.plainColor',
          paddingY: '0.125rem',
          borderRadius: '0.125rem',
          // textDecoration: 'line-through',
        },
      }}
    >
      {props.wordsDiff.map((diff, index) =>
        <Box
          component='span'
          key={'diff-' + index}
          className={diff.added ? 'added' : diff.removed ? 'removed' : undefined}
        >
          {diff.value}
        </Box>,
      )}
    </Typography>
  );
}
