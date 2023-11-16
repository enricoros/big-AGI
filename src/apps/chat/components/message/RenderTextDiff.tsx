import * as React from 'react';
import { Diff as TextDiff, DIFF_DELETE, DIFF_INSERT } from '@sanity/diff-match-patch';

import { Box, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { DiffBlock } from './blocks';


export const RenderTextDiff = ({ diffBlock, sx }: { diffBlock: DiffBlock; sx?: SxProps; }) => {

  // external state
  const theme = useTheme();

  // derived state
  const textDiffs: TextDiff[] = diffBlock.textDiffs;

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
        lineHeight: 1.75,
        mx: 1.5,
        // display: 'flex', alignItems: 'baseline',
        overflowWrap: 'anywhere',
        whiteSpace: 'break-spaces',
        ...(sx || {}),
        display: 'block',
        zIndex: 200,
      }}
    >
      {textDiffs.map(([op, text], index) =>
        <Box component='span' key={'diff-' + index} sx={op === DIFF_DELETE ? styleSub : op === DIFF_INSERT ? styleAdd : styleUnchanged}>{text}</Box>)}
    </Typography>
  );
};