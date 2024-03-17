import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton } from '@mui/joy';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';

import { useScrollToBottom } from './useScrollToBottom';


const inlineButtonSx: SxProps = {
  // style it
  backgroundColor: 'background.surface',
  borderRadius: '50%',
  border: '1px solid',
  borderColor: 'neutral.500',
  boxShadow: 'sm',

  // fade it in when hovering
  // transition: 'all 0.15s',
  // '&:hover': {
  //   transform: 'scale(1.1)',
  // },
} as const;

const absoluteButtonSx: SxProps = {
  ...inlineButtonSx,

  // place this on the bottom-right corner (FAB-like)
  position: 'absolute',
  bottom: '2rem',
  right: {
    xs: '1rem',
    md: '2rem',
  },
} as const;


export function ScrollToBottomButton(props: { inline?: boolean }) {

  // state
  const { atBottom, stickToBottom, setStickToBottom } = useScrollToBottom();

  const handleStickToBottom = React.useCallback(() => {
    setStickToBottom(true);
  }, [setStickToBottom]);

  // do not render the button at all if we're already snapping
  if (atBottom || stickToBottom)
    return null;

  return (
    <IconButton
      aria-label='Scroll To Bottom'
      variant='plain'
      onClick={handleStickToBottom}
      sx={props.inline ? inlineButtonSx : absoluteButtonSx}
    >
      <KeyboardDoubleArrowDownIcon />
    </IconButton>
  );
}