import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';


// configuration
const OPTION_ACTIVE_COLOR: ColorPaletteProp = 'neutral';

/*
const containerSx: SxProps = {
  marginInlineStart: 1.5,
  // backgroundColor: `${OPTION_ACTIVE_COLOR}.softBg`,
  // borderRadius: 'lg',
  // p: 1,

  // layout
  // display: 'flex',
  // flexDirection: 'column',
  // gap: 1,
};
*/
const optionGroupSx: SxProps = {
  marginInlineStart: 1.5,

  // flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 0,
} as const;

const optionSx: SxProps = {
  // style
  fontWeight: 'normal',
  // px: 1.5,
  py: 0.5,
  minHeight: '1rem',
  color: 'text.primary',
  // borderRadius: 'sm',
  borderRadius: '1rem',
  // width: '100%',
  textAlign: 'inherit',

  // layout
  justifyContent: 'flex-start',
} as const;

const optionBoldSx: SxProps = {
  ...optionSx,
  fontWeight: 'lg',
} as const;


// '1. **text**' -> '1. text', or: **text** -> text
function _stripMarkdownBold(text: string): { text: string; isBold: boolean } {
  const stripped = text.replace(/(\*{2,})(.+)\1\s*$/, '$2').trimEnd();
  return { text: stripped, isBold: stripped !== text };
}


/** Continuation buttons for the options the render tree cut off the last text block (see `parseTrailingOptions`). */
export function BlockOpOptions(props: {
  contentScaling: ContentScaling,
  options: readonly string[],
  onContinue: (continueText: null | string) => void,
}) {
  const normalSx = React.useMemo(() => ({ ...optionSx, fontSize: props.contentScaling }), [props.contentScaling]);
  const boldSx = React.useMemo(() => ({ ...optionBoldSx, fontSize: props.contentScaling }), [props.contentScaling]);
  return (
    <Box sx={optionGroupSx}>
      {props.options.map((option, index) => {
        const { text, isBold } = _stripMarkdownBold(option);
        return (
          <Button
            key={index}
            color={OPTION_ACTIVE_COLOR}
            variant='soft'
            size={props.contentScaling === 'md' ? 'md' : 'sm'}
            onClick={() => props.onContinue(text.endsWith('?') ? text.slice(0, -1) : text)}
            sx={isBold ? boldSx : normalSx}
          >
            {text}
          </Button>
        );
      })}
    </Box>
  );
}
