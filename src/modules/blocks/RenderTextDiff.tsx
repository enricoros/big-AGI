import * as React from 'react';
import { cleanupEfficiency, Diff as TextDiff, DIFF_DELETE, DIFF_INSERT, makeDiff } from '@sanity/diff-match-patch';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography, useTheme } from '@mui/joy';

import type { DiffBlock } from './blocks';


export function useSanityTextDiffs(_text: string, _diffText: string | undefined, enabled: boolean) {
  // state
  const [diffs, setDiffs] = React.useState<TextDiff[] | null>(null);

  const inputText = enabled ? _text : null;
  const inputPrevText = enabled ? _diffText : null;

  // async processing of diffs
  React.useEffect(() => {
    if (!inputText || !inputPrevText)
      return setDiffs(null);

    const callback = () => {
      setDiffs(
        cleanupEfficiency(makeDiff(inputPrevText, inputText, {
          timeout: 1,
          checkLines: true,
        }), 4),
      );
    };

    // slight delay to cancel the previous operation if too close to this
    const timeout = setTimeout(callback, 200);
    return () => clearTimeout(timeout);
  }, [inputPrevText, inputText]);

  return diffs;
}


export const RenderTextDiff = (props: { diffBlock: DiffBlock; sx?: SxProps; }) => {

  // external state
  const theme = useTheme();

  // derived state
  const textDiffs: TextDiff[] = props.diffBlock.textDiffs;

  // text added
  const styleAdd = {
    // backgroundColor: theme.vars.palette.success.softBg,
    backgroundColor: `rgba(${theme.palette.mode === 'light' ? theme.vars.palette.success.lightChannel : theme.vars.palette.success.darkChannel} / 1)`,
    color: theme.vars.palette.success.softColor,
    padding: '0.1rem 0.1rem', margin: '0 -0.1rem',
  };

  // text removed (strike-through)
  const styleSub = {
    backgroundColor: `rgba(${theme.vars.palette.danger.darkChannel} / 0.05)`,
    color: theme.vars.palette.danger.plainColor,
    padding: '0 0.25rem', margin: '0 -0.25rem',
    textDecoration: 'line-through',
  };

  const styleUnchanged = {
    // backgroundColor: `rgba(${theme.vars.palette.neutral.mainChannel} / 0.05)`,
  };

  return (
    <Typography
      sx={{
        mx: 1.5,
        // display: 'flex', alignItems: 'baseline',
        overflowWrap: 'anywhere',
        whiteSpace: 'break-spaces',
        display: 'block',
        ...props.sx,
      }}
    >
      {textDiffs.map(([op, text], index) =>
        <Box component='span' key={'diff-' + index} sx={op === DIFF_DELETE ? styleSub : op === DIFF_INSERT ? styleAdd : styleUnchanged}>{text}</Box>)}
    </Typography>
  );
};